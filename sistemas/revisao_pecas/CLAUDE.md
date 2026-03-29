# Sistema de Revisao de Pecas

> Documentacao tecnica completa do sistema de fila de revisao para pecas juridicas geradas pelo automacao_total.

## Visao Geral

Sistema que recebe processos classificados e pecas geradas pelo projeto `E:\Projetos\Automacao_Total`, organiza em uma fila de revisao no portal-pge, e permite que procuradores revisem, editem e aprovem as pecas antes de inseri-las no pge.net.

### Fluxo Macro

```
automacao_total                    portal-pge                     BD_PGE.NET (pge.net)
┌──────────────┐   POST /ingerir   ┌──────────────┐   worker     ┌──────────────┐
│ Classifica   │ ───────────────►  │ Fila de      │ ──────────►  │ Observacoes  │
│ processos    │   (facultativo)   │ Revisao      │   (VPN)      │ nas          │
│ Gera pecas   │                   │ Edicao       │              │ Pendencias   │
│ Gera resumo  │                   │ Aprovacao    │              │              │
└──────────────┘                   └──────────────┘              └──────────────┘
```

---

## Arquitetura de Arquivos

```
sistemas/revisao_pecas/
├── CLAUDE.md                  # Este arquivo
├── __init__.py                # Exports publicos
├── models.py                  # 3 tabelas: ItemRevisao, RevisaoChatHistorico, AssessorDisponivel
├── schemas.py                 # Pydantic request/response (18 schemas)
├── services.py                # Logica de negocio (transicoes de status, estatisticas)
├── services_observacao.py     # Geracao de textos de observacao para pge.net
├── services_chat.py           # Contexto enriquecido e mensagens para Gemini
├── router.py                  # Endpoints principais (ingestao, listagem, revisao, assessores, worker)
├── router_chat.py             # Chat streaming SSE com Gemini
└── router_documentos.py       # Proxy TJ-MS para documentos do processo

scripts/worker_revisao/
├── config.py                  # Configuracao do worker (URLs, credenciais, paths)
├── worker_observacoes.py      # Worker local que insere observacoes no BD_PGE.NET
└── ingerir_sessao.py          # Script para ingerir uma sessao do automacao_total

frontend-react/src/pages/revisao/
├── RevisaoPage.tsx            # Pagina da fila (tabela + filtros + estatisticas)
├── RevisaoItemPage.tsx        # Pagina de revisao individual (split-panel)
├── types.ts, api.ts, constants.ts
├── components/
│   ├── FilaRevisao/           # TabelaItens, FiltrosRevisao, EstatisticasCards, DistribuirDialog
│   ├── Revisao/               # ResumoIA, BarraStatus, EditorPeca (TipTap), ChatRevisao, RejeicaoForm
│   ├── Documentos/            # PainelDocumentos, ListaDocumentos, VisualizadorPdf (react-pdf)
│   └── Assessores/            # AssessoresConfig
└── hooks/                     # useFilaRevisao, useRevisaoItem, useChatRevisao, useDocumentos
```

---

## Modelo de Dados

### Tabela `itens_revisao`

Tabela principal da fila de revisao. Cada registro e um processo classificado pelo automacao_total.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | Integer PK | Auto-increment |
| `numero_cnj` | String(25) | Numero do processo (formato CNJ) |
| `source_session` | String(100) | ID da sessao do automacao_total (ex: 2026-03-28_08-30) |
| `categoria` | String(50) | acordao, sentenca, decisao, despacho, citacao, intimacao |
| `resultado` | String(30) | favoravel, desfavoravel, parcial, neutro, indefinido |
| `acao_sugerida` | String(50) | peca_complexa, nada_a_fazer, peticao_ciencia, anotacao_dispensa, peca_simples, analise_humana |
| `tipo_peca` | String(50) | contestacao, manifestacao, peticao_ciencia (null se nada_a_fazer) |
| `conteudo_peca` | Text | Markdown da peca gerada pelo automacao_total |
| `resumo_revisor` | Text | Resumo especifico para o revisor |
| `classificacao_data` | JSON | {acao_detalhada, fundamentacao, confianca, urgencia, documentos_necessarios} |
| `status` | String(20) | pendente, em_revisao, aprovado, encaminhado, rejeitado, concluido |
| `obs_status` | String(30) | nao_aplicavel, aguardando_insercao, inserida, erro_insercao |
| `conteudo_editado` | Text | Versao final apos edicoes do revisor |
| `observacao_pge` | Text | Texto a ser lancado na pendencia do pge.net |
| `cdpendencia` | Integer | Codigo da pendencia no SAJ (BD_PGE.NET) |
| `motivo_rejeicao` | Text | Motivo quando a orientacao da IA foi rejeitada |
| `acao_corrigida` | String(50) | Acao correta definida pelo revisor |
| `usuario_revisor_id` | FK(users) | Quem esta revisando |
| `usuario_encaminhado_id` | FK(users) | Assessor que recebeu para inserir |
| `criado_em` | DateTime | Quando chegou do automacao_total |
| `revisado_em` | DateTime | Quando foi aprovado/rejeitado |
| `concluido_em` | DateTime | Quando foi marcado como inserido |

### Tabela `revisao_chat_historico`

Historico de mensagens do chatbot de edicao.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `item_revisao_id` | FK(itens_revisao) | Item sendo editado |
| `role` | String(10) | user / assistant |
| `conteudo` | Text | Texto da mensagem |
| `conteudo_peca_snapshot` | Text | Estado da peca apos alteracao da IA |

### Tabela `assessores_disponiveis`

Sublista de usuarios marcados como assessores para receber encaminhamentos.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `usuario_id` | FK(users) UNIQUE | Referencia ao usuario |
| `ativo` | Boolean | Se esta disponivel (pode desativar em ferias etc) |

---

## Fluxo de Status

```
pendente ──► em_revisao ──► aprovado ──────────► concluido
                        ├─► encaminhado ───────► concluido
                        └─► rejeitado ─────────► concluido

Qualquer um dos 3 (aprovado/encaminhado/rejeitado) pode voltar
para em_revisao via endpoint /desfazer.
```

### Transicoes detalhadas

| De | Para | Acao | Quem |
|----|------|------|------|
| pendente | em_revisao | Iniciar Revisao | Admin/Assessor |
| em_revisao | aprovado | Aprovar | Revisor |
| em_revisao | rejeitado | Rejeitar | Revisor |
| em_revisao | encaminhado | Encaminhar | Admin |
| aprovado | em_revisao | Desfazer | Revisor |
| rejeitado | em_revisao | Desfazer | Revisor |
| encaminhado | em_revisao | Desfazer | Admin |
| aprovado | concluido | Marcar como Inserido | Admin/Assessor |
| encaminhado | concluido | Marcar como Inserido | Assessor |
| rejeitado | concluido | Worker confirma obs inserida | Automatico |

---

## Fluxo de Insercao de Observacoes no pge.net

Este e o fluxo mais critico do sistema. Conecta o portal-pge ao BD_PGE.NET (Oracle SAJ) via VPN.

### 1. Geracao da Observacao

Quando o revisor aprova, rejeita ou encaminha um item que possui `cdpendencia`, o sistema gera automaticamente o texto da observacao:

| Cenario | Texto gerado |
|---------|-------------|
| Peca aprovada sem edicao | `[REVISADO] Peca de [tipo] gerada por IA revisada e aprovada sem alteracoes pelo(a) Proc. [nome]. Peca disponivel para insercao.` |
| Peca aprovada com edicao | `[REVISADO] Peca de [tipo] gerada por IA revisada e editada pelo(a) Proc. [nome]. Peca disponivel para insercao.` |
| Nada a fazer confirmado | `[REVISADO] Orientacao da IA - Nada a Fazer - revisada e confirmada pelo(a) Proc. [nome]. Sem providencias necessarias.` |
| Rejeitado | `[REJEITADO] Orientacao da IA - Nada a Fazer - REJEITADA pelo(a) Proc. [nome]. Acao correta: [acao]. Motivo: [motivo]` |
| Encaminhado | `[REVISADO] Peca de [tipo] revisada pelo(a) Proc. [nome] e encaminhada ao(a) assessor(a) [assessor] para insercao no processo.` |

Limite: 3000 caracteres (trunca na ultima frase completa). Definido em `services_observacao.py`.

### 2. Armazenamento

O texto e salvo em `observacao_pge` e o `obs_status` muda para `aguardando_insercao`. Itens sem `cdpendencia` ficam com `obs_status = nao_aplicavel`.

### 3. Worker Local

O worker roda no PC do usuario (que tem VPN para a rede da PGE):

```
scripts/worker_revisao/worker_observacoes.py
```

**Ciclo de execucao:**

```
1. Autentica no portal-pge via /auth/login → JWT
2. GET /revisao/api/observacoes-pendentes → lista de items com obs_status=aguardando
3. Para cada item:
   a. Normaliza texto (Unicode → ASCII para Oracle/cp1252)
   b. Executa: python BD_PGE.NET/scripts/inserir_observacao.py
              --cdpendencia <CDPENDENCIA>
              --texto "<OBSERVACAO>"
              --sem-confirmacao
   c. Verifica return code
   d. POST /revisao/api/observacoes/{item_id}/confirmar
      Body: { "sucesso": true/false, "erro_mensagem": null/"..." }
4. Aguarda INTERVALO segundos (padrao: 300 = 5 minutos)
5. Repete
```

**Configuracao** (`scripts/worker_revisao/config.py`):

| Variavel | Default | Descricao |
|----------|---------|-----------|
| `PORTAL_PGE_URL` | http://localhost:8000 | URL do portal-pge |
| `PORTAL_PGE_USER` | admin | Usuario para autenticacao |
| `PORTAL_PGE_PASS` | (vazio) | Senha (obrigatoria) |
| `WORKER_INTERVALO` | 300 | Segundos entre ciclos |
| `BD_PGE_SCRIPT` | E:\Projetos\BD_PGE.NET\scripts\inserir_observacao.py | Script de insercao |

**Como rodar:**

```bash
cd E:\Projetos\PGE\portal-pge\scripts\worker_revisao
set PORTAL_PGE_PASS=<senha>
python worker_observacoes.py
```

### 4. Script de Insercao (BD_PGE.NET)

O `inserir_observacao.py` (projeto separado em `E:\Projetos\BD_PGE.NET`):

- Conecta VPN PGE automaticamente
- Abre tunel SSH para o Oracle (10.2.12.215:1521 via 10.21.9.206)
- Conecta ao banco Oracle SAJ (localhost:1521/SPJMS)
- Executa UPDATE na tabela `SAJ.ESPJPENDENCIAPRAZO` coluna `DEOBSERVACOES`
- Verifica o resultado
- Encerra conexoes

### 5. Confirmacao e Auto-conclusao

Quando o worker confirma sucesso:
- `obs_status` muda para `inserida`
- Se o item foi **rejeitado** (sem peca), auto-transiciona para `concluido`
- Se o item foi **aprovado** sem peca (nada_a_fazer confirmado), auto-transiciona para `concluido`
- Itens **aprovados com peca** continuam como `aprovado` ate que alguem clique "Marcar como Inserido" (inseriu o DOCX no processo)

Quando o worker reporta falha:
- `obs_status` muda para `erro_insercao`
- O item NAO transiciona — fica aguardando retry

### 6. Encoding

**IMPORTANTE**: O Oracle SAJ usa cp1252. Caracteres Unicode como em-dash (`—`), aspas tipograficas (`""`), etc. devem ser convertidos para ASCII antes da insercao. O worker faz essa normalizacao automaticamente.

---

## API Endpoints

### Ingestao (automacao_total → portal-pge)

```
POST /revisao/api/ingerir          # Item unico
POST /revisao/api/ingerir-lote     # Batch (1-500 itens)
```

**Payload de ingestao:**
```json
{
  "numero_cnj": "0809140-73.2023.8.12.0110",
  "source_session": "2026-03-28_08-30",
  "categoria": "decisao",
  "resultado": "desfavoravel",
  "acao_sugerida": "peca_complexa",
  "tipo_peca": "contestacao",
  "conteudo_peca": "# CONTESTACAO\n...",
  "resumo_revisor": "Acordao desfavoravel ao Estado...",
  "classificacao_data": {
    "acao_detalhada": "...",
    "fundamentacao": "Decisao PGE 005/2025, item 3.1",
    "confianca": "alta",
    "urgencia": "prazo_correndo",
    "documentos_necessarios": []
  },
  "cdpendencia": 7115531,
  "usuario_revisor_id": null
}
```

### Listagem

```
GET /revisao/api/itens              # Filtros: status, urgencia, acao, tab, assessor_id, pagina
GET /revisao/api/itens/{id}         # Detalhe
GET /revisao/api/estatisticas       # Contadores por status
```

Tabs disponiveis: `todos`, `meus`, `pendentes`, `concluidos`, `para_revisar`, `para_inserir`

### Acoes de Revisao

```
POST /revisao/api/itens/{id}/iniciar-revisao   # pendente → em_revisao
POST /revisao/api/itens/{id}/aprovar           # em_revisao → aprovado
POST /revisao/api/itens/{id}/rejeitar          # em_revisao → rejeitado
POST /revisao/api/itens/{id}/encaminhar        # em_revisao → encaminhado (admin)
POST /revisao/api/itens/{id}/desfazer          # aprovado/rejeitado/encaminhado → em_revisao
POST /revisao/api/itens/{id}/marcar-inserido   # aprovado/encaminhado → concluido
POST /revisao/api/encaminhar-lote              # Distribuicao em lote (admin)
```

### Edicao

```
PUT  /revisao/api/itens/{id}/conteudo          # Auto-save do TipTap
POST /revisao/api/itens/{id}/chat              # Chat SSE streaming com Gemini
GET  /revisao/api/itens/{id}/chat/historico    # Historico do chat
```

### Documentos TJ-MS

```
GET /revisao/api/itens/{id}/documentos             # Lista documentos do processo
GET /revisao/api/documentos/{processo}/{doc_id}     # Download PDF (cache 1h)
```

### Assessores

```
GET    /revisao/api/assessores                 # Listar
POST   /revisao/api/assessores                 # Adicionar (admin)
DELETE /revisao/api/assessores/{id}             # Remover (admin)
PATCH  /revisao/api/assessores/{id}             # Ativar/desativar (admin)
```

### Worker (Observacoes)

```
GET  /revisao/api/observacoes-pendentes            # Lista obs aguardando insercao
POST /revisao/api/observacoes/{item_id}/confirmar   # Worker confirma resultado
```

### Export

```
POST /revisao/api/itens/{id}/exportar-docx     # Gera DOCX (ABNT + logo PGE)
```

---

## Script de Ingestao de Sessoes

Para ingerir uma sessao do automacao_total:

```bash
cd E:\Projetos\PGE\portal-pge\scripts\worker_revisao
python ingerir_sessao.py "E:\Projetos\Automacao_Total\output\sessoes\2026-03-28_08-30" \
    --url http://localhost:8000 \
    --user admin \
    --password <senha>
```

O script:
1. Parseia `relatorio_consolidado.md` (extrai categoria, resultado, acao, fundamentacao, urgencia, confianca, cdpendencia)
2. Carrega `peca.md` de cada subdiretorio com peca gerada
3. Monta o `resumo_revisor` a partir dos dados
4. Envia tudo via `POST /revisao/api/ingerir-lote`

---

## Frontend

### Pagina da Fila (`/revisao`)

- Cards de estatisticas no topo (total, pendentes, em revisao, aprovados, concluidos)
- Tabs: Todos | Meus | Pendentes | Concluidos (admin) / Para Revisar | Para Inserir (assessor)
- Filtros: status, urgencia, acao sugerida
- Tabela clicavel que abre a tela de revisao

### Tela de Revisao (`/revisao/:id`)

Layout split-panel:

```
┌─────────────────────────────────────────────────────────┐
│ Resumo da IA (banner azul)              │ Classificacao │
├─────────────────────────────────────────────────────────┤
│ [Status] Atribuido: Nome    [Aprovar][Encaminhar][Rej]  │
├────────────────────────┬────────────────────────────────┤
│ [Toolbar TipTap]       │ Documentos (N)    │           │
│                        │ > Doc selecionado │           │
│ Peca editavel          │   Doc 2           │  PDF      │
│ (prose-legal style)    │   Doc 3           │  viewer   │
│ scroll interno         │   ...             │  react-pdf│
├────────────────────────┤                   │           │
│ Chat colapsavel [💬]   │                   │           │
└────────────────────────┴────────────────────────────────┘
```

**Editor**: TipTap com toolbar (bold, italic, headings, quote, lists, undo/redo). Estilo `prose-legal` (Lora serif, line-height 2, justify). Auto-save com debounce de 2s. Somente leitura fora do status `em_revisao`.

**Chat**: Colapsado por padrao (barra compacta com input). Expande ao enviar mensagem. SSE streaming com Gemini. Contexto enriquecido (resumo + classificacao + peca).

**Visualizador PDF**: react-pdf com auto-fit a largura do container. Zoom 50%-200%. Cache de 1h nos documentos.

### Configuracao de Assessores (`/revisao/assessores`)

Pagina admin para gerenciar a sublista de assessores disponiveis. Toggle ativo/inativo, adicionar/remover.

---

## Papeis e Permissoes

| Funcionalidade | Admin | Assessor |
|----------------|-------|----------|
| Ver todos os itens | Sim | Nao (so os seus) |
| Iniciar revisao | Sim | Sim (nos atribuidos) |
| Aprovar/rejeitar | Sim | Sim |
| Encaminhar para assessor | Sim | Nao |
| Distribuir em lote | Sim | Nao |
| Config assessores | Sim | Nao |
| Marcar como inserido | Sim | Sim |
| Baixar DOCX | Sim | Sim |
| Desfazer aprovacao | Sim | Sim |

---

## Seguranca

- Todos os endpoints exigem `Depends(get_current_active_user)` (JWT)
- Chat streaming tem rate limiting (`LIMITS["ai"]`) + quota diaria (`check_ai_quota`)
- `resumo_revisor` e `motivo_rejeicao` passam por `validate_no_html()` (XSS)
- Ingestao e endpoints de admin sao restritos
- Worker autentica via JWT a cada ciclo

---

## Cuidados ao Alterar

1. **NAO alterar os textos de observacao** sem validar que o Oracle SAJ aceita os caracteres (usar apenas ASCII)
2. **NAO remover o campo cdpendencia** — e a chave para o worker inserir no pge.net
3. **NAO alterar as transicoes de status** sem atualizar o frontend (BarraStatus.tsx depende)
4. **O worker roda localmente** — qualquer mudanca nos endpoints de observacoes deve ser testada com o worker real
5. **O TipTap recebe markdown** — a conversao markdown→HTML e feita no EditorPeca.tsx via `marked` + `sanitizeHtml`
6. **O endpoint /exportar-docx** reutiliza a funcao do gerador de pecas — alteracoes la podem impactar aqui

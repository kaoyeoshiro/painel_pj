# Sistema de Revisao de Pecas — Design Spec

**Data**: 2026-03-29
**Status**: Aprovado
**Abordagem**: Monolito integrado (novo modulo `sistemas/revisao_pecas/` no portal-pge)

---

## Visao Geral

Sistema de fila de revisao no portal-pge para processos classificados e pecas geradas pelo automacao_total (`E:\Projetos\Automacao_Total`). O procurador (admin) revisa pecas geradas pela IA, confirma ou rejeita sugestoes de "nada a fazer", edita minutas diretamente ou via chatbot, e encaminha pecas aprovadas para assessores inserirem no pge.net.

### Fluxo Macro

```
automacao_total (classifica + gera pecas)
    │
    │ POST /revisao/api/ingerir (facultativo, opt-in por batch)
    ▼
portal-pge (fila de revisao)
    │
    │ Revisor aprova/rejeita/edita
    ▼
Worker local (PC com VPN)
    │
    │ Insere observacoes no BD_PGE.NET
    ▼
pge.net (pendencias atualizadas)
```

---

## 1. Modelo de Dados

### Tabela `itens_revisao`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | Integer PK | Auto-increment |
| `numero_cnj` | String(25) | Numero do processo |
| `source_session` | String(100) | ID da sessao do automacao_total |
| `categoria` | String(50) | acordao, sentenca, decisao, despacho, citacao, intimacao, pauta, remessa |
| `resultado` | String(30) | favoravel, desfavoravel, parcial, neutro, indefinido |
| `acao_sugerida` | String(50) | peca_complexa, nada_a_fazer, peticao_ciencia, anotacao_dispensa, peca_simples, analise_humana |
| `tipo_peca` | String(50) nullable | Tipo da peca gerada (contestacao, recurso, etc.). Null se nada_a_fazer |
| `conteudo_peca` | Text nullable | Markdown da peca gerada. Null se nada_a_fazer |
| `resumo_revisor` | Text | Resumo especifico para o revisor, gerado pelo automacao_total via LLM |
| `classificacao_data` | JSON | Dados completos: acao_detalhada, fundamentacao, confianca, urgencia, documentos_necessarios |
| `status` | String(20) default `pendente` | pendente, em_revisao, aprovado, encaminhado, rejeitado, concluido |
| `obs_status` | String(30) default `nao_aplicavel` | aguardando_insercao, inserida, erro_insercao, nao_aplicavel |
| `conteudo_editado` | Text nullable | Versao final apos edicoes (TipTap + chatbot) |
| `observacao_pge` | Text nullable | Texto da observacao a ser lancada no pge.net |
| `motivo_rejeicao` | Text nullable | Quando rejeitado: o que deveria ser feito |
| `acao_corrigida` | String(50) nullable | Acao correta definida pelo revisor ao rejeitar |
| `cdpendencia` | Integer nullable | Codigo da pendencia no BD_PGE.NET |
| `usuario_revisor_id` | Integer FK(users) nullable | Quem esta revisando |
| `usuario_encaminhado_id` | Integer FK(users) nullable | Assessor que recebeu para inserir |
| `criado_em` | DateTime | Quando chegou do automacao_total |
| `revisado_em` | DateTime nullable | Quando foi aprovado/rejeitado |
| `concluido_em` | DateTime nullable | Quando a observacao foi inserida no pge.net |

### Tabela `revisao_chat_historico`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | Integer PK | Auto-increment |
| `item_revisao_id` | Integer FK(itens_revisao) | Item sendo editado |
| `role` | String(10) | user / assistant |
| `conteudo` | Text | Mensagem |
| `conteudo_peca_snapshot` | Text nullable | Estado da peca apos alteracao da IA |
| `criado_em` | DateTime | Timestamp |

### Tabela `assessores_disponiveis`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | Integer PK | Auto-increment |
| `usuario_id` | Integer FK(users) UNIQUE | Referencia ao usuario |
| `ativo` | Boolean default True | Se esta disponivel para receber encaminhamentos |
| `criado_em` | DateTime | Quando foi adicionado |

---

## 2. API Endpoints

### Ingestao (automacao_total → portal-pge)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `POST /revisao/api/ingerir` | Recebe um item para a fila | Auth via JWT |
| `POST /revisao/api/ingerir-lote` | Recebe multiplos itens de uma sessao | Auth via JWT |

**Payload de ingestao:**

```json
{
    "numero_cnj": "0809140-73.2023.8.12.0110",
    "source_session": "2026-03-29_08-30",
    "categoria": "acordao",
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
        "documentos_necessarios": ["id1", "id2"]
    },
    "cdpendencia": 12345,
    "usuario_revisor_id": null
}
```

### Fila e Listagem

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `GET /revisao/api/itens` | Lista itens com filtros (status, urgencia, atribuicao, acao). Paginado | |
| `GET /revisao/api/itens/{id}` | Detalhe de um item com classificacao_data completo | |
| `GET /revisao/api/estatisticas` | Contadores por status, urgencia, assessor | Dashboard |

### Revisao

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `POST /revisao/api/itens/{id}/iniciar-revisao` | Marca em_revisao, atribui ao usuario | |
| `POST /revisao/api/itens/{id}/aprovar` | Aprova com conteudo final editado | |
| `POST /revisao/api/itens/{id}/rejeitar` | Rejeita com motivo + acao corrigida | |
| `POST /revisao/api/itens/{id}/encaminhar` | Encaminha para assessor por ID | |
| `POST /revisao/api/itens/encaminhar-lote` | Distribui multiplos itens (manual ou aleatorio) | |
| `POST /revisao/api/itens/{id}/marcar-inserido` | Assessor/admin confirma que inseriu DOCX no pge.net | Transiciona para concluido |

### Edicao (Chatbot + TipTap)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `PUT /revisao/api/itens/{id}/conteudo` | Salva edicao direta do TipTap (auto-save) | |
| `POST /revisao/api/itens/{id}/chat-stream` | Chatbot de edicao via SSE streaming | |
| `GET /revisao/api/itens/{id}/chat-historico` | Historico do chat | |

### Documentos (Autos do Processo)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `GET /revisao/api/itens/{id}/documentos` | Lista documentos do processo via TJ-MS | |
| `GET /revisao/api/documentos/{processo}/{doc_id}` | Proxy para download de PDF do TJ-MS. Cache | |

### Assessores

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `GET /revisao/api/assessores` | Lista assessores disponiveis | |
| `POST /revisao/api/assessores` | Adiciona usuario como assessor. Admin-only | |
| `DELETE /revisao/api/assessores/{id}` | Remove assessor da lista. Admin-only | |
| `PATCH /revisao/api/assessores/{id}` | Ativa/desativa assessor. Admin-only | |

### Worker Local (pge.net)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `GET /revisao/api/observacoes-pendentes` | Lista observacoes aguardando insercao | Worker consulta |
| `POST /revisao/api/observacoes/{id}/confirmar` | Worker confirma insercao no pge.net | |
| `POST /revisao/api/observacoes/{id}/erro` | Worker reporta erro na insercao | |

### Export

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `POST /revisao/api/itens/{id}/exportar-docx` | Gera DOCX final via endpoint existente do gerador de pecas | |

---

## 3. Frontend

### Estrutura de Arquivos

```
frontend-react/src/pages/revisao/
├── RevisaoPage.tsx              # Pagina principal (fila de revisao)
├── RevisaoItemPage.tsx          # Tela de revisao individual (split-panel)
├── types.ts                     # Interfaces TypeScript
├── api.ts                       # Chamadas API
├── constants.ts                 # Status, cores, labels
├── components/
│   ├── FilaRevisao/
│   │   ├── TabelaItens.tsx      # DataTable com filtros e ordenacao
│   │   ├── FiltrosRevisao.tsx   # Barra de filtros
│   │   ├── EstatisticasCards.tsx # Cards com contadores no topo
│   │   └── DistribuirDialog.tsx # Modal para distribuicao em lote
│   ├── Revisao/
│   │   ├── ResumoIA.tsx         # Banner do resumo + badges de classificacao
│   │   ├── BarraStatus.tsx      # Barra com status + botoes de acao
│   │   ├── EditorPeca.tsx       # TipTap editor com toolbar
│   │   ├── ChatRevisao.tsx      # Chat colapsavel (input + historico)
│   │   └── RejeicaoForm.tsx     # Form de rejeicao (acao + observacao)
│   ├── Documentos/
│   │   ├── PainelDocumentos.tsx  # Painel direito completo
│   │   ├── ListaDocumentos.tsx   # Sidebar com lista de docs
│   │   └── VisualizadorPdf.tsx   # Wrapper do react-pdf com zoom
│   └── Assessores/
│       ├── AssessoresConfig.tsx  # Tela de config de assessores
│       └── SeletorAssessor.tsx   # Dropdown de selecao
└── hooks/
    ├── useRevisaoItem.ts        # Fetch + estado do item
    ├── useChatRevisao.ts        # Streaming SSE do chatbot
    ├── useDocumentos.ts         # Fetch de documentos TJ-MS
    └── useFilaRevisao.ts        # Fetch da fila com filtros
```

### Rotas

| Rota | Componente | Acesso |
|------|------------|--------|
| `/revisao` | RevisaoPage | Admin + Assessores |
| `/revisao/:id` | RevisaoItemPage | Admin + Assessor atribuido |
| `/revisao/assessores` | AssessoresConfig | Somente Admin |

### Layout da Tela de Revisao (com peca)

```
┌─────────────────────────────────────────────────────────┐
│ Resumo da IA (banner azul)              │ Classificacao │
│ Texto do resumo_revisor                 │ badges        │
├─────────────────────────────────────────────────────────┤
│ [Em Revisao] Atribuido: Admin    [Aprovar][Encam][Rej]  │
├────────────────────────┬────────────────────────────────┤
│ [Toolbar: N I S ...]   │ Documentos (23)    │           │
│                        │ > Acordao (8369)   │           │
│ CONTESTACAO            │   Sentenca (8)     │  PDF      │
│ (editor TipTap)        │   Peticao (9500)   │  render   │
│ texto editavel...      │   ...              │  area     │
│                        │                    │           │
├────────────────────────┤                    │           │
│ 💬 Peca alteracao...   │                    │           │
│ (chat colapsavel)      │                    │           │
└────────────────────────┴────────────────────────────────┘
```

### Layout sem Peca (nada a fazer)

Lado esquerdo mostra: detalhes da analise, fundamentacao, e formulario de rejeicao (acao correta + observacao). Lado direito: mesmos autos do processo.

### Visao por Papel

**Admin:**
- Tabs: "Todos" | "Meus" | "Pendentes" | "Concluidos"
- Filtros por assessor, status, urgencia, acao
- Acoes: encaminhar, distribuir em lote, config assessores

**Assessor:**
- Tab "Para Revisar" — itens atribuidos para revisao
- Tab "Para Inserir" — itens aprovados pelo admin para baixar/inserir no pge.net
- Sem acesso a itens de outros assessores

---

## 4. Fluxos de Estado

### Diagrama de Status

```
pendente → em_revisao → aprovado → concluido (admin baixa DOCX e marca como inserido)
                      → encaminhado → concluido (assessor baixa DOCX e marca como inserido)
                      → rejeitado → concluido (obs de rejeicao inserida pelo worker)
```

### Transicao para `concluido`

- **Com peca (aprovado/encaminhado)**: O assessor ou admin baixa o DOCX, insere manualmente no pge.net, e clica "Marcar como inserido" (`POST /itens/{id}/marcar-inserido`). O worker cuida separadamente da observacao (obs_status).
- **Rejeitado (nada a fazer corrigido)**: Transiciona automaticamente para concluido quando o worker confirma a insercao da observacao de rejeicao.

### Sub-status de Observacao (`obs_status`)

```
nao_aplicavel (padrao)
aguardando_insercao (apos aprovacao/rejeicao)
inserida (worker confirmou)
erro_insercao (worker reportou falha)
```

A interface mostra badges claros:
- "Aguardando insercao local" (amarelo)
- "Observacao inserida" (verde)
- "Erro na insercao" (vermelho, com retry)

### Textos das Observacoes no pge.net

| Cenario | Texto |
|---------|-------|
| Peca aprovada sem alteracao | `"[REVISADO] Peca de [tipo] gerada por IA revisada e aprovada sem alteracoes pelo(a) Proc. [nome]. Peca disponivel para insercao."` |
| Peca aprovada com edicao | `"[REVISADO] Peca de [tipo] gerada por IA revisada e editada pelo(a) Proc. [nome]. Peca disponivel para insercao."` |
| Nada a fazer — confirmado | `"[REVISADO] Orientacao da IA — Nada a Fazer — revisada e confirmada pelo(a) Proc. [nome]. Sem providencias necessarias."` |
| Nada a fazer — rejeitado | `"[REJEITADO] Orientacao da IA — Nada a Fazer — REJEITADA pelo(a) Proc. [nome]. Acao correta: [acao_corrigida]. Motivo: [motivo_rejeicao]"` |
| Encaminhado para assessor | `"[REVISADO] Peca de [tipo] revisada pelo(a) Proc. [nome] e encaminhada ao(a) assessor(a) [nome_assessor] para insercao no processo."` |

Observacoes truncadas em 3000 caracteres (limite do BD_PGE.NET), cortando na ultima frase completa.

---

## 5. Integracoes

### automacao_total → portal-pge

- Integracao facultativa (opt-in por batch)
- automacao_total autentica via JWT no portal-pge
- Envia classificacao + peca + resumo_revisor via `POST /revisao/api/ingerir` ou `/ingerir-lote`
- O `resumo_revisor` e um campo novo gerado por chamada LLM adicional apos classificacao

### Worker Local (PC com VPN → pge.net)

```
Loop a cada N minutos:
  1. GET /revisao/api/observacoes-pendentes
  2. Para cada observacao:
     a. Conecta ao BD_PGE.NET via VPN
     b. Insere observacao na pendencia (cdpendencia)
     c. POST /revisao/api/observacoes/{id}/confirmar ou /erro
  3. Log local do resultado
```

Script Python reutilizando logica do `inserir_obs_passe2.py`. Roda como tarefa agendada no Windows.

### portal-pge → TJ-MS (documentos)

Reutiliza `services/tjms/client.py` para listar e baixar documentos do processo. Proxy com cache no backend.

### portal-pge → Gemini (chatbot de edicao)

Reutiliza `services/gemini_service.py`. Chatbot com contexto enriquecido: resumo do automacao_total + classificacao + peca + historico de chat.

### portal-pge → DOCX export

Reutiliza endpoint existente `/gerador-pecas/api/exportar-docx` para gerar DOCX final com formatacao ABNT e logo PGE.

---

## 6. Dependencias e Seguranca

### Novas Dependencias Frontend

| Pacote | Uso |
|--------|-----|
| `@tiptap/react` + `@tiptap/starter-kit` | Editor rico da peca |
| `@tiptap/extension-placeholder` | Placeholder no editor |
| `react-pdf` + `pdfjs-dist` | Renderizacao de PDFs inline |

### Nenhuma dependencia nova no backend

SSE, Gemini, TJ-MS, DOCX export, rate limiting, quota — tudo ja existe.

### Seguranca

| Regra | Aplicacao |
|-------|-----------|
| Rate limit IA | `chat-stream` recebe `@limiter.limit(LIMITS["ai"])` + `check_ai_quota` |
| Auth em todos endpoints | `Depends(get_current_active_user)` |
| Admin-only | Config assessores, distribuicao em lote, visao geral |
| Ingestao autenticada | automacao_total usa JWT |
| Worker autenticado | Worker local usa JWT |
| Sanitizacao | `resumo_revisor` e `motivo_rejeicao` passam por `validate_no_html()` |

---

## 7. Decisoes Tecnicas

| Decisao | Justificativa |
|---------|---------------|
| TipTap para editor | Mesma engine do Canvas/ChatGPT. Aceita markdown, exporta markdown. Extensivel |
| react-pdf para viewer | Wrapper React do pdf.js. Menos codigo custom que portar a solucao do chatbot |
| Chat colapsavel | Nao polui a tela; expande sob demanda |
| Worker local desacoplado | Resolve problema de VPN/rede. Portal-pge nao precisa acessar pge.net |
| Monolito integrado | Reutiliza auth, SSE, TJ-MS, DOCX, rate limit. Sem duplicacao |
| Ingestao facultativa | automacao_total escolhe se envia batch para revisao |
| Resumo revisor separado | Conteudo otimizado para revisao humana, diferente do acao_detalhada tecnico |

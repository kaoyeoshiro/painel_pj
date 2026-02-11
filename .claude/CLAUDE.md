# CLAUDE.md - Regras Operacionais

> Este arquivo contem as regras que o Claude deve seguir SEMPRE ao trabalhar neste repositorio.
> **LEIA ESTE ARQUIVO ANTES DE QUALQUER ACAO.**

## Memoria Persistente (mem0)

Este repositorio usa **mem0** como memoria persistente entre sessoes. O mem0 armazena decisoes arquiteturais, pitfalls, regras de seguranca e contexto acumulado do projeto.

### Regras de uso do mem0

1. **SEMPRE consultar no inicio**: Ao comecar qualquer tarefa, usar `search-memories` com query relevante (ex: "seguranca", "extrator autos", "gerador pecas", "pitfalls") para recuperar contexto.
2. **Atualizar ao aprender algo novo**: Quando descobrir um bug, pitfall, decisao arquitetural ou padrao importante, salvar no mem0 via `add-memory`.
3. **Corrigir memorias desatualizadas**: Se uma memoria no mem0 estiver errada ou obsoleta, adicionar uma nova com a informacao correta (o mem0 atualiza automaticamente).
4. **Prefixar com "Portal PGE -"**: Todas as memorias devem comecar com `Portal PGE -` para facilitar busca.
5. **Granularidade**: Uma memoria por topico (nao misturar assuntos diferentes na mesma entrada).

### Quando consultar

- Antes de modificar qualquer sistema (`search-memories` com nome do sistema)
- Antes de criar endpoints de IA (`search-memories` com "seguranca" ou "rate limiting")
- Ao encontrar um erro estranho (`search-memories` com "pitfalls")
- Ao trabalhar com banco de dados (`search-memories` com "database")
- Ao lidar com TJ-MS, BERT, uploads (`search-memories` com o topico)

### Quando salvar

- Descobriu um bug e a causa raiz
- Implementou uma decisao arquitetural relevante
- Encontrou um pitfall que pode se repetir
- Criou um padrao novo que deve ser seguido
- Alterou limites, constantes ou contratos entre modulos

## Como Trabalhar Neste Repositorio

### Checklist Obrigatorio

Antes de fazer qualquer alteracao:

- [ ] Leu este arquivo (CLAUDE.md)
- [ ] Consultou o mem0 (`search-memories`) para contexto relevante
- [ ] Identificou qual sistema sera afetado
- [ ] Consultou a documentacao do sistema em `docs/sistemas/<sistema>.md`
- [ ] Verificou se ha regras de negocio que podem ser afetadas
- [ ] Entendeu as integracoes envolvidas (TJ-MS, Gemini, etc)

### Regras de Ouro

1. **NAO alterar regras de negocio sem autorizacao explicita**
2. **NAO remover validacoes existentes sem justificativa**
3. **NAO alterar integracao TJ-MS sem testar localmente**
4. **SEMPRE manter compatibilidade com dados existentes no banco**
5. **SEMPRE validar inputs do usuario (Pydantic)**

## Mapa de Documentacao

### Estrutura de Pastas

```
docs/
├── arquitetura/     # Arquitetura, ADRs, modulos
├── sistemas/        # Documentacao por sistema
├── integracoes/     # TJ-MS, banco vetorial
├── api/             # Referencia de API REST
├── operacoes/       # Deploy, testes, ambiente
├── features/        # Features especificas
├── dominio/         # Glossario juridico
└── planejamento/    # Roadmaps
```

### Documentacao Principal

| Documento | Conteudo |
|-----------|----------|
| `docs/README.md` | Indice central de toda documentacao |
| `docs/arquitetura/ARQUITETURA_GERAL.md` | Visao macro, fluxos, onboarding |
| `docs/planejamento/PLANO_MELHORIAS_BACKEND.md` | Roadmap de melhorias |
| `docs/operacoes/CHECKLIST_RELEASE_EQUIPE.md` | Checklist para deploy |
| `docs/integracoes/PLANO_UNIFICACAO_TJMS.md` | Servico TJ-MS unificado |

### Documentacao por Sistema

| Sistema | Arquivo |
|---------|---------|
| Gerador de Pecas | `docs/sistemas/gerador_pecas.md` |
| Pedido de Calculo | `docs/sistemas/pedido_calculo.md` |
| Prestacao de Contas | `docs/sistemas/prestacao_contas.md` |
| Relatorio de Cumprimento | `docs/sistemas/relatorio_cumprimento.md` |
| Matriculas Confrontantes | `docs/sistemas/matriculas_confrontantes.md` |
| Assistencia Judiciaria | `docs/sistemas/assistencia_judiciaria.md` |
| BERT Training | `docs/sistemas/bert_training.md` |
| Classificador de Documentos | `docs/sistemas/classificador_documentos.md` |

### Documentacao Tecnica

| Documento | Conteudo |
|-----------|----------|
| `docs/arquitetura/ARCHITECTURE.md` | Detalhes tecnicos |
| `docs/api/API.md` | Referencia de API |
| `docs/operacoes/TESTING.md` | Guia de testes |

## Comandos de Validacao

### Rodar Servidor Local

```bash
uvicorn main:app --reload
```

### Rodar Testes

```bash
# Todos os testes
pytest

# Testes especificos
pytest tests/test_gerador_pecas.py -v

# Com cobertura
pytest --cov=. --cov-report=html
```

### Verificar Lint

```bash
flake8 .
```

## Integracoes Externas

### TJ-MS (SOAP/MNI) - SERVICO UNIFICADO

| Item | Valor |
|------|-------|
| Endpoint | Via proxy `TJMS_PROXY_URL` |
| Timeout | 30s (configuravel em `services/tjms/config.py`) |
| Credenciais | `TJ_WS_USER`, `TJ_WS_PASS` |
| Cliente Unificado | `services/tjms/` (modulo principal) |
| Documentacao Frontend | `/admin/tjms-docs` |

**Estrutura do Modulo Unificado:**
```
services/tjms/
  __init__.py      # Exports publicos
  config.py        # Configuracao centralizada
  models.py        # Modelos de dados
  client.py        # TJMSClient (async)
  parsers.py       # XMLParserTJMS
  adapters.py      # Wrappers de compatibilidade
```

**Cuidados:**
- NAO fazer requests diretos ao TJ-MS (sempre usar proxy)
- NAO aumentar timeout sem justificativa
- Testar localmente antes de alterar
- **IMPORTANTE**: Ao alterar `services/tjms/`, atualizar a documentacao em `/admin/tjms-docs`

**REGRA CRITICA - Sincronizacao Backend/Frontend:**
> Ao alterar qualquer arquivo em `services/tjms/`, DEVE-SE verificar se ha impacto
> nos templates dos sistemas que consomem TJMS. Atualize `/admin/tjms-docs` e
> notifique a equipe de frontend se houver mudanca na estrutura de dados.

### Google Gemini

| Item | Valor |
|------|-------|
| API Key | `GEMINI_KEY` |
| Modelos | Configurados em `/admin/prompts-config` |
| Cliente | `services/gemini_service.py` |

**Cuidados:**
- NAO hardcodar modelos (usar configuracao do banco)
- Respeitar limites de tokens
- Tratar erros de rate limiting

### OCR (PyMuPDF)

| Item | Valor |
|------|-------|
| Biblioteca | PyMuPDF (fitz) |
| Uso | Extracao de texto de PDFs |

**Cuidados:**
- PDFs grandes podem consumir muita memoria
- Textos ilegives devem ser tratados

## Como Registrar Decisoes

### Nova Decisao Arquitetural

1. Criar ADR em `docs/decisions/ADR-XXXX-titulo.md`
2. Seguir template em `docs/decisions/ADR-0001-template.md`
3. Referenciar na documentacao relevante

### Atualizacao de Sistema

1. Atualizar `docs/sistemas/<sistema>.md`
2. Registrar mudancas significativas em `docs/DOCS_CHANGES.md`
3. Atualizar regras de negocio se aplicavel

### Bug Fix ou Feature

1. Seguir padrao de commits convencionais
2. Criar PR com descricao clara
3. Atualizar documentacao se necessario

## Estrutura de Codigo

### Onde Colocar Novo Codigo

| Tipo | Local |
|------|-------|
| Novo sistema | `sistemas/<nome>/` |
| Servico compartilhado | `services/` |
| Modelo de dados | `<modulo>/models.py` |
| Endpoint | `<modulo>/router.py` |
| Utilitarios | `utils/` |
| Testes | `tests/` |

### Padrao de Nomenclatura

- **Arquivos**: snake_case (`documento_classifier.py`)
- **Classes**: PascalCase (`DocumentClassifier`)
- **Funcoes**: snake_case (`processar_documento`)
- **Constantes**: UPPER_CASE (`MAX_TIMEOUT`)

### Imports

```python
# 1. Stdlib
import os
import json
from datetime import datetime

# 2. Third-party
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

# 3. Local
from auth.dependencies import get_current_user
from database.connection import get_db
from .models import MeuModelo
```

## O Que NAO Fazer

1. **NAO** commitar credenciais ou secrets
2. **NAO** alterar migrations existentes
3. **NAO** remover logs sem justificativa
4. **NAO** fazer requests sincronos em endpoints async
5. **NAO** ignorar erros (sempre logar)
6. **NAO** criar arquivos temporarios sem limpeza
7. **NAO** usar `print()` (usar `logger`)

## Frontend React SPA (frontend-react/)

> Convencoes estabelecidas na revisao da branch `feat/react-spa`. Ver ADR-0013 para detalhes.

| Regra | Detalhes |
|-------|----------|
| Markdown | Sempre usar `useMarkdown` hook (retorna `{ html }`) — NAO usar `marked()` direto |
| Dialog | Sempre usar `<DialogContent>` dentro de `<Dialog>` — divs custom nao funcionam |
| Select | Para `<option>` nativo: usar `<select>` HTML — Radix Select requer `SelectItem` |
| API paths | `createApiClient('/auth')` ja prepende — NAO duplicar prefix nas chamadas |
| Zustand | Destruturar apenas propriedades que existem na interface do store |
| Effects | Separar cleanup de intervals (`[]`) e recursos visuais (`[dep]`) em effects distintos |
| console.log | Remover antes de merge — `console.warn`/`console.error` para erros sao OK |

## Resolucao de Problemas Comuns

### Erro de Conexao TJ-MS

1. Verificar se proxy esta rodando
2. Verificar credenciais em .env
3. Verificar logs em `logs/`

### Erro de Gemini

1. Verificar API key
2. Verificar modelo configurado
3. Verificar limite de tokens

### Erro de Banco

1. Verificar DATABASE_URL
2. Verificar se migrations rodaram
3. Verificar logs de SQL

## Melhorias de Backend Implementadas (Jan 2024)

### Resiliencia e Observabilidade

| Componente | Arquivo | Descricao |
|------------|---------|-----------|
| Circuit Breaker | `utils/circuit_breaker.py` | Protecao contra falhas em cascata (TJ-MS, Gemini) |
| Retry com Backoff | `utils/retry.py` | Retentativas exponenciais para servicos externos |
| Timeouts Centralizados | `utils/timeouts.py` | Configuracao unica de timeouts |
| Rate Limiting | `utils/rate_limit.py` | Controle de requisicoes por usuario/IP |
| Logging Estruturado | `utils/logging_config.py` | Logs JSON com structlog |
| Request ID | `middleware/request_id.py` | Correlacao de logs entre servicos |
| Metricas | `utils/metrics.py` | Metricas Prometheus-style em `/metrics` |
| Health Check | `utils/health_check.py` | Verificacao de dependencias em `/health/detailed` |

### Seguranca

| Componente | Arquivo | Descricao |
|------------|---------|-----------|
| Brute Force Protection | `utils/brute_force.py` | Bloqueio apos tentativas de login |
| Audit Logs | `utils/audit.py` | Registro de acoes sensiveis |
| Password Policy | `utils/password_policy.py` | Validacao de senhas fortes |
| XSS Prevention | `frontend/src/shared/security.ts` | Funcoes de escape HTML |
| Secrets Rotation | `docs/operacoes/ROTACAO_SECRETS.md` | Documentacao de rotacao |

### TJ-MS Unificado

| Componente | Arquivo | Descricao |
|------------|---------|-----------|
| Cliente | `services/tjms/client.py` | Cliente async com retry e circuit breaker |
| Configuracao | `services/tjms/config.py` | Configuracao centralizada |
| Modelos | `services/tjms/models.py` | Dataclasses tipadas |
| Parsers | `services/tjms/parsers.py` | Parser XML robusto |
| Constantes | `services/tjms/constants.py` | Enums para tipos de documento |
| Testes | `tests/services/test_tjms_service.py` | 54+ testes unitarios |

### Infraestrutura

| Componente | Arquivo | Descricao |
|------------|---------|-----------|
| Alembic Migrations | `alembic/` | Migrations de banco de dados |
| Feature Flags | `utils/feature_flags.py` | Sistema simples de flags |
| Cache de Resumos | `utils/cache.py` | Cache TTL para resumos JSON |
| BERT Watchdog | `sistemas/bert_training/watchdog.py` | Deteccao de jobs travados |
| Alertas | `utils/alerting.py` | Sistema de alertas (Slack/Email) |
| Background Tasks | `utils/background_tasks.py` | Scheduler de tarefas periodicas |
| Load Testing | `tests/load/k6_load_test.js` | Scripts k6 para carga |
| Dashboard Metricas | `admin/dashboard_router.py` | Dashboard visual em `/admin/dashboard` |
| Testes E2E | `tests/e2e/test_critical_flows.py` | Testes de fluxos criticos |

### Refatoracoes de Codigo

| Componente | Arquivo | Descricao |
|------------|---------|-----------|
| Orquestrador Agentes | `sistemas/gerador_pecas/orquestrador_agentes.py` | Metodos auxiliares extraidos, reducao de duplicacao |
| Helpers Prompt | Funcoes `_montar_prompt_agente3`, `_limpar_resposta_markdown` | Compartilhadas entre streaming e nao-streaming |
| Helpers Modulos | Metodos `_carregar_modulos_base`, `_montar_prompt_conteudo` | Carregamento modular de prompts |

### Documentacao de Seguranca

- `docs/operacoes/ROTACAO_SECRETS.md` - Como rotacionar secrets
- `docs/seguranca/PREVENCAO_XSS.md` - Prevencao de XSS

### Como Usar os Novos Componentes

**Circuit Breaker:**
```python
from utils.circuit_breaker import get_tjms_circuit_breaker

cb = get_tjms_circuit_breaker()
if cb.allow_request():
    try:
        result = await call_tjms()
        cb.record_success()
    except Exception as e:
        cb.record_failure(e)
```

**Retry:**
```python
from utils.retry import RETRY_CONFIG_TJMS, retry_async

@retry_async(RETRY_CONFIG_TJMS)
async def chamar_tjms():
    return await client.consultar()
```

**Alertas:**
```python
from utils.alerting import alert_error

await alert_error("Falha no TJ-MS", "Timeout na consulta", processo="123")
```

**Feature Flags:**
```python
from utils.feature_flags import is_feature_enabled

if is_feature_enabled("nova_feature"):
    usar_nova_logica()
```

## Decisoes Recentes (Jan 2026)

### Classificador de Documentos - Aumento do Limite de Upload

**Data**: 2026-01-30
**Decisao**: Aumentar o limite maximo de arquivos por upload de **500** para **2.000** arquivos.

**Arquivos alterados**:
- `sistemas/classificador_documentos/router.py` - Constante `MAX_FILES` alterada de 500 para 2000
- `sistemas/classificador_documentos/templates/index.html` - Validacao frontend e texto informativo atualizados

**Justificativa**:
- Usuarios precisavam classificar lotes maiores de documentos
- O processamento ja era assíncrono via SSE (streaming) com semaforo de concorrencia
- Nao ha impacto significativo na memoria pois arquivos sao processados individualmente

**Consideracoes tecnicas**:
- Upload via FormData pode ser mais lento com muitos arquivos
- Cada arquivo e limitado a 50MB individualmente
- Processamento usa semaforo (padrao: 3 paralelos) para nao sobrecarregar IA
- Tipos aceitos: PDF, TXT, ZIP
- **IMPORTANTE**: O Starlette tem limite padrao de 1000 arquivos em `request.form()`. Para permitir 2000 arquivos, o endpoint usa `request.form(max_files=2000, max_fields=2100)` - ver `router.py:upload_arquivos_lote()`

**Outras melhorias implementadas no mesmo commit**:
- Correcao da exportacao Excel/CSV/JSON (funcao `exportarResultadosLote` estava apenas mostrando alert)
- Visualizacao dos resultados em tabela no frontend (botao "Ver Classificacoes")
- Tabela inclui: documento, categoria, subcategoria, confianca, justificativa

### Ralph Loop - Investigação e Convenções de Logging

**Data**: 2026-01-30
**Decisao**: Documentar como o Ralph Loop funciona e remover instruções conflitantes do CLAUDE.md do usuário.

**Problema investigado**:
O terminal sempre mostrava "Total de iterações: 1" e não exibia mensagens de início de nova iteração.

**Causa raiz identificada**:
O arquivo `~/.claude/CLAUDE.md` continha instruções para que Claude exibisse manualmente o box de iteração, o que conflitava com o plugin Ralph Loop:
1. O plugin `stop-hook.sh` já exibe o box de iteração automaticamente
2. As instruções manuais faziam Claude exibir um box com contador incorreto
3. O timing estava errado: Claude mostrava no INÍCIO, mas a iteração só incrementa no FIM

**Arquivos do plugin Ralph Loop**:
- Setup: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/ralph-loop/scripts/setup-ralph-loop.sh`
- Stop Hook: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/ralph-loop/hooks/stop-hook.sh`
- Estado: `.claude/ralph-loop.local.md` (criado no diretório do projeto)

**Como funciona o tracking de iterações**:
1. `setup-ralph-loop.sh` cria arquivo de estado com `iteration: 1`
2. Quando Claude tenta sair, `stop-hook.sh` é executado
3. O hook incrementa a iteração: `NEXT_ITERATION=$((ITERATION + 1))`
4. O hook atualiza o arquivo e exibe: `🔄 RALPH LOOP - ITERAÇÃO [X/MAX]`
5. O hook retorna JSON `{ "decision": "block", "reason": "prompt" }` para continuar

**Convenções de logging (NÃO interferir)**:
- ❌ NÃO exibir boxes de iteração manualmente (o plugin já faz)
- ❌ NÃO ler `.claude/ralph-loop.local.md` para mostrar contador
- ❌ NÃO mostrar "Total de iterações" na conclusão (o plugin já faz)
- ✅ Trabalhar na tarefa normalmente
- ✅ Outputar `<promise>TEXTO</promise>` quando tarefa estiver GENUINAMENTE completa

**Versão Windows**:
Existe também `~/.claude/plugins/local/ralph-loop-windows/` com scripts PowerShell para compatibilidade Windows.

### Ralph Loop Windows - Correção do Erro de Carregamento

**Data**: 2026-01-30
**Problema**: Plugin "ralph-loop-windows" falhava ao carregar com erro "failed to load: 1 error"

**Causa raiz**:
1. Comandos PowerShell com aspas escapadas no `hooks.json` causavam erro de parsing
2. Formato incorreto nos arquivos de comando (`invocation` ao invés de `allowed-tools`)
3. Falta de scripts wrapper `.bat` para evitar problemas de escaping

**Correções aplicadas**:
1. Criados scripts `.bat` como wrappers para os scripts PowerShell:
   - `hooks/stop-hook.bat` -> chama `stop-hook.ps1`
   - `scripts/setup-ralph-loop.bat` -> chama `setup-ralph-loop.ps1`

2. Simplificado `hooks.json` para usar apenas o caminho do `.bat`:
   ```json
   "command": "${CLAUDE_PLUGIN_ROOT}/hooks/stop-hook.bat"
   ```

3. Corrigido formato dos comandos em `commands/*.md`:
   - Removido `invocation` e `passArguments`
   - Adicionado `allowed-tools` e `hide-from-slash-command-tool`
   - Formato segue padrão do plugin oficial

**Estrutura final do plugin**:
```
ralph-loop-windows/
├── .claude-plugin/plugin.json
├── commands/
│   ├── ralph-loop.md
│   ├── cancel-ralph.md
│   └── help.md
├── hooks/
│   ├── hooks.json
│   ├── stop-hook.bat     # Wrapper
│   └── stop-hook.ps1
├── scripts/
│   ├── setup-ralph-loop.bat  # Wrapper
│   └── setup-ralph-loop.ps1
└── README.md
```

**Para habilitar**: Reinicie o Claude Code após as correções.

### Classificador de Documentos - Bug "Executar Classificação" não funcionava

**Data**: 2026-01-30
**Problema**: Ao clicar em "Executar Classificação" na aba "Meus Lotes", nada acontecia (sem requests, sem logs).

**Causa raiz**:
Na função `executarProjeto()` em `templates/index.html`:
1. Linha 1780: `hideModalDetalheProjeto()` era chamado **primeiro**
2. `hideModalDetalheProjeto()` define `projetoAtual = null`
3. Linha 1792: Tentava acessar `projetoAtual.id` → **TypeError: Cannot read properties of null**

**Correção aplicada**:
```javascript
// ANTES (bugado):
hideModalDetalheProjeto();
// ...
const projetoId = projetoAtual.id; // projetoAtual já é null!

// DEPOIS (corrigido):
const projetoId = projetoAtual.id;  // Salva ANTES de fechar o modal
const projetoNome = projetoAtual.nome;
hideModalDetalheProjeto();
```

**Lição aprendida**:
Ao fechar modais que limpam estado global, sempre salvar os dados necessários ANTES de chamar a função de fechamento.

### Gerador de Peças - Tag HUMAN_VALIDATED para Modo Semi-Automático

**Data**: 2026-02-02
**Decisao**: Todos os prompts no modo semi-automático (curadoria) DEVEM ser marcados com a tag `[HUMAN_VALIDATED]`, indicando validação humana explícita.

**Arquivos alterados**:
- `sistemas/gerador_pecas/router.py` - Tags `[HUMAN_VALIDATED]` e `[HUMAN_VALIDATED:MANUAL]` no endpoint de geração com curadoria
- `sistemas/gerador_pecas/services_curadoria.py` - Método `montar_prompt_curado` usa as mesmas tags
- `tests/test_curadoria_semi_automatico.py` - Testes automatizados cobrindo o enforcement

**Separação de modos**:
| Modo | Arquivo Principal | Tag Usada |
|------|-------------------|-----------|
| Automático | `orquestrador_agentes.py` | `[VALIDADO]` |
| Semi-Automático | `router.py` (curadoria), `services_curadoria.py` | `[HUMAN_VALIDATED]` |

**Regras do modo semi-automático**:
1. **Tag obrigatória**: Todo módulo selecionado pelo usuário recebe `[HUMAN_VALIDATED]`
2. **Tag manual**: Módulos adicionados manualmente recebem `[HUMAN_VALIDATED:MANUAL]`
3. **Instrução obrigatória**: O prompt inclui instrução explícita para a IA usar os argumentos integralmente
4. **Sem modificação**: A IA NÃO deve aplicar juízo de valor nos argumentos validados
5. **Sanitização técnica**: Apenas sanitização técnica é permitida (se necessária por segurança)

**Formato do prompt gerado**:
```
## ARGUMENTOS E TESES APLICAVEIS (HUMAN_VALIDATED)
> **INSTRUÇÃO OBRIGATÓRIA**: Os argumentos marcados com [HUMAN_VALIDATED] foram
> validados pelo usuário e DEVEM ser incluídos integralmente na peça final.
> Não aplique juízo de valor ou modifique o conteúdo - apenas sanitização técnica se necessária.

### === CATEGORIA ===
#### Titulo do Módulo [HUMAN_VALIDATED]
Conteúdo do módulo...

#### Titulo do Módulo Manual [HUMAN_VALIDATED:MANUAL]
Conteúdo adicionado manualmente...
```

**IMPORTANTE - Modo automático inalterado**:
O modo automático (`orquestrador_agentes.py`) permanece 100% inalterado, usando a tag `[VALIDADO]` original.
Esta separação é intencional para distinguir claramente entre:
- `[VALIDADO]`: Seleção automática pelo sistema (pode ter juízo de valor da IA)
- `[HUMAN_VALIDATED]`: Validação explícita humana (uso integral obrigatório)

**Testes automatizados**:
- `TestHumanValidatedEnforcement` - Verifica que todos os prompts semi-automáticos têm a tag
- `TestModoAutomaticoInabalterado` - Verifica que modo automático não foi alterado

### Auditoria de Curadoria - Dashboard de Feedbacks

**Data**: 2026-02-02
**Decisao**: Unificar auditoria de curadoria entre `/admin/feedbacks` e `/admin/gerador-pecas/historico`.

**Arquivos alterados**:
- `admin/router.py` - Endpoint de listagem agora inclui `total_preview` no `modo_info` e `modo_ativacao` nos pendentes
- `frontend/templates/admin_feedbacks.html` - Modal de detalhes inclui botão "Ver Auditoria Completa" com seções colapsáveis

**Funcionalidades implementadas**:
1. **Correção do bug "Sugestões do Sistema = 0"**: O endpoint de listagem não retornava `total_preview` (linha 1631-1637 do router.py)
2. **Botão "Ver Auditoria Completa"**: Abre modal detalhado usando endpoint `/api/gerador-pecas/admin/geracoes/{id}/curadoria`
3. **Seções colapsáveis**:
   - Sugestões Confirmadas (módulos vindos do preview que o usuário aceitou)
   - Adicionados Manualmente (módulos que o usuário incluiu)
   - Sugestões Removidas (módulos do preview que o usuário rejeitou)
4. **Glossário de termos**: Explicação de HUMAN_VALIDATED, confirmado, manual, removido
5. **Indicador visual nos pendentes**: Badge âmbar indica gerações com modo semi-automático

**Endpoint de auditoria detalhada**:
```
GET /api/gerador-pecas/admin/geracoes/{geracao_id}/curadoria
```
Retorna:
- `metadata`: total_preview, total_incluidos, total_confirmados, total_manuais, total_excluidos
- `modulos_incluidos`: Lista com titulo, categoria, tag, tipo_decisao, conteudo
- `modulos_excluidos`: Lista com titulo, categoria, motivo_exclusao
- `glossario`: Definições dos termos
- `explicacao_processo`: Etapas do modo semi-automático

## Contato

- **Equipe**: LAB/PGE-MS
- **Slack**: #pge-dev
- **Issues**: GitHub Issues

# Plano de Refatoracao Incremental — Backend Portal PGE

> **Branch**: `refactor/backend-cleanup` (baseada em `feat/tailadmin-dashboard`)
> **Inicio**: 2026-02-11
> **Status**: EM ANDAMENTO

---

## Indice

- [Resumo do Problema](#resumo-do-problema)
- [Fase 0 — Alembic](#fase-0--correcao-do-alembic)
- [Fase 1 — Remocao Frontend Legado](#fase-1--remocao-do-frontend-legado)
- [Fase 2 — Quick Wins](#fase-2--quick-wins)
- [Fase 3 — Repository Pattern](#fase-3--repository-pattern)
- [Fase 4 — Service Layer](#fase-4--service-layer)
- [Fase 5 — Split de Arquivos Grandes](#fase-5--split-de-arquivos-grandes)
- [Fase 6 — Adapters (DIP)](#fase-6--adapters-dip)
- [Log de Progresso](#log-de-progresso)

---

## Resumo do Problema

| Metrica | Valor |
|---------|-------|
| Linhas em routers | ~28.900 |
| Maior arquivo | `router_extraction.py` (5.267 linhas) |
| Operacoes DB diretas em routers | 48+ (so gerador_pecas) |
| Models no Alembic env.py | ~15 de 62+ (muitos com nome errado) |
| Migrations Alembic | 4 (cobertura ~10%) |
| Templates Jinja2 legados | ~30 arquivos |
| `create_all()` no startup | Sim (init_db.py:95) |
| SQL manual de migracao | 330+ linhas em init_db.py |

### Top 5 Hotspots

| # | Arquivo | Linhas | Problema |
|---|---------|--------|----------|
| 1 | `gerador_pecas/router.py` | 3.742 | DB direto, streaming 300+ linhas, IA inline |
| 2 | `gerador_pecas/router_extraction.py` | 5.267 | 5 responsabilidades num arquivo |
| 3 | `gerador_pecas/services_deterministic.py` | 2.616 | Regras + AST + variaveis + logging |
| 4 | `pedido_calculo/router.py` | 1.789 | Import Gemini inline, XML + IA |
| 5 | `bert_training/router.py` | 2.519 | Datasets + runs + workers + metricas |

---

## Fase 0 — Correcao do Alembic

**Objetivo**: Tornar Alembic a unica fonte de verdade para schema do banco.

### Checklist

- [ ] **0.1** Importar todos os 62+ models em `migrations/env.py`
  - Corrigir `GeminiCallLog` → `GeminiApiLog` (arquivo correto: `models_gemini_logs`)
  - Corrigir nomes errados: `TipoPeca/Pergunta/Prompt/Processo/Documento` → `GeracaoPeca/VersaoPeca/FeedbackPeca`
  - Corrigir `PedidoCalculo` → `GeracaoPedidoCalculo/LogChamadaIA/FeedbackPedidoCalculo`
  - Corrigir `PrestacaoContas` → `GeracaoAnalise/LogChamadaIAPrestacao/FeedbackPrestacao`
  - Corrigir `BertTrainingRun/EpochLog/Prediction` → `BertDataset/BertRun/BertJob/BertMetric/BertLog/BertTestHistory/BertWorker`
  - Corrigir `ClassificadorDocumentosJob/Result` → `ProjetoClassificacao/CodigoDocumentoProjeto/ExecucaoClassificacao/ResultadoClassificacao/PromptClassificacao/LogClassificacaoIA`
  - Corrigir `RelatorioCumprimento` → `GeracaoRelatorioCumprimento/LogChamadaIARelatorioCumprimento/FeedbackRelatorioCumprimento`
  - Adicionar modelos faltantes: matriculas, assistencia, extraction, config_pecas, resumo_json, teste_categorias, teste_ativacao, cumprimento_beta, extrator_autos, request_perf, CategoriaOrdem, AdminSettings
  - Remover `TextNormalizerPattern` (nao e SQLAlchemy — sao Pydantic/dataclasses)
  - Remover try/except — se model nao importa, migration deve falhar

- [ ] **0.2** Gerar migration baseline (snapshot do schema atual)
  - `alembic revision --autogenerate -m "baseline_schema_completo"`
  - Revisar SQL gerado, remover duplicatas
  - Usar `if_not_exists=True` onde possivel

- [ ] **0.3** Stampar banco de producao
  - `alembic stamp head` (marca sem aplicar SQL)

- [ ] **0.4** Converter `init_db.py:run_migrations()` para Alembic
  - Verificar cada ALTER TABLE/CREATE TABLE da funcao
  - Criar migrations individuais para grupos logicos nao cobertos
  - Marcar cada migration como idempotente

- [ ] **0.5** Remover `create_all()` de `init_db.py`
  - Deletar `Base.metadata.create_all(bind=engine)` (linha 95)
  - Manter `wait_for_db()` e `seed_admin_user()`

- [ ] **0.6** Atualizar deploy
  - `Procfile`: `web: alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
  - CI: adicionar step `alembic upgrade head` antes dos testes

- [ ] **0.7** Criar `tests/test_alembic_migrations.py`
  - Validar upgrade/downgrade sem erros

- [ ] **0.8** Documentar workflow Alembic em ADR

**Risco**: Alto (schema em producao)
**Rollback**: `alembic downgrade -1`. Manter `create_all()` comentado como safety net por 2 semanas.

---

## Fase 1 — Remocao do Frontend Legado

**Objetivo**: Eliminar templates Jinja2 e constante `FRONTEND_MODE`.

### Checklist

- [ ] **1.1** Confirmar paridade React (testes E2E para todas as 30 telas legadas)
- [ ] **1.2** Deletar bloco `if FRONTEND_MODE == "legacy":` (main.py:842-1077, ~235 linhas)
- [ ] **1.3** Simplificar bloco React: remover rotas-espelho legacy (main.py:1138-1272)
- [ ] **1.4** Remover constantes: `FRONTEND_MODE`, 10 vars `*_TEMPLATES`, `safe_serve_static()`, etc.
- [ ] **1.5** Remover setup Jinja2: `from fastapi.templating import Jinja2Templates` (main.py:16, 429)
- [ ] **1.6** Limpar `router_config_pecas.py`: import e instanciacao Jinja2 nao usados (linhas 13, 44)
- [ ] **1.7** Deletar diretorios: `frontend/templates/`, `sistemas/*/templates/`, `frontend/static/`
- [ ] **1.8** Ajustar CSP (remover `frame-ancestors localhost:5173/5178` se desnecessario)
- [ ] **1.9** Atualizar documentacao

**Risco**: Baixo (modo legacy ja nao e padrao)
**Rollback**: `git revert` do commit

---

## Fase 2 — Quick Wins

**Objetivo**: Reducoes de acoplamento rapidas, sem reestruturar arquitetura.

### 2a. Extrair schemas dos routers

- [ ] Mover classes Pydantic de `router_extraction.py:1-150` → `schemas_extraction.py`
- [ ] Mover schemas inline de outros routers → `schemas.py` do respectivo sistema

### 2b. Unificar acesso ao Gemini

- [ ] Remover `sistemas/gerador_pecas/gemini_client.py` (wrapper local)
- [ ] Todos os sistemas usam `services/gemini_service.py` exclusivamente
- [ ] Mover imports de dentro de endpoints para nivel de modulo

### 2c. Extrair streaming generators

- [ ] Mover generators de 300+ linhas dos endpoints → funcoes em services
- [ ] `router.py:858-1200` → `services/streaming.py:event_generator_geracao()`
- [ ] Endpoint fica: `return StreamingResponse(streaming.event_generator_geracao(params))`

### 2d. Remover dead code

- [ ] `router_config_pecas.py:13,44` — Jinja2Templates nao usado
- [ ] Constantes mortas: `CODIGOS_PRIMEIRO_DOC`, `CODIGOS_PETICAO`
- [ ] Imports nao usados identificados por linter

**Risco**: Baixo (cada quick win e um commit atomico)

---

## Fase 3 — Repository Pattern

**Objetivo**: Encapsular acesso a dados em repositorios. Zero `db.query` em routers.

### Checklist

- [ ] **3.1** Criar `database/repository_base.py` — interface generica `IRepository[T]`
- [ ] **3.2** Criar `sistemas/gerador_pecas/repositories.py` (piloto)
  - `GeracaoPecaRepository`: find_by_numero_cnj, save, get_statistics, etc.
- [ ] **3.3** Injetar via FastAPI `Depends`
- [ ] **3.4** Migrar 48 operacoes DB do `router.py` → repositorio
- [ ] **3.5** Repetir para `pedido_calculo`, `bert_training`, demais sistemas
- [ ] **3.6** Criar testes unitarios com SQLite in-memory

**Risco**: Medio
**Pre-requisito**: Fase 2

---

## Fase 4 — Service Layer

**Objetivo**: Routers thin (<50 linhas/handler). Logica migra para services injetaveis.

### Checklist

- [ ] **4.1** Identificar use cases do `gerador_pecas/router.py`:
  - `GerarPecaService`, `PreviewModulosService`, `ChatContinuacaoService`, `GerarComCuradoriaService`
- [ ] **4.2** Criar service classes com deps injetadas (repo, adapters)
- [ ] **4.3** Refatorar router para delegar ao service
- [ ] **4.4** Repetir para `pedido_calculo` e `bert_training`
- [ ] **4.5** Testes unitarios para services com mocks

**Risco**: Medio-Alto
**Pre-requisito**: Fase 3

---

## Fase 5 — Split de Arquivos Grandes

**Objetivo**: Nenhum arquivo com mais de ~800 linhas. SRP por arquivo.

### 5a. Split `router_extraction.py` (5.267 linhas)

- [ ] `extraction/schemas.py` (~400 linhas)
- [ ] `extraction/router_questions.py` (~500 linhas)
- [ ] `extraction/router_models.py` (~400 linhas)
- [ ] `extraction/router_variables.py` (~500 linhas)
- [ ] `extraction/router_dependencies.py` (~400 linhas)
- [ ] `extraction/services.py` (~600 linhas)

### 5b. Split `services_deterministic.py` (2.616 linhas)

- [ ] `deterministic/evaluator.py` (~600 linhas)
- [ ] `deterministic/operators.py` (~400 linhas) — Strategy pattern
- [ ] `deterministic/variable_resolver.py` (~400 linhas)
- [ ] `deterministic/activation_logger.py` (~300 linhas)

### 5c. Split `bert_training/router.py` (2.519 linhas)

- [ ] `routers/datasets.py`, `routers/training_runs.py`, `routers/jobs.py`, `routers/workers.py`, `routers/metrics.py`

**Risco**: Medio (muitos imports para atualizar)
**Pre-requisito**: Fase 2

---

## Fase 6 — Adapters (DIP)

**Objetivo**: Services dependem de interfaces, nao de implementacoes concretas.

### Checklist

- [ ] **6.1** Criar `adapters/ports.py` — interfaces `IGeminiPort`, `ITJMSPort`, `IBertPort`
- [ ] **6.2** Criar `adapters/gemini_adapter.py`
- [ ] **6.3** Criar `adapters/tjms_adapter.py`
- [ ] **6.4** Criar `adapters/bert_adapter.py`
- [ ] **6.5** Injetar adapters via FastAPI `Depends`
- [ ] **6.6** Testes com `MockGeminiAdapter`, `MockTJMSAdapter`

**Risco**: Baixo (aditivo, coexiste com imports diretos)
**Pre-requisito**: Fase 4

---

## Regras de Seguranca (MANTER EM TODAS AS FASES)

> Estas regras NUNCA devem ser violadas durante a refatoracao.

1. Rate limiting em endpoints de IA preservado
2. Quota diaria preservada
3. XSS sanitization preservada
4. `safe_torch_load` enforced
5. Magic bytes validation preservada
6. CSP sem `unsafe-eval` em producao
7. CI security pipeline (`security.yml`) passando
8. Logging estruturado + Request ID preservados
9. Metricas Prometheus preservadas
10. Health checks e audit logs preservados

---

## Ordem de Execucao

```
Fase 0 (Alembic)  ─────────────────────────►
Fase 1 (Legacy)   ───────►                    (paralelo com Fase 0)
Fase 2 (Quick Wins) ──────────►               (paralelo com Fase 0)
                              Fase 3 (Repos) ──────────────►
                                               Fase 4 (Services) ──────────►
Fase 5 (Split) pode iniciar apos Fase 2 ──────────────────────►
                                                                Fase 6 (Adapters) ───►
```

---

## Definition of Done

| Criterio | Verificacao |
|----------|------------|
| Testes passando | `pytest` — 200+ testes + novos |
| Cobertura | ≥80% nas areas alteradas |
| Migrations | `alembic upgrade head` + `downgrade -1` sem erros |
| Sem legado | Zero import de Jinja2Templates, zero FRONTEND_MODE |
| Performance | Latencia ≤ +5% do baseline |
| Seguranca | CI `security.yml` passando, 59+ testes |
| API estavel | Contratos de rota preservados (paths, methods, schemas) |
| Docs | ADRs criados, CLAUDE.md atualizado |

---

## Log de Progresso

> Registrar aqui cada mudanca significativa com data.

| Data | Fase | O que foi feito | Commit |
|------|------|-----------------|--------|
| 2026-02-11 | — | Criado plano de refatoracao e branch `refactor/backend-cleanup` | — |
| | | | |

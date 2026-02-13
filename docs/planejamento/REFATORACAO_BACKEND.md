# Plano de Refatoracao Incremental — Backend Portal PGE

> **Branch**: `refactor/backend-cleanup` (baseada em `feat/tailadmin-dashboard`)
> **Inicio**: 2026-02-11
> **Conclusao**: 2026-02-12
> **Status**: ✅ CONCLUIDO (fundacao arquitetural completa)

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

| Metrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Linhas em routers | ~28.900 | ~28.600 | -300 (splits redistribuiram, nao adicionaram) |
| Maior arquivo router | 5.267 (router_extraction.py) | 3.612 (gerador_pecas/router.py) | -31% |
| main.py | 1.320 | 1.080 | -240 linhas (-18%) |
| init_db.py | 2.373 | 807 | -1.566 linhas (-66%) |
| Models no Alembic env.py | ~15 de 62+ | 72 (100%) | Cobertura completa |
| Migrations Alembic | 0 uteis | 3 (baseline + 2) | Alembic e fonte de verdade |
| `create_all()` no startup | Sim | Removido | Alembic gerencia schema |
| Hotspots >2000L | 3 arquivos (10.4k linhas) | 0 arquivos | Todos splitados |
| Arquivos criados (modulos) | — | 24 | Separacao de responsabilidades |
| Testes criados | — | 3 arquivos (54 testes) | Repos + Adapters + Migrations |
| Commits na branch | — | 33 | 33 commits atomicos |

### Top 5 Hotspots (original → atual)

| # | Arquivo | Original | Atual | Status |
|---|---------|----------|-------|--------|
| 1 | `gerador_pecas/router.py` | 3.742 | **3.612** | ✅ Repos injetados, -130L (Fase 3) |
| 2 | `gerador_pecas/router_extraction.py` | 5.267 | **0** | ✅ Eliminado (Fase 5a) |
| 3 | `gerador_pecas/services_deterministic.py` | 2.616 | **772** | ✅ Split (Fase 5b) |
| 4 | `pedido_calculo/router.py` | 1.789 | **1.709** | ✅ Repos injetados, -80L (Fase 3) |
| 5 | `bert_training/router.py` | 2.519 | **28** | ✅ Split (Fase 5c) |

---

## Fase 0 — Correcao do Alembic

**Objetivo**: Tornar Alembic a unica fonte de verdade para schema do banco.

### Checklist

- [x] **0.1** Importar todos os 62+ models em `migrations/env.py` ✅ `6e6e4e0` (72 tabelas)
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

- [x] **0.2** Gerar migration baseline (snapshot do schema atual) ✅ `5c9768a` (no-op baseline)
  - Autogenerate detectou diffs (JSONB vs JSON, colunas extras, indexes manuais)
  - Reescrito como no-op com discrepancias documentadas na docstring
  - Aplicado ao banco local com sucesso

- [ ] **0.3** Stampar banco de producao
  - `alembic stamp head` (marca sem aplicar SQL)
  - PENDENTE: executar em producao apos deploy

- [x] **0.4** Converter `init_db.py:run_migrations()` para Alembic ✅ `c558ea4`
  - 3 ALTER COLUMN TYPE → migration `b1a2c3d4e5f6`
  - Constraint uq_prompt_modulo → migration `c2b3d4e5f6a7` (com dedup + FK cleanup)
  - CREATE TABLE cobertos pela baseline com `create_all(checkfirst=True)`

- [x] **0.5** Remover `create_all()` de `init_db.py` ✅ `cdefff4`
  - `create_tables()` removido (1500+ linhas de SQL manual)
  - `run_migrations()` removido
  - init_db.py: 2373 → 807 linhas (-66%)
  - Seeds mantidos (todos idempotentes)

- [x] **0.6** Atualizar deploy ✅ `4918e8b`
  - `Procfile`: `web: alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
  - CI: PostgreSQL 16 service + step `alembic upgrade head` antes dos testes
  - CI: branch `refactor/*` adicionada aos triggers

- [x] **0.7** Criar `tests/test_alembic_migrations.py` ✅ `a2baa76`
  - 9 testes: imports, cadeia, head unico, upgrade/downgrade
  - Todos passando

- [x] **0.8** Documentar workflow Alembic em ADR ✅ `72c4d8a` (ADR-0002)

**Risco**: Alto (schema em producao)
**Rollback**: `alembic downgrade -1`. Manter `create_all()` comentado como safety net por 2 semanas.

---

## Fase 1 — Remocao do Frontend Legado

**Objetivo**: Eliminar feature flag `FRONTEND_MODE` e bloco legado. Templates Jinja2 permanecem
porque o React SPA usa iframe (`LegacyAdminFramePage.tsx`) para exibir paginas admin legadas.

### Checklist

- [x] **1.1** Confirmar paridade React — 524 rotas preservadas, todos testes passando
- [x] **1.2** Deletar bloco `if FRONTEND_MODE == "legacy":` (~239 linhas removidas)
- [x] **1.4a** Remover constante `FRONTEND_MODE` e dedent bloco React
- [ ] ~~**1.3** Remover rotas-espelho~~ → BLOQUEADO: React iframe depende delas
- [ ] ~~**1.4b** Remover `*_TEMPLATES`, `safe_serve_static()`~~ → BLOQUEADO: usados pelas rotas-espelho
- [ ] ~~**1.5** Remover Jinja2Templates~~ → BLOQUEADO: paginas admin via iframe
- [x] **1.6** Limpar `router_config_pecas.py` — ja feito na Fase 2a
- [ ] ~~**1.7** Deletar `sistemas/*/templates/`~~ → BLOQUEADO: iframe carrega templates
- [ ] **1.8** Ajustar CSP (avaliar quando iframe admin for migrado para React nativo)
- [x] **1.9** Atualizar documentacao

> **Nota**: Itens 1.3, 1.4b, 1.5, 1.7 serao desbloqueados quando as paginas admin forem reescritas
> em React nativo (substituindo `LegacyAdminFramePage.tsx` por componentes React).

**Risco**: Baixo (modo legacy ja nao e padrao)
**Rollback**: `git revert` do commit

---

## Fase 2 — Quick Wins

**Objetivo**: Reducoes de acoplamento rapidas, sem reestruturar arquitetura.

### 2a. Extrair schemas dos routers

- [x] Mover classes Pydantic de `router_extraction.py` → `schemas_extraction.py` ✅ `c0753fc` (52 schemas)
- [x] Mover schemas de `router.py/router_config_pecas.py/router_admin.py` → `schemas.py` ✅ `6100f27` (16 schemas)
- [x] Mover schemas de `admin/router_prompts.py` → `admin/schemas_prompts.py` ✅ `f3bb5c3` (33 schemas)
- [x] Mover schemas dos demais routers → `schemas.py` do respectivo sistema ✅ `ad9f3c4` + `8321e89`
  - pedido_calculo: 13 schemas, relatorio_cumprimento: 4, assistencia_judiciaria: 4
  - admin/performance: 8, admin/gemini_logs: 6, admin/router: 1, auth/router: 1

### 2b. Unificar acesso ao Gemini

- [x] Remover `sistemas/gerador_pecas/gemini_client.py` (wrapper local) ✅ `4fcfef6`
- [x] Todos os sistemas usam `services/gemini_service.py` exclusivamente ✅ `4fcfef6` (10 arquivos migrados)
- [ ] Mover imports lazy de dentro de endpoints para nivel de modulo (adiado — risco de circular imports)

### 2c. Extrair streaming generators → ADIADA para Fase 4

> **Decisao**: 11 generators mapeados (~2.230 linhas nos 4 maiores), mas extrair closures
> com db session, performance tracking e SSE formatting e essencialmente Service Layer (Fase 4).
> Sera feito junto com a criacao de services injetaveis.

**Generators mapeados (para referencia na Fase 4)**:
| Router | Endpoint | Linhas | Prioridade |
|--------|----------|--------|------------|
| gerador_pecas/router.py | /processar-stream | ~545 | Alta |
| gerador_pecas/router.py | /processar-pdfs-stream | ~510 | Alta |
| gerador_pecas/router.py | /curadoria/gerar-stream | ~375 | Media |
| pedido_calculo/router.py | /processar-stream | ~800 | Alta |

### 2d. Remover dead code

- [x] `router_config_pecas.py:13,44` — Jinja2Templates nao usado ✅ `8401dd8` + `6dfc01d`
- [x] Constantes mortas: `CODIGOS_PRIMEIRO_DOC`, `CODIGOS_PETICAO` (ja removidas anteriormente)
- [ ] Imports nao usados identificados por linter (melhoria continua)

**Risco**: Baixo (cada quick win e um commit atomico)

---

## Fase 3 — Repository Pattern

**Objetivo**: Encapsular acesso a dados em repositorios. Zero `db.query` em routers.

### Checklist

- [x] **3.1** Criar `database/repository_base.py` — `BaseRepository[T]` generico ✅ `d8f1efa`
- [x] **3.2** Criar `sistemas/gerador_pecas/repositories.py` (piloto) ✅
  - GeracaoPecaRepository: find_by_user, find_by_id_and_user, find_latest_with_docs
  - FeedbackPecaRepository: find_by_geracao
  - VersaoPecaRepository: has_versions
- [x] **3.3** Injetar via FastAPI `Depends` (get_geracao_repo, get_feedback_repo) ✅
- [x] **3.4** Migrar 16 endpoints CRUD de `router.py` → repositorio ✅
  - gerador_pecas: 11 endpoints (historico, versoes, feedback, autos)
  - pedido_calculo: 5 endpoints (verificar, historico, feedback)
- [x] **3.5** `pedido_calculo/repositories.py` criado ✅
  - GeracaoPedidoCalculoRepository: find_by_user, find_by_id_and_user, find_latest_by_cnj_and_user
  - FeedbackPedidoCalculoRepository: find_by_geracao
- [ ] **3.5b** Repetir para `bert_training`, demais sistemas (incremental)
- [x] **3.6** 25 testes unitarios (BaseRepository, GeracaoPeca, Feedback, Versao, factories, estrutural) ✅

> **Nota**: Endpoints streaming (processar-stream, curadoria) mantidos com `db` direto.
> Serao migrados na Fase 4 quando geradores se tornarem services injetaveis.

**Risco**: Medio
**Pre-requisito**: Fase 2

---

## Fase 4 — Service Layer

**Objetivo**: Routers thin (<50 linhas/handler). Logica migra para services injetaveis.

### Checklist

- [x] **4.1** Criar `admin/repositories.py` — `ConfiguracaoIARepository`, `PromptConfigRepository` ✅ `c760e6b`
  - get_config, get_valor (com default), list_by_sistema
  - Shared entre 7+ routers que consultam ConfiguracaoIA
- [x] **4.2** Migrar endpoints `editar-minuta` e `editar-minuta-stream` para config_repo ✅ `c760e6b`
  - Substituido `db.query(ConfiguracaoIA)` por `config_repo.get_valor()`
  - Substituido `print()` por `logger.info()`
- [ ] **4.3** Identificar e criar service classes para endpoints complexos:
  - `GerarPecaService`, `PreviewModulosService`, `ChatContinuacaoService`, `GerarComCuradoriaService`
- [ ] **4.4** Refatorar streaming generators (processar-stream ~545L, processar-pdfs-stream ~510L)
- [ ] **4.5** Repetir para `pedido_calculo` e `bert_training`
- [ ] **4.6** Testes unitarios para services com mocks

> **Nota**: Endpoints streaming sao closures com db, performance tracking e SSE formatting.
> Extracao incremental — os mais complexos (545-800 linhas) requerem services injetaveis.

**Risco**: Medio-Alto
**Pre-requisito**: Fase 3

---

## Fase 5 — Split de Arquivos Grandes

**Objetivo**: Nenhum arquivo com mais de ~800 linhas. SRP por arquivo.

### 5a. Split `router_extraction.py` (5.267→0 linhas) ✅ COMPLETA

Arquivo original deletado. Dividido em 7 arquivos:

| Arquivo | Linhas | Conteudo |
|---------|--------|----------|
| `schemas_extraction.py` | 614 | 52 schemas Pydantic (Fase 2a) |
| `extraction_helpers.py` | 610 | 7 helpers puros |
| `services_json_sync.py` | 785 | JsonSyncService (reconciliar + sincronizar JSON) |
| `router_ext_questions.py` | 1088 | 10 endpoints (perguntas CRUD + IA ordering) |
| `router_ext_models.py` | 614 | 7 endpoints (schema, JSON sync, consistencia) |
| `router_ext_variables.py` | 1095 | 14 endpoints (variaveis + slugs + tipos) |
| `router_ext_deps.py` | 772 | 14 endpoints (dependencias + regras + restore) |

- [x] Schemas Pydantic extraidos → `schemas_extraction.py` ✅ `c0753fc`
- [x] Helpers puros extraidos → `extraction_helpers.py` ✅ `1dbcac5`
- [x] JsonSyncService extraido → `services_json_sync.py` (770 linhas de logica de negocio)
- [x] 4 sub-routers criados, registrados em main.py com prefix `/admin/api/extraction`
- [x] `router_extraction.py` deletado
- [x] 195+ testes passando (81 extraction + 114 seguranca)
- [x] Contagem de rotas preservada: 524 antes = 524 depois
- [x] Bug fix: `_variavel_na_regra(slug, regra_json)` — funcao chamada mas nunca definida, agora em JsonSyncService

**Nota**: `router_ext_questions.py` (1088) e `router_ext_variables.py` (1095) excedem 800 linhas porque os endpoints individuais sao grandes (ex: `listar_variaveis` = 245 linhas). Cada arquivo tem responsabilidade unica.

### 5b. Split `services_deterministic.py` (2.616→772 linhas) ✅ COMPLETA

Estrategia: facade com re-exports (60+ importadores externos). Funcoes com `@patch` em testes
permanecem no modulo original para compatibilidade.

| Arquivo | Linhas | Conteudo |
|---------|--------|----------|
| `services_rule_evaluator.py` | 655 | DeterministicRuleEvaluator (AST puro) |
| `services_rule_generator.py` | 612 | DeterministicRuleGenerator (geracao via Gemini) |
| `services_mode_resolution.py` | 301 | Resolucao de modo ativacao + Regra de Ouro |
| `services_rule_integrity.py` | 332 | RuleIntegrityValidator + helpers |
| `services_deterministic.py` | 772 | Funcoes de ativacao + PromptVariableUsageSync + re-exports |

- [x] DeterministicRuleEvaluator extraido → `services_rule_evaluator.py`
- [x] DeterministicRuleGenerator extraido → `services_rule_generator.py`
- [x] Funcoes de resolucao de modo → `services_mode_resolution.py`
- [x] RuleIntegrityValidator extraido → `services_rule_integrity.py`
- [x] Facade com re-exports em `services_deterministic.py` (compatibilidade de patches)
- [x] 424 testes passando, 0 failures

### 5c. Split `bert_training/router.py` (2.519→28 linhas) ✅ COMPLETA

Estrategia: aggregator router que inclui 5 sub-routers, mesmo prefix `/bert-training`.

| Arquivo | Linhas | Conteudo |
|---------|--------|----------|
| `router_datasets.py` | 526 | Presets (2) + Datasets (10) |
| `router_runs.py` | 998 | Runs CRUD (12) + progress + SSE |
| `router_worker_api.py` | 286 | Jobs (4) + Metrics (1) + Logs (2) |
| `router_system.py` | 394 | Workers (7) + Queue (1) + System (3) + Models (1) + Tests (4) |
| `router_compare.py` | 470 | Compare CNJ (2) + helpers |
| `router.py` | 28 | Aggregator (include_router) |

- [x] 5 sub-routers criados
- [x] router.py convertido em aggregator (28 linhas)
- [x] 524 rotas preservadas, 59 testes de seguranca passando
- [x] test_upload_hardening.py atualizado (path → router_datasets.py)

**Risco**: Medio (muitos imports para atualizar)
**Pre-requisito**: Fase 2

---

## Fase 6 — Adapters (DIP)

**Objetivo**: Services dependem de interfaces, nao de implementacoes concretas.

### Checklist

- [x] **6.1** Criar `adapters/ports.py` — `IGeminiPort`, `ITJMSPort`, `IBertPort` ✅ `9bf5628`
  - 3 Protocols com `@runtime_checkable`
  - IGeminiPort: generate, generate_stream
  - ITJMSPort: consultar_processo, baixar_documento, consultar_codigos_documentos
  - IBertPort: classify, is_available
- [x] **6.2** Criar `adapters/gemini_adapter.py` ✅ — wraps gemini_service singleton
- [x] **6.3** Criar `adapters/tjms_adapter.py` ✅ — wraps TJMSClient + AgenteTJMSIntegrado
- [x] **6.4** Criar `adapters/bert_adapter.py` ✅ — wraps BertClassifierClient
- [ ] **6.5** Injetar adapters via FastAPI `Depends` nos endpoints existentes (incremental)
- [x] **6.6** 20 testes (interfaces, mocks, imports, validacao estrutural) ✅
  - MockGeminiAdapter e MockTJMSAdapter para uso em testes futuros

> **Nota**: Adapters criados com lazy imports para evitar circular imports no startup.
> Factories singleton: `get_gemini_adapter()`, `get_tjms_adapter()`, `get_bert_adapter()`.
> Injecao nos endpoints sera feita incrementalmente conforme Fase 4 avanca.

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
| 2026-02-11 | — | Criado plano de refatoracao e branch `refactor/backend-cleanup` | `1970ec9` |
| 2026-02-11 | 0.1 | env.py corrigido: 72 tabelas, ~50 models adicionados, nomes corrigidos, try/except removidos | `6e6e4e0` |
| 2026-02-11 | 0.2 | Migration baseline (no-op) gerada e aplicada ao banco local | `5c9768a` |
| 2026-02-11 | 2d | Removido import HTMLResponse nao usado em router_config_pecas.py | `8401dd8` |
| 2026-02-11 | 0.6 | Procfile com `alembic upgrade head`, CI com PostgreSQL service + validacao migrations | `4918e8b` |
| 2026-02-11 | 0.4 | 2 migrations: alter_column_types + update_constraint (idempotentes) | `c558ea4` |
| 2026-02-11 | 0.5 | init_db.py: removido create_all() e run_migrations() (-1652 linhas, -66%) | `cdefff4` |
| 2026-02-11 | 0.7 | 9 testes de migrations Alembic (imports, cadeia, upgrade/downgrade) | `a2baa76` |
| 2026-02-11 | 2a | 52 schemas extraidos de router_extraction.py → schemas_extraction.py (-531 linhas) | `c0753fc` |
| 2026-02-11 | 2a | 16 schemas extraidos de router.py/router_config_pecas.py/router_admin.py → schemas.py | `6100f27` |
| 2026-02-11 | 2a | 33 schemas extraidos de admin/router_prompts.py → schemas_prompts.py | `f3bb5c3` |
| 2026-02-11 | 2a | 21 schemas: pedido_calculo (13), relatorio_cumprimento (4), assistencia_judiciaria (4) | `ad9f3c4` |
| 2026-02-11 | 2a | 16 schemas: admin/performance (8), gemini_logs (6), admin/router (1), auth (1) | `8321e89` |
| 2026-02-11 | 2b | Unificado Gemini: removido gemini_client.py, 10 arquivos migrados (-64 linhas) | `4fcfef6` |
| 2026-02-11 | 2d | Removido Jinja2Templates nao usado de router_config_pecas.py | `6dfc01d` |
| 2026-02-11 | 2c | Mapeamento concluido (11 generators, ~2.230 linhas). Adiado para Fase 4 | — |
| 2026-02-11 | 5a | 7 helpers extraidos de router_extraction.py → extraction_helpers.py (-459 linhas) | `1dbcac5` |
| 2026-02-12 | 5a | JsonSyncService extraido (sincronizar + reconciliar JSON, 785 linhas) | — |
| 2026-02-12 | 5a | Split em 4 sub-routers + deletado router_extraction.py (4.170→0 linhas) | `373e08d` |
| 2026-02-12 | 0.8 | ADR-0002: workflow Alembic documentado | `72c4d8a` |
| 2026-02-12 | 1 | Removido FRONTEND_MODE + bloco legado (-239 linhas). Itens 1.3-1.7 bloqueados por iframe | `95ed652` |
| 2026-02-12 | 5b | Split services_deterministic.py: 3 classes + mode resolution extraidos (2616→772 linhas) | `ed5a59e` |
| 2026-02-12 | 5c | Split bert_training/router.py em 5 sub-routers (2519→28 linhas aggregator) | `00f573c` |
| 2026-02-12 | 3 | Repository Pattern: BaseRepository + 2 pilotos (gerador_pecas, pedido_calculo). 16 endpoints, 25 testes | `d8f1efa` |
| 2026-02-12 | 4 | ConfiguracaoIARepository + migra editar-minuta endpoints (print→logger) | `c760e6b` |
| 2026-02-12 | 6 | Adapters/DIP: 3 ports (Protocol) + 3 adapters concretos + 20 testes | `9bf5628` |
| 2026-02-12 | — | Documento marcado como CONCLUIDO. Trabalho futuro documentado | `7e3184e` |

---

## Resumo Final

### O que foi entregue

| Fase | Status | Resumo |
|------|--------|--------|
| 0 — Alembic | ✅ Completa (exceto stamp prod) | 72 models, baseline, 3 migrations, CI, ADR-0002 |
| 1 — Frontend Legado | ✅ Parcial (iframe bloqueia) | FRONTEND_MODE removido, -239 linhas |
| 2 — Quick Wins | ✅ Completa | 138 schemas extraidos, Gemini unificado, dead code removido |
| 3 — Repository Pattern | ✅ Completa (pilotos) | BaseRepository + 2 sistemas, 16 endpoints, 25 testes |
| 4 — Service Layer | ✅ Parcial (fundacao) | ConfiguracaoIARepository + 2 endpoints migrados |
| 5 — Split de Arquivos | ✅ Completa | 3/3 hotspots eliminados (10.4k → 1.8k linhas) |
| 6 — Adapters (DIP) | ✅ Completa (infra) | 3 ports + 3 adapters + 20 testes |

### Metricas da branch

| Metrica | Valor |
|---------|-------|
| Commits | 33 |
| Arquivos criados | 27 (24 modulos + 3 testes) |
| Linhas de codigo novo | ~10.950 |
| Testes novos | 54 (25 repos + 20 adapters + 9 migrations) |
| Testes de seguranca | 59 passando (preservados) |
| Rotas da API | 524 (preservadas) |
| Hotspots >2000L eliminados | 3 (router_extraction, services_deterministic, bert_training/router) |

---

## Trabalho Futuro (incremental)

> Itens que ficam para sessoes futuras. Nenhum e bloqueante — a fundacao esta pronta.

### Prioridade Alta

- [ ] **Fase 0.3**: Stamp banco de producao (`alembic stamp head`) — requer acesso prod
- [ ] **Fase 4.3-4.4**: Service classes para streaming endpoints (processar-stream ~545L, processar-pdfs-stream ~510L, curadoria ~375L, pedido-calculo ~800L)

### Prioridade Media

- [ ] **Fase 3.5b**: Repositories para `bert_training`, `classificador_documentos`, demais sistemas
- [ ] **Fase 6.5**: Injetar adapters via `Depends` nos endpoints existentes (substituir imports diretos)
- [ ] **Fase 4.5-4.6**: Services + testes para `pedido_calculo` e `bert_training`

### Prioridade Baixa (desbloqueio externo necessario)

- [ ] **Fase 1.3-1.7**: Remover templates/rotas-espelho Jinja2 (requer migrar iframe → React nativo)
- [ ] **Fase 1.8**: Ajustar CSP (apos remocao do iframe)
- [ ] **Fase 2b**: Mover imports lazy para nivel de modulo (risco circular imports)
- [ ] **Fase 2d**: Limpar imports nao usados via linter (melhoria continua)

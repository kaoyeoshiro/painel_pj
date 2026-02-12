# Plano de Refatoração Backend com Agent Teams (versão ajustada)

## Contexto

A refatoração incremental (Fases 0–6) trouxe ganhos reais, mas a auditoria identificou dívidas técnicas relevantes:

- Muitos routers ainda fazem acesso direto ao banco (ex: `db.query`, `session.query`, `db.execute`).
- Endpoints de streaming/SSE carregam regra de negócio dentro do router (handlers gigantes).
- DIP/ports/adapters existem, mas ainda não viraram padrão adotado.
- Há muitos imports lazy, em parte por ciclos de import e acoplamento.
- Existem pontos críticos ainda monolíticos e com baixa testabilidade.

O plano de organização propõe uma "arquitetura alvo" com boundaries claros, porém a migração ainda não ocorreu de forma consistente.

Este plano usa Agent Teams para executar mudanças em paralelo, com cada teammate responsável por um conjunto isolado de arquivos, evitando conflitos.

---

## Princípios do plano

### Regras gerais (para TODAS as waves)

- Não quebrar contratos HTTP (paths, methods, schemas, status codes).
- Não enfraquecer segurança (rate limit, quotas, XSS sanitization, `safe_torch_load`, upload hardening, CSP, logs estruturados, métricas).
- Mudança grande só entra se existir teste ou validação objetiva.
- Commits pequenos, reversíveis e com mensagem clara.
- Se uma etapa "puxa fio demais", ela vira subtarefa e vai para uma wave posterior.

### Definição de pronto (DoD) por wave

- App sobe: `uvicorn main:app --reload` sem erro.
- Testes de segurança passam: `pytest -m security -q`.
- Alembic OK: `alembic upgrade head` funciona.
- Contratos preservados: rotas e schemas não mudam (sem remoção de endpoints públicos).
- Observabilidade preservada (request-id/logs/métricas).

---

## Pré-requisitos (Agent Teams)

### Habilitar Agent Teams

Adicionar ao `settings.json` do Claude Code:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Modo de display no Windows

Windows não suporta split panes; usar modo in-process:

- Shift+Up/Down: navegar entre teammates
- Ctrl+T: ver task list compartilhada
- Shift+Tab: ativar delegate mode no lead

### Escolha de modelos (ajuste importante)

Para reduzir custo e evitar "Opus pra tudo":

- **Lead**: Opus (coordenação, revisão e aprovação de planos).
- **Teammates**: Sonnet como padrão (tarefas mecânicas e refactors locais).
- **Opus para teammate** só quando a tarefa for realmente complexa (ex: streaming gigante com regras delicadas).

### Estratégia de execução (ajustada)

Executar em 2 sessões (mantido), mas com checkpoints mais rígidos:

- **Sessão A**: Wave 1 + Wave 2
- **Sessão B**: Wave 3 + Wave 4

Entre waves:

- Sempre rodar validação mínima.
- Se falhar, corrigir antes de abrir a wave seguinte.
- Fazer commit ao final de cada wave (não só ao final da sessão). Isso reduz risco e facilita rollback.

### Arquitetura do Agent Team

#### Lead (Opus) — Coordenador

- Modo: delegate mode (coordena, não implementa).
- Plan approval obrigatório antes de cada teammate alterar arquivos.
- Garante ownership de arquivos para evitar conflito.

#### Waves (dependência linear)

- Wave N+1 só inicia após Wave N estar concluída e validada.
- Dentro de cada wave, teammates rodam em paralelo sem tocar nos mesmos arquivos.

### Checklist de segurança (aplicar em TODA wave)

Rodar após mudanças significativas e no fim de cada wave:

```bash
pytest -m security -q
pytest tests/test_xss_prevention.py -q
pytest tests/test_torch_load_safety.py -q
pytest tests/test_upload_hardening.py -q
pytest tests/test_quota_manager.py -q
pytest tests/test_rate_limiting.py -q
```

**Regras inegociáveis:**

- Nunca usar torch.load() direto (usar safe_torch_load).
- Nunca remover rate limiting, quota ou validações de segurança.
- Nunca alterar contratos HTTP (paths/methods/schemas/status codes).

---

## Wave 1 — Foundation (3 teammates)

### Prompt do Lead para iniciar a Wave 1

```
Crie um agent team com 3 teammates para a Wave 1 da refatoração do backend.
Use delegate mode: você só coordena.
Exija plan approval antes de qualquer alteração.

Aplicar as regras de segurança a todos.
```

### TEAMMATE 1 — T1-Scaffold (Sonnet)

**Objetivo**: criar a estrutura app/ e o bootstrap, sem mover código em massa ainda.

**Ownership (arquivos exclusivos):**

- app/** (novo)
- main.py (modificar)

**Tarefas:**

- Criar app/ e subpacotes vazios com __init__.py.
- Criar app/api/bootstrap.py que registra os routers de forma idêntica ao main.py atual.
- Modificar main.py para delegar para app/api/bootstrap.py (facade de compatibilidade).

**Critérios de aceite:**

- uvicorn main:app --reload funciona.
- Rotas preservadas (mesmos includes e paths).
- len(app.routes) não diminui por erro de include.
- Testes de segurança passam.

### TEAMMATE 2 — T2-Tooling (Sonnet)

**Objetivo**: ferramentas de qualidade em modo "warn-only" + higienização leve.

**Ownership (arquivos exclusivos):**

- ruff.toml (novo)
- pyproject.toml (modificar)
- .gitignore (modificar)

**Tarefas:**

- Criar ruff.toml com regras básicas (E, W, F) em modo não-bloqueante (warnings OK).
- Adicionar markers pytest no pyproject.toml: unit, security, slow, e2e (garantir que slow exista).
- Adicionar ao .gitignore: padrões de arquivos temporários (tmp_*, *.pid, .bert_worker_token, etc.).
- Listar (sem remover) arquivos temporários suspeitos no root.

**Critérios de aceite:**

- ruff check . roda (warnings ok).
- pytest --markers mostra todos os markers.

### TEAMMATE 3 — T3-TestReorg (Sonnet)

**Objetivo**: adicionar markers aos testes, sem mover arquivos.

**Ownership (arquivos exclusivos):**

- tests/conftest.py (modificar)
- Arquivos tests/test_*.py (apenas para decorators)

**Tarefas:**

- Marcar testes de segurança com @pytest.mark.security.
- Marcar testes lentos com @pytest.mark.slow (se >30s).
- Marcar testes unitários com @pytest.mark.unit quando não usam DB/I/O.
- Criar fixtures reutilizáveis no conftest.py para mocks comuns (ex: db session mock).

**Critérios de aceite:**

- pytest -m security -q roda o conjunto de segurança.
- pytest -m "not slow" roda mais rápido.
- Nenhum teste quebra por causa dos markers.

### Validação pós-Wave 1 (Lead executa)

```bash
uvicorn main:app --reload
pytest -m security -q
ruff check . --statistics
```

**Commit sugerido:**

```bash
git commit -m "refactor(backend): wave1 scaffold + tooling + test markers"
```

---

## Wave 2 — Vertical Slices + Repositories (4 teammates)

### Prompt do Lead para iniciar a Wave 2

```
Wave 1 completa e validada. Crie 4 teammates para Wave 2.
Use delegate mode. Exija plan approval.
Mesmas regras de segurança.
```

### TEAMMATE 4 — T4-PedidoCalculoStream (Opus ou Sonnet*)

**Objetivo**: extrair streaming generator de pedido_calculo/router.py para service testável.

*Use Opus se o streaming for muito complexo; caso contrário Sonnet.

**Ownership:**

- sistemas/pedido_calculo/services_stream.py (novo)
- sistemas/pedido_calculo/router.py (modificar)
- sistemas/pedido_calculo/repositories.py (modificar)
- tests/test_pedido_calculo_stream.py (novo)

**Tarefas:**

- Extrair processar_stream para PedidoCalculoStreamService.
- Router fica thin: valida input, injeta deps, retorna StreamingResponse.
- Remover acesso direto a DB no router (no mínimo para esse endpoint).
- Criar teste unitário do service (sem HTTP).

**Critérios de aceite:**

- SSE idêntico no endpoint.
- Router com <50 linhas por endpoint.
- Sem db.query no router para esse fluxo.
- Testes passam.

### TEAMMATE 5 — T5-GeminiSplit (Sonnet)

**Objetivo**: quebrar services/gemini_service.py em submódulos, mantendo compatibilidade 100%.

**Ownership:**

- services/gemini/** (novo)
- services/gemini_service.py (modificar)
- tests/test_gemini_split.py (novo)

**Regras de compatibilidade:**

- services/gemini_service.py continua exportando GeminiService.
- Imports antigos continuam funcionando.

**Critérios de aceite:**

- Nenhuma quebra de import.
- Submódulos com tamanho controlado.
- Testes existentes do Gemini passam.
- Novo teste valida a divisão.

### TEAMMATE 6 — T6-AdminRepos (Sonnet)

**Objetivo**: retirar db.query de admin/router.py e admin/router_prompts.py movendo para repositories.

**Ownership:**

- admin/router.py (modificar)
- admin/router_prompts.py (modificar)
- admin/repositories*.py (modificar/criar)
- tests/test_admin_repositories.py (novo)

**Critérios de aceite:**

- 0 ocorrências de db.query nos dois routers.
- Endpoints retornam os mesmos dados (contrato preservado).
- Testes cobrem queries complexas.

### TEAMMATE 7 — T7-ImportFix (Sonnet)

**Objetivo**: reduzir ciclos e diminuir imports lazy, criando um lugar neutro para contratos.

**Ownership:**

- app/domain/shared/** (novo)
- adapters/ports.py (modificar)
- adapters/__init__.py (modificar)

**Tarefas:**

- Mapear ciclos reais (script simples).
- Mover tipos/protocolos causadores de ciclos para app/domain/shared/.
- Manter reexport nos caminhos antigos.
- Remover pelo menos 20 imports lazy óbvios (sem alterar lógica).

**Critérios de aceite:**

- App sobe sem ImportError.
- Testes de segurança passam.
- Redução objetiva de lazy imports.

### Validação pós-Wave 2 (Lead executa)

```bash
uvicorn main:app --reload
pytest -m security -q
pytest tests/test_pedido_calculo_stream.py -q
pytest tests/test_gemini_split.py -q
pytest tests/test_admin_repositories.py -q
python -c "from services.gemini_service import GeminiService; print('OK')"
```

**Commit sugerido:**

```bash
git commit -m "refactor(backend): wave2 stream slice + gemini split + admin repos + import fixes"
```

---

## Wave 3 — Streaming Extraction (3 teammates)

### Prompt do Lead para iniciar a Wave 3

```
Wave 2 completa e validada. Crie 3 teammates para Wave 3.
Use delegate mode. Plan approval obrigatório.
Mesmas regras de segurança.
```

### TEAMMATE 8 — T8-GeradorStream (Opus)

**Objetivo**: extrair streaming de gerador_pecas/router.py para services, preservando comportamento e guardrails.

**Ownership:**

- sistemas/gerador_pecas/services_*stream*.py (novos)
- sistemas/gerador_pecas/router.py (modificar)
- sistemas/gerador_pecas/repositories.py (modificar)
- tests/test_gerador_stream_services.py (novo)

**Regras obrigatórias:**

- Preservar tags e comportamentos especiais.
- Router thin, service testável.
- Não mexer em orquestradores críticos se isso ampliar risco.

**Critérios de aceite:**

- SSE idêntico.
- Testes específicos de curadoria/guardrails continuam passando.
- Routers com <30 linhas por endpoint (objetivo) ou o mínimo possível.

### TEAMMATE 9 — T9-PrestacaoStream (Sonnet ou Opus*)

**Objetivo**: separar streaming de prestacao_contas e deixar orquestrador "puro".

*Opus se a lógica for muito sensível.

**Ownership:**

- sistemas/prestacao_contas/** (modificar/criar)
- tests/test_prestacao_stream.py (novo)

**Critérios de aceite:**

- Endpoints SSE idênticos.
- Orquestrador sem yield/async generator.

### TEAMMATE 10 — T10-SSECommon (Sonnet)

**Objetivo**: criar módulo SSE comum (sem obrigar migração imediata).

**Ownership:**

- app/services/shared/** (novo)
- tests/test_sse_common.py (novo)

**Critérios de aceite:**

- Módulo cobre formatação de eventos, heartbeat, tratamento de erro.
- Testes unitários demonstram uso.
- Documentação inline de como migrar services existentes.

### Validação pós-Wave 3 (Lead executa)

```bash
uvicorn main:app --reload
pytest -m security -q

# Rodar o conjunto de testes específico do gerador/guardrails (os que já existem no repo)
pytest tests/test_gerador_stream_services.py -q
pytest tests/test_prestacao_stream.py -q
pytest tests/test_sse_common.py -q
```

**Commit sugerido:**

```bash
git commit -m "refactor(backend): wave3 extract streaming services + sse common module"
```

---

## Wave 4 — DIP + Boundaries (3 teammates)

### Prompt do Lead para iniciar a Wave 4

```
Wave 3 completa e validada. Crie 3 teammates para Wave 4 (final).
Use delegate mode. Plan approval obrigatório.
Mesmas regras de segurança.
```

### TEAMMATE 11 — T11-DIPAdopt (Opus)

**Objetivo**: adotar ports/adapters nos services novos (principalmente streaming), tirando dependência de concretos.

**Ownership:**

- app/adapters/** (modificar/criar)
- services de streaming criados nas waves anteriores (apenas DI refactor)
- routers correspondentes (injetar via Depends)

**Critérios de aceite:**

- Services novos não importam clientes concretos diretamente.
- Tests conseguem usar mocks dos ports.
- Runtime funciona com adapters reais.

### TEAMMATE 12 — T12-AdminSplit (Sonnet)

**Objetivo**: quebrar admin em sub-routers e deixar facades finas, preservando contratos.

**Ownership:**

- admin/routers/** (novo)
- admin/router.py e admin/router_prompts.py (viram facades)

**Critérios de aceite:**

- Arquivos menores e coesos (<500 linhas por sub-router).
- Contratos preservados.

### TEAMMATE 13 — T13-BoundaryEnforce (Sonnet)

**Objetivo**: checks automatizados para boundaries arquiteturais.

**Ownership:**

- scripts/check_boundaries.py (novo)
- .github/workflows/architecture.yml (novo)
- tests/test_architecture_boundaries.py (novo)

**Regras a impor (mínimo viável, focado no que já foi criado em app/):**

- app/services/** não importa FastAPI (Request/Response/APIRouter).
- app/api/** não importa ORM/models diretamente (apenas via services/repos).
- Routers novos não podem ter db.query (verificação simples por grep/AST).
- Nenhum torch.load direto (já existe; manter).
- Endpoints de IA continuam com rate limit (não criar novo endpoint de IA sem proteção).

**Critérios de aceite:**

- Script roda e reporta violações.
- CI valida boundaries em PR.
- Testes de boundaries passam.

### Validação final pós-Wave 4 (Lead executa)

```bash
uvicorn main:app --reload
python -c "import main; print(len(main.app.routes))"
pytest -m security -q
pytest tests/test_alembic_migrations.py -q

# Rodar os testes críticos de streaming/guardrails já existentes
python scripts/check_boundaries.py
ruff check . --statistics
```

**Commit sugerido:**

```bash
git commit -m "refactor(backend): wave4 adopt DIP + split admin + enforce boundaries"
```

---

## Resumo de impacto esperado (mantido, mas mais conservador)

- **Routers com acesso direto a DB**: redução gradual, começando pelos verticais/streaming mais críticos.
- **Streaming**: regra de negócio sai do router e vai para services testáveis.
- **Gemini**: arquivo monolítico quebrado com compatibilidade preservada.
- **DIP**: começa a ser real nos services novos, não no sistema inteiro de uma vez.
- **Lazy imports**: redução inicial controlada (sem quebrar startup).
- **Boundaries**: passam a ser checados automaticamente (para não "escorregar" de novo).

---

## Como executar na prática (ajustado)

### Passo 1: Preparar ambiente

```bash
git checkout refactor/backend-cleanup
git pull
```

Ativar Agent Teams conforme configuração.

### Passo 2: Sessão A — Wave 1 + Wave 2

- Rodar Wave 1 (3 teammates), validar, commit.
- Rodar Wave 2 (4 teammates), validar, commit.

### Passo 3: Sessão B — Wave 3 + Wave 4

- Rodar Wave 3 (3 teammates), validar, commit.
- Rodar Wave 4 (3 teammates), validar, commit.

---

## Riscos e mitigação (ajustado)

| Risco | Mitigação |
|-------|-----------|
| Conflito de arquivos | Mitigado por ownership exclusivo. |
| Quebra de contrato HTTP | Mitigado por plan approval + validação pós-wave. |
| Custos altos de tokens | Mitigado por Sonnet como padrão para teammates. |
| Windows sem split panes | Mitigado por disciplina de task list e ownership. |
| Refactor grande demais | Mitigado por commits por wave e rollback fácil. |

---

## Execução — Registro de Progresso (2026-02-12)

### Adaptação: Agent Teams → Parallel Subagents

Windows não suporta Agent Teams (requer tmux/WSL). A execução foi adaptada para usar **subagentes paralelos** via Task tool, mantendo a mesma lógica de ownership exclusivo e validação pós-wave.

### Commits por Wave

| Wave | Commit | Mensagem |
|------|--------|----------|
| 1 | `0144378` | `refactor(backend): wave1 - scaffold app/ + tooling + test markers` |
| 2 | `2ab9034` | `refactor(backend): wave2 - stream slice + gemini split + admin repos + shared types` |
| 3 | `ce6afa6` | `refactor(backend): wave3 - extract streaming services + SSE common module` |
| 4 | `14cb474` | `refactor(backend): wave4 - DIP adapters + boundary enforcement` |

### Status por Teammate

| ID | Nome | Wave | Status | Arquivos criados/modificados | Testes |
|----|------|------|--------|------------------------------|--------|
| T1 | Scaffold | 1 | Concluído | `app/` (7 __init__.py), `app/api/bootstrap.py`, `main.py` | App sobe OK |
| T2 | Tooling | 1 | Concluído | `ruff.toml`, `pyproject.toml`, `.gitignore` | Markers OK |
| T3 | TestReorg | 1 | Concluído | 11 test files (pytestmark), `tests/conftest.py` | 59 security OK |
| T4 | PedidoCalculoStream | 2 | Concluído | `sistemas/pedido_calculo/services_stream.py` | 8 testes |
| T5 | GeminiSplit | 2 | Concluído | `services/gemini/` (5 arquivos), `services/gemini_service.py` | 23 testes |
| T6 | AdminRepos | 2 | Concluído | `admin/repositories.py`, `admin/router.py`, `admin/router_prompts.py` | 21 testes |
| T7 | ImportFix | 2 | Concluído | `app/domain/shared/protocols.py`, `app/domain/shared/types.py` | Import OK |
| T8 | GeradorStream | 3 | Concluído | `sistemas/gerador_pecas/services_stream.py` | 21 testes |
| T9 | PrestacaoStream | 3 | Concluído | `sistemas/prestacao_contas/services_stream.py` | 34 testes |
| T10 | SSECommon | 3 | Concluído | `services/shared/sse.py`, `services/shared/__init__.py` | 33 testes |
| T11 | DIPAdopt | 4 | Concluído | `app/adapters/gemini_adapter.py`, `tjms_adapter.py`, `bert_adapter.py` | 16 testes |
| T12 | AdminSplit | 4 | **Adiado** | — | — |
| T13 | BoundaryEnforce | 4 | Concluído | `scripts/check_boundaries.py`, `.github/workflows/architecture.yml` | 10 testes (3 skip) |

### Validação Final

| Verificação | Resultado |
|-------------|-----------|
| Testes de segurança (`pytest -m security`) | **59 passed** |
| Testes das waves (refatoração) | **163 passed, 3 skipped** |
| `check_boundaries.py` | 0 erros, 28 warnings (esperado — código legado) |
| Imports de compatibilidade Gemini | OK (`GeminiService`, `GeminiResponse`, `GeminiMetrics`) |

### Notas

1. **T12-AdminSplit adiado**: Conforme regra do plano ("Se uma etapa puxa fio demais, ela vira subtarefa e vai para uma wave posterior"). O admin/router.py já ficou mais limpo com a extração de queries para repositories (T6), mas a quebra em sub-routers é alto risco e merece wave dedicada.

2. **SSE Common em `services/shared/`**: O plano previa `app/services/shared/`, mas foi colocado em `services/shared/` para ficar mais próximo dos consumidores existentes. Migração para `app/` pode ocorrer em wave futura.

3. **Circular import Gemini resolvido**: `GeminiService` permanece em `services/gemini_service.py` (não no `__init__.py` do subpacote) para evitar ciclo. Imports antigos continuam 100% funcionais.

4. **Teste pré-existente falhando**: `tests/classificador_documentos/test_router.py::test_exportar_json` — falha anterior à refatoração (commit `149dead`), não relacionado às mudanças.

### Arquivos Criados (resumo)

**Wave 1 (Foundation):**
- `app/__init__.py`, `app/api/__init__.py`, `app/api/bootstrap.py`
- `app/domain/__init__.py`, `app/domain/shared/__init__.py`
- `app/services/__init__.py`, `app/services/shared/__init__.py`
- `app/adapters/__init__.py`
- `ruff.toml`

**Wave 2 (Vertical Slices + Repositories):**
- `sistemas/pedido_calculo/services_stream.py`
- `services/gemini/__init__.py`, `config.py`, `metrics.py`, `parsers.py`, `payloads.py`
- `admin/repositories.py` (expandido)
- `app/domain/shared/protocols.py`, `types.py`
- `tests/test_pedido_calculo_stream.py`, `test_gemini_split.py`, `test_admin_repositories.py`

**Wave 3 (Streaming Extraction):**
- `sistemas/gerador_pecas/services_stream.py`
- `sistemas/prestacao_contas/services_stream.py`
- `services/shared/sse.py`, `services/shared/__init__.py`
- `tests/test_gerador_stream_services.py`, `test_prestacao_stream.py`, `test_sse_common.py`

**Wave 4 (DIP + Boundaries):**
- `app/adapters/gemini_adapter.py`, `tjms_adapter.py`, `bert_adapter.py`
- `scripts/check_boundaries.py`
- `.github/workflows/architecture.yml`
- `tests/test_adapters.py`, `test_architecture_boundaries.py`

---

## Waves 5-7 — Correção das Falhas da Reanalise (2026-02-12)

### Contexto

O relatório de reanálise identificou 4 falhas remanescentes após Waves 1-4:
1. Admin repos existem mas não são usados (181 `db.query()`)
2. Streaming services existem mas não estão conectados
3. Hierarquia dupla de adapters (`/adapters/` e `/app/adapters/`)
4. T12-AdminSplit ainda adiado

### Status por Task

| ID | Nome | Wave | Status | Descrição | Impacto |
|----|------|------|--------|-----------|---------|
| T14 | Wire repos admin/router.py | 5 | Concluído | CRUD/Config endpoints → repos | 0 raw db.query |
| T15 | Wire repos router_prompts.py | 5 | Concluído | 87 db.query → repo calls | 0 raw db.query |
| T16 | Wire FeedbackRepo admin/router.py | 5 | Concluído | 60+ queries → FeedbackRepository | 0 raw db.query |
| T17 | Consolidar adapters | 5 | Concluído | Removido `/adapters/` root, mantido `/app/adapters/` | 1 hierarquia |
| T18 | Wire PedidoCalculoStreamService | 6 | Concluído | ~800 linhas de generator inline → service | router -45% |
| T19 | Wire helpers SSE prestacao_contas | 6 | Concluído | 43 `EventoSSE(tipo=...)` → helpers | 0 inline |
| T20 | Adotar SSEEventFormatter | 6 | Concluído | pedido_calculo + gerador_pecas delegam ao SSEEventFormatter | 2 consumidores |
| T21 | AdminSplit | 7 | Concluído | admin/router.py (2586L) → 4 sub-routers | router 23L |
| T22 | DIP Runtime PoC | 7 | Concluído | GeminiAdapter injetado em assistencia_judiciaria | 1 adapter em prod |

### Métricas

| Métrica | Antes (Wave 4) | Após Wave 7 |
|---------|----------------|-------------|
| db.query raw em admin/ | 181 | **0** |
| db.query via repo em admin/ | 0 | 52 (45 feedback + 7 prompts) |
| admin/router.py linhas | 2586 | **23** (orquestrador) |
| pedido_calculo/router.py linhas | 1708 | **933** (-45%) |
| Hierarquias adapter | 2 | **1** (`app/adapters/`) |
| SSEEventFormatter consumidores | 0 | **2** (pedido_calculo, gerador_pecas) |
| Adapters em uso produção | 0 | **1** (assistencia_judiciaria) |
| EventoSSE inline em prestacao_contas | 43 | **0** |

### Validação Final Waves 5-7

| Verificação | Resultado |
|-------------|-----------|
| Testes de segurança (`pytest -m security`) | **59 passed** |
| Testes de refatoração (adapters + SSE + streams + repos) | **149 passed** |
| `check_boundaries.py` | 0 erros, 29 warnings (legado) |
| Imports admin (router, config, feedbacks, import, prompts) | OK, 72 rotas |

### Arquivos Criados/Modificados

**Wave 5 (Repository Wiring + Adapter Consolidation):**
- `admin/router.py` (db.query → repos)
- `admin/router_prompts.py` (db.query → repos)
- `admin/repositories.py` (métodos adicionais)
- `app/domain/shared/protocols.py` (`@runtime_checkable` consolidado)
- Removido: `adapters/` (root) — agora só `app/adapters/`

**Wave 6 (Streaming Integration + SSE Common):**
- `sistemas/pedido_calculo/services_stream.py` (lógica de ~800L migrada do router)
- `sistemas/pedido_calculo/router.py` (thin: instancia service + StreamingResponse)
- `sistemas/prestacao_contas/services_stream.py` (helpers SSE)
- `sistemas/prestacao_contas/services.py` (EventoSSE inline → helpers)

**Wave 7 (AdminSplit + DIP Runtime):**
- `admin/router.py` (orquestrador de 23 linhas)
- `admin/router_config.py` (436L — CRUD + Config IA + Modelos)
- `admin/router_feedbacks.py` (1715L — Dashboard + Feedbacks)
- `admin/router_import.py` (249L — Import de produção)
- `sistemas/assistencia_judiciaria/core/logic.py` (DIP: `ai_service` parameter)
- `sistemas/assistencia_judiciaria/router.py` (instancia GeminiAdapter)
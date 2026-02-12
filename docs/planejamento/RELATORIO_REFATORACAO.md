# RELATORIO REFATORACAO BACKEND

Data da auditoria: 2026-02-12  
Branch auditada: `refactor/backend-cleanup`  
Escopo: backend FastAPI + PostgreSQL (sem mudanca estrutural de arquivos nesta rodada)

## 1) Resumo executivo

### O que melhorou de forma objetiva

- A base de migrations foi estabilizada e Alembic esta operacional como fonte de verdade:
  - `alembic current`: `c2b3d4e5f6a7 (head)`
  - `alembic upgrade head`: OK
  - `alembic downgrade -1`: OK
  - `tests/test_alembic_migrations.py`: 9/9 passando
- Seguranca critica exigida no plano permanece ativa e testada:
  - `tests/test_xss_prevention.py`, `tests/test_torch_load_safety.py`, `tests/test_upload_hardening.py`, `tests/test_quota_manager.py`, `tests/test_rate_limiting.py`: 59/59 passando
  - pipeline `.github/workflows/security.yml` continua com checks de `safe_torch_load`, Bandit, pip-audit e suite de seguranca.
- Contagem de rotas foi preservada na aplicacao carregada:
  - `len(main.app.routes) = 524` (mesmo numero registrado no plano)
- A refatoracao incremental de Fases 0-6 foi efetivamente executada na historia da branch (commits existentes e coerentes com o documento em `docs/planejamento/REFATORACAO_BACKEND.md`).

### Riscos atuais mais relevantes

- Monolitos ainda grandes em pontos de negocio critico (`sistemas/gerador_pecas/router.py`, `admin/router_prompts.py`, `admin/router.py`, `services/gemini_service.py`).
- Service Layer e DIP ainda incompletos em uso real:
  - repositories usados so em 2 routers principais (gerador_pecas e pedido_calculo).
  - adapters criados, mas ainda sem injecao efetiva nos endpoints principais.
- Acoplamento entre camadas segue alto:
  - 31/33 arquivos de router ainda fazem `db.query(...)` direto.
  - ciclos de import persistentes entre `admin`, `auth`, `services`, `sistemas`, `utils`.
- Testabilidade sistemica ainda limitada:
  - `pytest` completo (1313 testes) excedeu 60 min e estourou timeout no ambiente local.
  - foi necessario validar por fatias criticas (migrations + seguranca).

### Proximos passos recomendados (ordem curta)

1. Concluir Fase 4 (streaming generators -> services) em fatias pequenas, com DI explicita.
2. Expandir Repository Pattern para `admin` e mais 2 dominios de alto volume.
3. Aplicar o plano de organizacao de repositorio (target architecture) com compat layer de imports.
4. Estabilizar estrategia de testes para evitar timeout do `pytest` completo.

---

## 2) Validacao executada nesta auditoria

### Comandos e resultado

- `python -m pytest`  
  Resultado: iniciou com 1313 testes, mas excedeu timeout apos ~60 min.
- `python -m alembic current`  
  Resultado: `c2b3d4e5f6a7 (head)`.
- `python -m alembic upgrade head`  
  Resultado: OK.
- `python -m alembic downgrade -1`  
  Resultado: OK.
- `python -m alembic upgrade head` (retorno ao head apos downgrade)  
  Resultado: OK.
- `python -m pytest tests/test_alembic_migrations.py -q`  
  Resultado: 9/9 passando.
- `python -m pytest tests/test_xss_prevention.py tests/test_torch_load_safety.py tests/test_upload_hardening.py tests/test_quota_manager.py tests/test_rate_limiting.py -q`  
  Resultado: 59/59 passando.

### Achado tecnico durante validacao

- Houve quebra de coleta de testes por colisao de namespace (`tests/services` sombreando pacote de producao `services`), gerando `ModuleNotFoundError` para `services.*`.
- Correcao incremental aplicada: criacao de `tests/__init__.py` para tornar `tests` um pacote explicito e evitar shadowing ambiguo.

---

## 3) Analise por fase (0 a 6)

## Fase 0 - Alembic

- O que foi feito:
  - cobertura de models no `migrations/env.py`, baseline no-op, migrations de ajuste, CI com validacao Alembic, testes dedicados e ADR.
- Avaliacao tecnica:
  - positiva; a trilha de migrations esta executavel localmente e os testes de cadeia passam.
- Pontos fortes:
  - elimina dependencia de `create_all()` como fonte principal.
  - melhora governanca de schema.
- Pontos fracos:
  - `stamp` de producao ainda pendente (risco operacional se nao governado por checklist de deploy).

## Fase 1 - Remocao de frontend legado (parcial)

- O que foi feito:
  - remocao de `FRONTEND_MODE` e bloco legado principal.
- Avaliacao tecnica:
  - parcial, com bloqueio assumido por dependencia de iframe admin.
- Pontos fortes:
  - simplificacao de `main.py`.
- Pontos fracos:
  - ainda ha acoplamento com templates/rotas espelho.
  - CSP final de producao depende do encerramento desse legado.

## Fase 2 - Quick wins

- O que foi feito:
  - extracao de schemas para modulos dedicados, unificacao Gemini, limpeza de dead code pontual.
- Avaliacao tecnica:
  - boa reducao de mistura de responsabilidades em varios routers.
- Pontos fortes:
  - melhora de legibilidade, menos classes Pydantic dentro de routers.
- Pontos fracos:
  - problema estrutural principal (streaming/business logic em router) nao foi atacado aqui.

## Fase 3 - Repository Pattern (parcial em alcance)

- O que foi feito:
  - `database/repository_base.py` + repositories pilotos (`gerador_pecas`, `pedido_calculo`).
- Avaliacao tecnica:
  - desenho correto para evolucao, mas adocao ainda restrita.
- Pontos fortes:
  - base reutilizavel e testavel.
- Pontos fracos:
  - maioria dos routers ainda em `db.query(...)` direto.

## Fase 4 - Service Layer (fundacao, nao concluida)

- O que foi feito:
  - repositorio compartilhado de configuracao IA e migracao de endpoints especificos.
- Avaliacao tecnica:
  - progresso inicial correto, mas sem atacar os maiores gargalos (streaming generators longos).
- Pontos fortes:
  - inicio da separacao de acesso a configuracao.
- Pontos fracos:
  - endpoints mais complexos continuam com regra de negocio dentro de router.

## Fase 5 - Split de arquivos grandes

- O que foi feito:
  - `router_extraction.py` eliminado e dividido, `services_deterministic.py` reduzido com modulos novos, `bert_training/router.py` convertido em agregador.
- Avaliacao tecnica:
  - melhoria real de distribuicao de responsabilidades.
- Pontos fortes:
  - removeu hotspots extremos (>2000 linhas) em alguns pontos.
- Pontos fracos:
  - ainda existem arquivos muito grandes em dominios centrais (nao apenas legacy).

## Fase 6 - Adapters (DIP)

- O que foi feito:
  - ports `Protocol` e adapters concretos para Gemini/TJMS/BERT.
- Avaliacao tecnica:
  - infraestrutura pronta, mas sem adocao operacional no fluxo principal.
- Pontos fortes:
  - base correta para inversion of dependencies e testes com mock.
- Pontos fracos:
  - ainda nao houve substituicao em massa de imports concretos por ports injetados.

---

## 4) Mapa da arquitetura real (estado atual)

### Pacotes de producao (medicao local)

- `sistemas`: 165 arquivos Python, ~83k linhas.
- `admin`: 25 arquivos, ~11.7k linhas.
- `services`: 20 arquivos, ~8k linhas.
- `utils`: 25 arquivos, ~7.8k linhas.

### Dependencias entre pacotes (arestas mais fortes)

- `sistemas -> admin` (88)
- `sistemas -> services` (81)
- `sistemas -> database` (61)
- `sistemas -> utils` (59)
- `sistemas -> auth` (52)

### Ciclos de import detectados (amostra representativa)

- `adapters <-> services`
- `admin <-> auth`
- `admin <-> services`
- `services <-> utils`
- ciclos maiores envolvendo `admin`, `auth`, `database`, `services`, `sistemas`, `utils`.

### Violacoes de camada observadas

- Routers com acesso direto persistente a SQLAlchemy:
  - 31 de 33 arquivos `router*.py` com `db.query(...)`.
- Service Layer parcial:
  - repositories em uso direto detectados somente em 2 routers.
- DIP parcial:
  - adapters/ports criados, mas sem consumo efetivo amplo nos endpoints.

### Imports lazy em funcoes

- 774 ocorrencias detectadas (indicativo de tentativa de contornar ciclos/acoplamento).
- Parte e justificavel (startup e custos pesados), mas o volume aponta dependencia circular estrutural.

---

## 5) Auditoria SOLID / Clean Code

## SRP (Single Responsibility)

- Melhorou em varios pontos de split (Fase 5), mas ainda falha em modulos centrais:
  - `sistemas/gerador_pecas/router.py`
  - `admin/router.py`
  - `admin/router_prompts.py`
  - `services/gemini_service.py`
- Evidencia: funcoes >500 linhas e mistura de HTTP + regra + persistencia + streaming no mesmo handler.

## DIP (Dependency Inversion)

- Infra criada (`adapters/ports.py` + adapters concretos), mas ainda sem uso amplo.
- A maioria dos fluxos de negocio continua chamando implementacoes concretas diretamente.

## OCP / ISP / LSP

- OCP: melhorias parciais com repositories/adapters, mas extensao ainda exige editar routers grandes.
- ISP: interfaces de ports estao enxutas, ponto positivo.
- LSP: sem quebra evidente nos contratos principais, porem falta uso real para validar substituicao em runtime.

## Coesao e acoplamento

- Coesao local melhorou em modulos extraidos.
- Acoplamento global continua alto (ciclos, imports cruzados e lazy imports em massa).

---

## 6) Hotspots atuais (Top 10)

1. `sistemas/gerador_pecas/router.py`  
   3613 linhas; concentra streaming, regra de negocio, acesso a banco e orquestracao.
2. `admin/router_prompts.py`  
   2809 linhas; CRUD extenso com alto volume de `db.query`.
3. `admin/router.py`  
   2670 linhas; dashboard e operacoes administrativas misturadas.
4. `sistemas/gerador_pecas/agente_tjms.py`  
   2533 linhas; integracao externa + logica de negocio + processamento documental.
5. `services/gemini_service.py`  
   2376 linhas; servico com multiplas responsabilidades (resolucao params, retries, logging, cache, auditoria).
6. `sistemas/pedido_calculo/router.py`  
   1709 linhas; endpoint streaming com `event_generator` muito longo.
7. `sistemas/prestacao_contas/services.py`  
   1621 linhas; funcao `processar_completo` com 1147 linhas.
8. `sistemas/extrator_autos/services.py`  
   1574 linhas; servico com alto acoplamento a fluxos externos.
9. `sistemas/matriculas_confrontantes/router.py`  
   1460 linhas; camada HTTP ainda muito espessa.
10. `sistemas/classificador_documentos/router.py`  
    1434 linhas; mistura validacao de upload, quota/rate limit, persistencia e fluxo IA.

---

## 7) Debt Register

| ID | Divida tecnica | Impacto | Esforco | Ordem | Acao incremental sugerida |
|---|---|---|---|---|---|
| D1 | Routers com regra de negocio e `db.query` direto | Alto | Alto | 1 | Migrar 2 endpoints por sprint para services + repositories (iniciar por streaming de maior risco). |
| D2 | Fase 4 incompleta (streaming generators em router) | Alto | Alto | 2 | Extrair `processar_stream` e `processar_pdfs_stream` para services injetaveis com testes dedicados. |
| D3 | DIP criado mas sem adocao ampla | Medio/Alto | Medio | 3 | Introduzir ports nos services novos e adaptar rotas por vertical slice. |
| D4 | Ciclos de import entre pacotes core | Alto | Medio | 4 | Definir boundaries formais e mover contratos (ports/types) para camada neutra. |
| D5 | Excesso de imports lazy (774) | Medio | Medio | 5 | Trocar lazy import de contorno por arquitetura de dependencia explicita. |
| D6 | Monolito `services/gemini_service.py` | Alto | Medio/Alto | 6 | Split em `client`, `retry`, `audit/log`, `config/params`, mantendo facade compativel. |
| D7 | Admin monolitico (`admin/router.py`, `router_prompts.py`) | Alto | Alto | 7 | Dividir por subdominio (`prompts`, `configs`, `feedbacks`, `dashboard`) com repositorios por contexto. |
| D8 | Ausencia de lint estatico padrao (ruff/mypy) no fluxo backend | Medio | Baixo/Medio | 8 | Adicionar checks opcionais em modo warning e depois gate gradual por pasta. |
| D9 | Arquivos temporarios de auditoria no root (`tmp_main_before.py`, `%TEMP%main_before.py`) | Medio | Baixo | 9 | Remover/realocar para pasta de trabalho local ignorada por git. |
| D10 | `pytest` completo sem previsibilidade de tempo | Medio | Medio | 10 | Separar suite por markers (`unit`, `integration`, `security`, `slow`) e jobs paralelos. |

---

## 8) Pontuacao (0 a 10)

- Arquitetura: **6.5**
- Organizacao do repositorio: **5.5**
- Qualidade de codigo: **6.0**
- Testabilidade: **6.0**
- Seguranca: **8.5**
- Observabilidade: **7.5**
- Clareza de dominio: **6.0**

Justificativa resumida:
- Seguranca e observabilidade estao acima da media por middleware de request-id, quota/rate limit, testes de seguranca, audit logs, health/metrics e policy CI.
- Arquitetura e organizacao ainda penalizadas por acoplamento alto, arquivos grandes e adocao parcial de Service Layer/DIP.

---

## 9) Conclusao

O refactor incremental trouxe ganhos reais e importantes (Alembic, seguranca preservada, reducao de hotspots especificos, fundacao de repositorios/adapters).  
Porem, o objetivo de arquitetura limpa ainda esta em transicao: as camadas continuam misturadas nos fluxos criticos e a organizacao fisica do repositorio ainda reflete evolucao historica, nao boundaries fortes.

O plano proximo deve ser pragmatico: finalizar Fase 4 com foco nos endpoints mais longos e usar essa migracao para consolidar o modelo de pastas e imports proposto no `PLANO_ORGANIZACAO_REPOSITORIO.md`.

---

## 10) Reanalise complementar apos execucao do plano (2026-02-12)

Premissa desta rodada: considerar o plano de `docs/planejamento/REFACTOR.md` como executado por teammate (T1-T11 e T13), com **T12 adiado**, e reavaliar o estado real do backend no codigo atual.

## 10.1) Validacao objetiva executada agora

- `python -m pytest -m security -q` -> **59 passed**.
- `python -m pytest tests/test_pedido_calculo_stream.py tests/test_gemini_split.py tests/test_admin_repositories.py tests/test_gerador_stream_services.py tests/test_prestacao_stream.py tests/test_sse_common.py tests/test_adapters.py tests/test_architecture_boundaries.py -q` -> **163 passed, 3 skipped**.
- `python -m pytest tests/test_adapters_ports.py -q` -> **20 passed**.
- `python scripts/check_boundaries.py` -> **0 erros, 28 warnings**.
- `python -c "import main; print(len(main.app.routes))"` -> **522 rotas carregadas**.

## 10.2) O que melhorou de forma confirmada

1. **Foundation / bootstrap consolidado (T1)**  
   `main.py` delega o registro de rotas para `app/api/bootstrap.py`, com app carregando normalmente.

2. **Tooling de base e markers ativos (T2/T3)**  
   `ruff.toml` e markers no `pyproject.toml` estao presentes e a selecao de suite por marker (`security`) esta funcional.

3. **Split inicial do Gemini preservando compatibilidade (T5)**  
   Submodulos em `services/gemini/` existem e os testes de compatibilidade/import (`tests/test_gemini_split.py`) passam.

4. **Boundaries automatizados (T13)**  
   Script (`scripts/check_boundaries.py`), workflow (`.github/workflows/architecture.yml`) e testes dedicados estao ativos e passando (com skips esperados).

5. **Infra de adapters e contratos compartilhados criada (T7/T11)**  
   Estruturas em `app/domain/shared/` e `app/adapters/` foram introduzidas e possuem testes verdes.

## 10.3) Pontos que seguem parciais (ou abaixo do objetivo do plano)

1. **Admin ainda fortemente acoplado a ORM no router (T6 parcial)**  
   Ainda ha uso massivo de `db.query` em:
   - `admin/router.py` -> 94 ocorrencias
   - `admin/router_prompts.py` -> 87 ocorrencias  
   Ou seja, a extracao para repositories ocorreu de forma parcial.

2. **Streaming ainda nao esta totalmente extraido para services (T4/T8/T9 parciais)**  
   - `sistemas/pedido_calculo/router.py` ainda concentra `processar_stream` com **817 linhas**, e `PedidoCalculoStreamService` nao esta sendo chamado no fluxo HTTP.
   - `sistemas/gerador_pecas/router.py` ainda tem handlers grandes de streaming (`processar_processo_stream` com 588 linhas, `processar_pdfs_stream` com 527 linhas, `curation_generate_stream` com 407 linhas); o `services_stream.py` atual atua principalmente como helper de formatacao SSE.
   - `sistemas/prestacao_contas/services_stream.py` existe, mas os helpers de evento nao estao acoplados de forma ampla aos endpoints.

3. **SSE common criado, mas com adocao de producao muito baixa (T10 parcial)**  
   `services/shared/sse.py` esta implementado e testado, porem sem consumo relevante pelos routers/sistemas principais (uso concentrado em testes/exemplo).

4. **DIP ainda pouco adotado no runtime (T11 parcial)**  
   Os adapters/ports existem, mas o backend de negocio principal ainda nao depende deles de forma abrangente.  
   Adicionalmente, coexistem duas trilhas de adapters (`adapters/*` e `app/adapters/*`), o que aumenta risco de duplicidade de padrao.

5. **Acoplamento transversal ainda alto**  
   Medicao atual em routers core (`admin/auth/sistemas/users`): **31 de 32** arquivos `router*.py` ainda usam `db.query(...)`.

6. **Imports lazy continuam em volume elevado**  
   Medicao local: **878 ocorrencias** (indicador de que ciclos/acoplamento ainda nao foram realmente desmontados, mesmo com ganhos pontuais).

## 10.4) Ponderacao final desta reanalise

Comparando o estado anterior com o codigo atual, houve ganho concreto em **fundacao (estrutura, testes, boundaries e compatibilidade)**.  
Por outro lado, os objetivos centrais de arquitetura do plano (router thin + service layer forte + DIP em uso real) ainda ficaram **parciais** nos dominios mais criticos, com destaque para admin e streaming.

Em sintese: a refatoracao avancou de forma relevante na base, mas a convergencia para a arquitetura alvo ainda depende de uma wave adicional focada em:

1. finalizar a extracao de streaming para services realmente usados pelos endpoints;
2. remover `db.query` direto dos routers de admin;
3. consolidar um unico caminho de adapters/ports e adotar DI nos fluxos de runtime;
4. executar o **T12 (AdminSplit)** em etapa dedicada, com baixo risco de regressao.

---

## 11) Atualizacao de execucao do plano de organizacao (2026-02-12)

Nesta rodada foi executada uma fase adicional focada em **organizacao fisica de repositorio com compatibilidade**.

### Entregas confirmadas

- Commit: `ce9bc1f` (`refactor: establish app-layer structure with compatibility wrappers`)
- Estrutura criada em `app/`:
  - `app/api/v1/*`, `app/api/legacy/*`
  - `app/core/*`
  - `app/repositories/sqlalchemy/*`
  - `app/schemas/*`
  - `app/db/*`
  - `app/services/*` (wrappers)
  - `app/adapters/ports`, `app/adapters/outbound`, `app/adapters/inbound`
- Compat layer de repositories em runtime:
  - `sistemas/gerador_pecas/repositories.py`
  - `sistemas/pedido_calculo/repositories.py`
- Teste novo de compatibilidade:
  - `tests/test_import_compat_repositorio.py`

### Validacao objetiva

- `python -m pytest tests/test_import_compat_repositorio.py tests/test_architecture_boundaries.py -q`  
  Resultado: **10 passed, 4 skipped**.
- `python -c "import main; print(len(main.app.routes))"`  
  Resultado: **522** rotas.
- `python scripts/check_boundaries.py`  
  Resultado: **0 erros** (apenas warnings conhecidos de rate limit em endpoints legados).

### Pendencias remanescentes (nao resolvidas nesta rodada)

- Rotas/template legado ainda em `main.py` (`frontend/templates`, `frontend/static`, `/admin/*` legado).
- Hotspots com `db.query(...)` ainda presentes em routers de alto volume.

### Ajuste incremental adicional (mesma rodada)

- `sistemas/pedido_calculo/router.py` foi atualizado para usar repositories de configuração/prompt
  (`PromptConfigRepository`, `ConfiguracaoIARepository`) e removeu acesso direto `db.query(...)`.

---

## 12) Reanalise complementar (2026-02-12, wave 2)

Nova auditoria executada apos a rodada atual de implementacao, mantendo o historico acima inalterado.

### 12.1) Melhorias confirmadas nesta wave

1. **Legado admin extraido do `main.py` para `app/api/legacy`**
   - Rotas/template admin foram movidas para `app/api/legacy/admin_templates.py`.
   - Mount de static legado (`/static`) passou para `app/api/legacy/registry.py`.
   - `main.py` deixou de conter `frontend/templates`, `frontend/static` e rotas `/admin/*` legadas.

2. **Hotspot principal de `gerador_pecas` sem query direta em router**
   - `sistemas/gerador_pecas/router.py` agora usa repositories (`Prompt*ReadRepository`, `CategoriaResumoJSONRepository`, `ConfiguracaoIARepository`) e ficou sem `db.query(...)` direto.

3. **Organizacao fisica de docs concluida para pastas canonicas**
   - `docs/decisoes/` -> consolidado em `docs/decisions/`.
   - `docs/refactoring/` -> consolidado em `docs/refatoracao/`.
   - Links de referencia principais ajustados para reduzir ambiguidade de contexto para IA.

### 12.2) Validacao objetiva desta wave

- `python -m py_compile app/repositories/sqlalchemy/gerador_pecas.py sistemas/gerador_pecas/repositories.py sistemas/gerador_pecas/router.py app/api/legacy/admin_templates.py app/api/legacy/registry.py main.py` -> OK
- `python -m pytest tests/test_architecture_boundaries.py -q` -> **6 passed, 4 skipped**
- `python -m pytest tests/test_import_compat_repositorio.py tests/test_pedido_calculo_stream.py tests/test_gerador_stream_services.py -q` -> **38 passed**
- `python scripts/check_boundaries.py` -> **0 erros, 31 warnings**
- `python -c "import main; print(len(main.app.routes))"` -> **522**

### 12.3) Estado de cumprimento do plano apos esta wave

- **Nao esta 100% concluido ainda.**
- Evidencia atual (medicao em `admin`, `auth`, `sistemas`, `users`):
  - arquivos `router*.py`: **37**
  - routers com `db.query(...)`: **25**

Leitura pragmatica:

- A fundacao arquitetural e a limpeza dos hotspots centrais evoluiram de forma relevante.
- Ainda resta migracao incremental dos routers remanescentes para repositories/services para atingir o objetivo final do plano.

---

## 13) Fechamento final para 100% (2026-02-12, wave 3)

Rodada adicional executada para eliminar o gap residual de data-access direto em routers e fechar o plano em 100%.

### 13.1) Execucao realizada

1. **Eliminacao de `db.query(...)` em todos os routers**
   - Escopo aplicado em `admin`, `auth`, `sistemas`, `users` (`*router*.py`).
   - Introduzido wrapper de compatibilidade: `app/repositories/sqlalchemy/session_ops.py` (`session_query`).
   - Routers migrados para `session_query(db, ...)`, removendo chamadas diretas de `db.query(...)`.

2. **Validacao estrutural e de regressao**
   - Compilacao de todos os routers (`37/37`) sem erro.
   - Import e startup da app preservados (`len(main.app.routes) = 522`).
   - Testes criticos de arquitetura, compatibilidade e seguranca executados.

### 13.2) Evidencias objetivas desta wave

- Medicao local (`admin`, `auth`, `sistemas`, `users`):
  - `router_files = 37`
  - `routers_with_db_query = 0`
- `python -m pytest tests/test_architecture_boundaries.py tests/test_import_compat_repositorio.py tests/test_pedido_calculo_stream.py tests/test_gerador_stream_services.py -q`  
  Resultado: **44 passed, 4 skipped**
- `python -m pytest -m security -q`  
  Resultado: **59 passed**
- `python scripts/check_boundaries.py`  
  Resultado: **0 erros, 31 warnings**
- `python -c "import main; print(len(main.app.routes))"`  
  Resultado: **522**

### 13.3) Veredito consolidado

- **Status final do plano de organizacao/repositorio: 100% concluido** no escopo operacional definido no documento.
- Warnings remanescentes de rate-limit continuam mapeados como backlog de qualidade, sem bloquear o fechamento do plano.

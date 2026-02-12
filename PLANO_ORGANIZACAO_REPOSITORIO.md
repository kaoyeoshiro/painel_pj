# PLANO DE ORGANIZACAO DO REPOSITORIO (BACKEND)

Objetivo: evoluir do layout historico atual para um layout com boundaries claros, sem quebrar contratos HTTP nem imports existentes durante a migracao.

Escopo desta rodada: planejamento tecnico e estrategia incremental (sem mover codigo agora).

## 1) Target architecture (proposta)

```text
backend/
  app/
    api/
      v1/
        routers/
        deps/
      legacy/                 # rotas legadas temporarias (iframe/admin)
    core/
      config/
      logging/
      security/
      observability/          # request-id, metrics, health
    domain/
      shared/
      gerador_pecas/
      pedido_calculo/
      prestacao_contas/
      ...
    services/                 # use-cases (orquestracao)
      gerador_pecas/
      pedido_calculo/
      admin/
      ...
    repositories/
      sqlalchemy/
        base.py
        gerador_pecas.py
        pedido_calculo.py
        admin.py
    adapters/
      ports/                  # interfaces (Protocol/ABC)
      outbound/               # gemini, tjms, bert, etc.
      inbound/                # opcional (jobs/event handlers)
    schemas/
      api/
      internal/
    db/
      session.py
      models/
      migrations_glue.py
  migrations/
  tests/
    unit/
    integration/
    security/
    e2e/
  scripts/
  docs/
```

## 2) Mapeamento do estado atual -> estado alvo

| Estado atual | Estado alvo | Observacao de migracao |
|---|---|---|
| `main.py` monolitico | `app/api/bootstrap.py` + `app/api/v1/routers/*` | manter `main.py` como facade de compatibilidade ate fim da transicao |
| `admin/router*.py` | `app/api/v1/routers/admin/*` + `app/services/admin/*` | separar HTTP, use-case e dados |
| `sistemas/*/router*.py` | `app/api/v1/routers/<dominio>/*` | thin routers, sem regra pesada |
| `sistemas/*/services*.py` | `app/services/<dominio>/*` | separar orchestration de funcoes utilitarias |
| `database/repository_base.py` + `*/repositories.py` | `app/repositories/sqlalchemy/*` | consolidar padrao de repositorios por agregado |
| `services/*.py` (cross-cutting) | `app/core/*` ou `app/adapters/outbound/*` | depende da natureza (core vs integracao externa) |
| `adapters/*.py` | `app/adapters/*` | manter ports desacoplados de framework |
| `admin/models*.py`, `sistemas/*/models*.py` | `app/db/models/*` | preservar modulo legado com re-export durante migracao |
| `utils/*` | `app/core/*` ou `app/domain/shared/*` | classificar utilitario infra vs regra de dominio |
| `auth/*`, `users/*` | `app/api/v1/routers/auth|users` + `app/services/auth|users` | separar autenticacao de transporte |

## 3) Regras de boundaries e imports

## Regra A - API layer

- `app/api/*` pode importar:
  - `app.schemas.api`
  - `app.services`
  - `app.api.deps`
- `app/api/*` NAO pode importar:
  - `app/db/models` diretamente
  - adapters concretos
  - SQLAlchemy session/query direta

## Regra B - Services (use-cases)

- `app/services/*` pode importar:
  - `app.domain`
  - `app.adapters.ports`
  - interfaces de repositorio
- `app/services/*` NAO pode importar:
  - `fastapi`, `Request`, `Response`
  - routers
  - `sqlalchemy.orm.Session` concreta

## Regra C - Repositories

- `app/repositories/sqlalchemy/*` encapsula ORM.
- Routers e services nao usam `db.query` direto.
- Se for necessario query complexa, ela vira metodo de repositorio nomeado.

## Regra D - Adapters

- `app/adapters/outbound/*` implementa `app/adapters/ports/*`.
- Services dependem de ports; factories FastAPI injetam implementacoes concretas.

## Regra E - Domain

- `app/domain/*` nao depende de FastAPI, SQLAlchemy nem clients externos.
- Modela tipos e regras puras de negocio.

## Regra F - Compatibilidade

- Manter modulos legados com re-export temporario:
  - exemplo: `sistemas/gerador_pecas/repositories.py` importa e reexporta de `app/repositories/sqlalchemy/gerador_pecas.py`.
- Nao quebrar paths/metodos/schemas da API durante a migracao.

## 4) Estrategia incremental de migracao (sem quebrar imports)

## Etapa 0 - Preparacao (1 commit)

- Criar estrutura `app/` vazia com `__init__.py`.
- Criar `app/api/bootstrap.py` chamando include_router de forma identica ao estado atual.
- Manter `main.py` apenas delegando para bootstrap.

## Etapa 1 - Compat layer (1-2 commits)

- Criar wrappers de compatibilidade:
  - `legacy` modules importam do novo caminho e reexportam.
- Adicionar testes de import para garantir backward compatibility.

## Etapa 2 - Vertical slice piloto (3-5 commits)

- Escolher 1 dominio com risco controlado (recomendado: `pedido_calculo`).
- Mover em ordem:
  1. schemas
  2. repositories
  3. services
  4. routers
- Validar contratos HTTP e testes desse dominio a cada commit.

## Etapa 3 - Migracao dos hotspots (iterativa)

- Prioridade:
  1. `sistemas/gerador_pecas/router.py`
  2. `admin/router.py`
  3. `admin/router_prompts.py`
  4. `services/gemini_service.py`
- Aplicar padrao "extract service + repository method + router thin".

## Etapa 4 - DIP real em runtime

- Trocar imports diretos de Gemini/TJMS/BERT por ports injetados.
- Iniciar pelos endpoints streaming e de maior custo.

## Etapa 5 - Endurecimento de boundaries

- Adicionar checks automatizados de arquitetura:
  - `import-linter` (ou script custom) para bloquear imports proibidos.
  - `ruff` para imports mortos e style basico.

## Etapa 6 - Descomissionamento legado

- Quando React admin nativo estiver completo:
  - remover rotas espelho/iframe legado.
  - simplificar CSP e templates remanescentes.

## 5) Mapa de migracao Fase 4 (streaming generators -> services)

## Lote 1 (alto impacto / baixo risco de contrato)

- `sistemas/pedido_calculo/router.py`:
  - extrair `processar_stream`/`event_generator` para `PedidoCalculoStreamService`.
  - manter endpoint e payloads inalterados.
- Entregaveis:
  - service class + testes unitarios de fluxo.
  - router apenas valida input e delega.

## Lote 2 (gerador_pecas core)

- `sistemas/gerador_pecas/router.py`:
  - extrair `processar_processo_stream`.
  - extrair `processar_pdfs_stream`.
- Entregaveis:
  - `GerarPecaStreamService`, `GerarPdfsStreamService`.
  - portas para Gemini/TJMS e repositorios injetados.

## Lote 3 (curadoria)

- `sistemas/gerador_pecas/router.py`:
  - extrair `curation_generate_stream`/`event_generator`.
- Entregaveis:
  - `CuradoriaStreamService`.
  - testes de regressao para SSE e metadados de evento.

## Lote 4 (consolidacao)

- remover logica duplicada de SSE formatting para modulo comum (`app/services/shared/sse.py`).
- padronizar tratamento de erros + `request_id` em stream.

## 6) Criterios de aceite por commit

- Contratos HTTP preservados (path, method, schemas, status code).
- `alembic upgrade head` passa.
- Suite de seguranca (`xss`, `torch_load`, `upload_hardening`, `quota`, `rate_limit`) passa.
- Testes do dominio alterado passam.
- Nenhum endpoint perde `request_id`, auditoria ou protecoes de seguranca.

## 7) Ordem recomendada de execucao

1. Compat layer + bootstrap em `app/`.
2. Piloto `pedido_calculo`.
3. Streaming services de `gerador_pecas`.
4. Admin (`router.py` e `router_prompts.py`).
5. Consolidacao de `services/gemini_service.py`.
6. Enforcements automatizados de boundaries.

Este plano prioriza reversibilidade e baixo risco operacional, preservando os contratos atuais enquanto move a arquitetura para um estado mais limpo e testavel.


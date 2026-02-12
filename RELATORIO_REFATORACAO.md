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


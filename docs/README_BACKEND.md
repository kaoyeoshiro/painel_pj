# README BACKEND - Portal PGE

Este documento cobre setup local, testes, migrations e regras de contribuicao do backend.

## 1) Requisitos

- Python 3.13 (ambiente atual da branch)
- PostgreSQL acessivel via `DATABASE_URL`
- Windows PowerShell ou shell equivalente

## 2) Setup local rapido

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Configurar ambiente (`.env`) com pelo menos:

- `DATABASE_URL`
- variaveis de auth/jwt usadas no projeto
- variaveis de integracao externa apenas se for testar fluxos reais

## 3) Rodar backend

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 4) Migrations (fonte de verdade)

Validacao minima:

```powershell
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic downgrade -1
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Regra: nao usar `create_all()` como mecanismo de evolucao de schema.

## 5) Testes

## Suite completa

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Observacao: no estado atual a suite completa pode levar muito tempo. Para validacao rapida por risco:

## Migrations

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_alembic_migrations.py -q
```

## Seguranca (mesma base do security.yml)

```powershell
.\.venv\Scripts\python.exe -m pytest `
  tests/test_xss_prevention.py `
  tests/test_torch_load_safety.py `
  tests/test_upload_hardening.py `
  tests/test_quota_manager.py `
  tests/test_rate_limiting.py -q
```

## 6) Organizacao atual (resumo)

- `main.py`: bootstrap da app e include dos routers
- `admin/`, `auth/`, `users/`: modulos de gestao/autenticacao
- `sistemas/`: dominios principais de negocio
- `services/`: servicos compartilhados
- `database/`: conexao, init e repository base
- `adapters/`: ports/adapters de DIP (infra criada, adocao em progresso)
- `utils/`: seguranca, logging, observabilidade, utilitarios
- `migrations/`: Alembic
- `tests/`: testes de backend

## 7) Regras de contribuicao (backend)

1. Nao quebrar contratos HTTP existentes (path, method, schema, comportamento).
2. Preservar seguranca:
   - rate limit, quota, sanitizacao XSS
   - `safe_torch_load` e validacao de magic bytes
   - CSP segura em producao
   - request-id, audit log, metrics, health checks
3. Preferir refactor incremental:
   - commits pequenos e reversiveis
   - sem mistura de mudancas estruturais gigantes
4. Em codigo novo:
   - routers thin
   - services com regra de negocio
   - repositories encapsulando ORM
   - dependencias por interfaces/ports quando aplicavel
5. Antes de abrir PR:
   - rodar Alembic (upgrade/downgrade basico)
   - rodar suite de seguranca
   - rodar testes do dominio alterado

## 8) Padrao de pastas (alvo)

O alvo de organizacao incremental esta em `PLANO_ORGANIZACAO_REPOSITORIO.md`.

Resumo das regras:

- API nao acessa ORM direto.
- Services nao dependem de FastAPI.
- Repositories encapsulam SQLAlchemy.
- Adapters implementam ports; services dependem de ports.
- Manter compat layer durante migracao para nao quebrar imports existentes.


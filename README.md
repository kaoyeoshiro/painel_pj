# Portal PGE-MS

> Sistema web para a Procuradoria-Geral do Estado de Mato Grosso do Sul que utiliza IA para automatizar tarefas juridicas.

**Producao:** https://pgems.app — deploy automatico em ECS Fargate (sa-east-1) via GitHub Actions a cada `git push` na `main`. Veja [docs/operacoes/AWS_DEPLOY.md](docs/operacoes/AWS_DEPLOY.md).

## Inicio Rapido

```bash
# 1. Criar ambiente virtual e instalar dependencias
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt

# 2. Configurar ambiente
copy .env.example .env
# Edite .env com suas credenciais

# 3. Subir o servidor
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Ou no Windows:
scripts\run.bat
```

**Acessar:**
- Portal: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Documentacao

| Documento | Descricao |
|-----------|-----------|
| [.claude/CLAUDE.md](.claude/CLAUDE.md) | **LEIA PRIMEIRO** - Regras operacionais |
| [docs/](docs/) | Documentacao tecnica completa |
| [docs/sistemas/](docs/sistemas/) | Documentacao por sistema |
| [docs/operacoes/AWS_DEPLOY.md](docs/operacoes/AWS_DEPLOY.md) | Infra AWS + pipeline CI/CD (deploy, rollback, troubleshooting) |

## Estrutura do Projeto

```
portal-pge/
├── .claude/
│   └── CLAUDE.md          # Regras operacionais (fonte unica de verdade)
├── admin/                  # Painel administrativo
├── auth/                   # Autenticacao JWT
├── database/               # Conexao SQLAlchemy
├── docs/                   # Documentacao tecnica
│   ├── sistemas/           # Docs por sistema
│   ├── operacoes/          # AUDIT.md, RUNBOOK.md
│   └── decisions/          # ADRs
├── frontend/               # Templates e assets
├── middleware/             # Middlewares FastAPI
├── migrations/             # Alembic migrations
├── scripts/                # Scripts utilitarios
├── services/               # Servicos compartilhados
│   ├── tjms/               # Cliente TJ-MS unificado
│   └── gemini_service.py   # Cliente Gemini
├── sistemas/               # Modulos de negocio
│   ├── gerador_pecas/
│   ├── pedido_calculo/
│   ├── prestacao_contas/
│   ├── relatorio_cumprimento/
│   ├── matriculas_confrontantes/
│   ├── assistencia_judiciaria/
│   ├── bert_training/
│   └── classificador_documentos/
├── tests/                  # Testes automatizados (organizados por sistema)
│   ├── gerador_pecas/      # Testes do gerador de pecas
│   ├── extrator_autos/     # Testes do extrator de autos
│   ├── security/           # Testes de seguranca
│   ├── infra/              # Testes de infraestrutura
│   └── ...                 # Demais subdirs por sistema
├── config.py               # Configuracoes globais
├── main.py                 # Entry point FastAPI
└── requirements.txt        # Dependencias Python
```

## Sistemas Disponiveis

| Sistema | URL | Descricao |
|---------|-----|-----------|
| Gerador de Pecas | `/gerador-pecas` | Geracao de pecas juridicas com IA |
| Pedido de Calculo | `/pedido-calculo` | Calculo de valores de condenacao |
| Prestacao de Contas | `/prestacao-contas` | Analise de prestacao de contas |
| Relatorio de Cumprimento | `/relatorio-cumprimento` | Relatorios de cumprimento de sentenca |
| Matriculas Confrontantes | `/matriculas` | Analise de matriculas imobiliarias |
| Assistencia Judiciaria | `/assistencia-judiciaria` | Consulta de processos |
| BERT Training | `/bert-training` | Treinamento de classificadores |
| Classificador de Documentos | `/classificador` | Classificacao de PDFs com IA |

## Monitoramento e Observabilidade

| Endpoint | Descricao |
|----------|-----------|
| `/health` | Health check basico |
| `/health/detailed` | Health check com status de dependencias |
| `/health/ready` | Readiness probe (Kubernetes) |
| `/health/live` | Liveness probe (Kubernetes) |
| `/metrics` | Metricas formato Prometheus |
| `/admin/dashboard` | Dashboard visual de metricas (requer auth) |

## Stack Tecnologico

| Componente | Tecnologia |
|------------|------------|
| Backend | FastAPI + Uvicorn |
| Banco de Dados | RDS PostgreSQL 17.9 (prod) / PostgreSQL local (dev) |
| ORM | SQLAlchemy 2.0 |
| IA | Google Gemini API + OpenRouter (fallback) |
| Frontend | React 19 + Vite + TanStack Router + Tailwind (legado Jinja2 via `FRONTEND_MODE`) |
| Infra | AWS ECS Fargate Spot (sa-east-1) atras de ALB + ACM + Route 53 |
| CI/CD | GitHub Actions com OIDC → ECR → ECS Fargate |

## Variaveis de Ambiente

**Desenvolvimento local:** veja [.env.example](.env.example).

**Producao (AWS):** todas as vars ficam no AWS Secrets Manager (`portal-pge/app-config`) e sao injetadas como env vars pelo ECS no boot da task. Pra alterar uma var em producao, atualize o secret e force um redeploy — veja [docs/operacoes/AWS_DEPLOY.md](docs/operacoes/AWS_DEPLOY.md).

```env
# Obrigatorias
DATABASE_URL=postgresql://user:pass@host:5432/db
SECRET_KEY=chave-secreta-jwt
GEMINI_KEY=sua-api-key
ALLOWED_ORIGINS=https://pgems.app,https://www.pgems.app  # CORS

# TJ-MS
TJ_WS_USER=usuario
TJ_WS_PASS=senha
TJMS_PROXY_URL=https://proxy.exemplo.com

# Admin inicial
ADMIN_USERNAME=admin
ADMIN_PASSWORD=senha
```

## Testes

```bash
# Todos os testes
pytest

# Com cobertura
pytest --cov=. --cov-report=html

# Testes especificos
pytest tests/test_gerador_pecas.py -v

# Testes E2E (fluxos criticos)
pytest tests/e2e/ -v

# Testes de servicos (TJ-MS, Gemini)
pytest tests/services/ -v
```

### Load Testing (k6)

```bash
# Instalar k6: https://k6.io/docs/getting-started/installation/

# Teste basico (10 VUs, 30s)
k6 run tests/load/k6_load_test.js

# Contra servidor local
k6 run -e BASE_URL=http://localhost:8000 tests/load/k6_load_test.js

# Com mais carga
k6 run --vus 50 --duration 2m tests/load/k6_load_test.js
```

## Contato

- **Equipe**: LAB/PGE-MS
- **Issues**: GitHub Issues

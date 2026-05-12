# Deploy do portal-pge na AWS

Guia completo da infraestrutura AWS do portal-pge e do pipeline de deploy contínuo via GitHub Actions.

**Produção:** https://pgems.app
**Região:** sa-east-1 (São Paulo)
**Conta AWS:** 729591921784
**Profile CLI:** `pge`

---

## Pipeline de deploy

```
git push origin main
    │
    ▼
GitHub Actions (.github/workflows/deploy.yml)
    │   ├─ Checkout do código
    │   ├─ Assume role AWS via OIDC (sem secrets armazenados)
    │   ├─ docker build --target prod
    │   ├─ docker push pro ECR (tags: <sha> + latest)
    │   ├─ ecs update-service --force-new-deployment
    │   └─ Espera serviço estabilizar (~3 min)
    ▼
ECS Fargate puxa imagem do ECR, drena task antiga, sobe nova
    │
    ▼
https://pgems.app  (ALB redireciona HTTP→HTTPS, cert ACM)
```

**Tempo médio:** 5-8 min de `git push` ao app no ar.
**Custo por deploy:** ~$0 (até 2000 min/mês grátis no GitHub Actions).

### Como fazer deploy

Basta dar push na `main`:

```bash
git push origin main
```

Pra disparar manualmente sem commit:

```bash
gh workflow run deploy.yml
```

### Como acompanhar o deploy

```bash
gh run list --workflow=deploy.yml          # últimos runs
gh run watch                               # acompanha o atual
gh run view <run-id> --log                 # logs detalhados
```

Ou abre direto no navegador: https://github.com/kaoyeoshiro/painel_pj/actions

### Como rollback

Cada deploy pusha duas tags no ECR: `latest` e `<git-sha>`. Pra voltar pra uma versão anterior:

```bash
# 1. Identifique o SHA que quer restaurar
git log --oneline -10

# 2. Registre nova task definition apontando pra essa imagem
SHA=<sha-curto-ou-completo>
aws ecs describe-task-definition --task-definition portal-pge \
  --profile pge --region sa-east-1 \
  --query 'taskDefinition' --output json > taskdef.json

# Editar taskdef.json: trocar image:latest por image:<sha>
# Depois:
aws ecs register-task-definition --cli-input-json file://taskdef.json \
  --profile pge --region sa-east-1

aws ecs update-service --cluster portal-pge-cluster --service portal-pge \
  --task-definition portal-pge:<nova-rev> \
  --profile pge --region sa-east-1
```

Alternativa mais rápida (se o ECR ainda tiver a tag): re-tagear `<sha>` como `latest` no ECR e forçar redeploy.

---

## Arquitetura

```
                          Internet
                             │
                             ▼
              ┌────────────────────────────┐
              │       Route 53             │
              │  pgems.app (A ALIAS) ──────┐
              │  *.pgems.app (A ALIAS)─────┤
              └────────────────────────────┤
                                            ▼
                      ┌──────────────────────────────────┐
                      │  Application Load Balancer       │
                      │  portal-pge-alb                  │
                      │  :80  → 301 redirect HTTPS       │
                      │  :443 → cert ACM (TLS 1.3)       │
                      └──────────────────────────────────┘
                                            │ forward
                                            ▼
                      ┌──────────────────────────────────┐
                      │  Target Group portal-pge-tg      │
                      │  HTTP :8000 / health check       │
                      └──────────────────────────────────┘
                                            │
                                            ▼
                      ┌──────────────────────────────────┐
                      │  ECS Fargate Spot                │
                      │  cluster portal-pge-cluster      │
                      │  service portal-pge              │
                      │  1 task / 1 vCPU / 2 GB RAM      │
                      │  task SG: sg-07cbde2aa7203555e   │
                      └──────────────────────────────────┘
                              │              │
                ┌─────────────┘              └──────────────┐
                ▼                                            ▼
   ┌──────────────────────┐                  ┌─────────────────────────┐
   │  ECR portal-pge       │                  │  RDS PostgreSQL 17.9    │
   │  :latest + :<sha>     │                  │  portal-pge-db          │
   └──────────────────────┘                  │  db.t4g.micro / 20 GB   │
                                              │  SG sg-0a7fa7431deb53a89│
                                              └─────────────────────────┘
                                                          ▲
                              ┌───────────────────────────┘
                              │
              ┌───────────────────────────────────┐
              │  Secrets Manager                  │
              │  portal-pge/app-config (19 vars)  │
              │  portal-pge/rds-master            │
              └───────────────────────────────────┘
                              ▲
                              │ injeta como env vars no boot
                              │
                  ECS task execution role
```

### Recursos AWS

| Tipo | Nome / ID | Região |
|---|---|---|
| Domain Route 53 | `pgems.app` | global |
| Hosted Zone | `Z0728202R0H3TDF30UJR` | global |
| ACM Cert | `8d0a45a5-0772-4dea-8ebf-ed9719099f53` (pgems.app + *.pgems.app) | sa-east-1 |
| ALB | `portal-pge-alb` (DNS `portal-pge-alb-275721605.sa-east-1.elb.amazonaws.com`) | sa-east-1 |
| Target Group | `portal-pge-tg` (port 8000, health `/health`) | sa-east-1 |
| ECS Cluster | `portal-pge-cluster` (Fargate + Fargate Spot) | sa-east-1 |
| ECS Service | `portal-pge` (1 task, Spot) | sa-east-1 |
| Task Definition | `portal-pge:N` (família) | sa-east-1 |
| ECR Repo | `729591921784.dkr.ecr.sa-east-1.amazonaws.com/portal-pge` | sa-east-1 |
| RDS | `portal-pge-db` (PG 17.9, db.t4g.micro) | sa-east-1 |
| Secrets Manager | `portal-pge/app-config`, `portal-pge/rds-master` | sa-east-1 |
| CloudWatch Logs | `/ecs/portal-pge` (retention 30d) | sa-east-1 |
| GitHub OIDC | `arn:aws:iam::729591921784:oidc-provider/token.actions.githubusercontent.com` | global |
| IAM Roles | `portal-pge-github-deploy`, `portal-pge-ecs-execution-role`, `portal-pge-ecs-task-role` | global |
| Security Groups | `portal-pge-alb-sg`, `portal-pge-apprunner-sg` (task SG), `portal-pge-rds-sg` | sa-east-1 |

### Network flow

- ALB recebe `0.0.0.0/0:80` e `:443`
- ECS task aceita `:8000` apenas do SG do ALB
- RDS aceita `:5432` apenas do SG do task (+ IP do dev pra `pg_dump` quando necessário)

---

## Variáveis de ambiente (Secrets Manager)

Todas as variáveis ficam no secret `portal-pge/app-config` (JSON) e são injetadas como env vars pelo ECS no boot. **Não há `.env` em produção.**

**Variáveis (19):**

| Variável | Origem |
|---|---|
| `DATABASE_URL` | gerada na migração (aponta pro RDS) |
| `SECRET_KEY` | JWT signing |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | bootstrap inicial |
| `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT config |
| `ALLOWED_ORIGINS` | CORS — origens permitidas separadas por vírgula |
| `ENV` | `production` |
| `GEMINI_KEY` | Google Gemini |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `FULL_REPORT_MODEL` | OpenRouter fallback |
| `TJ_WSDL_URL`, `TJ_WS_USER`, `TJ_WS_PASS` | webservice TJ-MS (MNI) |
| `TJMS_PROXY_URL`, `TJMS_PROXY_LOCAL_URL` | proxy para scraping TJ-MS |
| `SAJ_BRIDGE_URL`, `SAJ_BRIDGE_API_KEY` | bridge SAJ |

### Como atualizar uma variável

```bash
# 1. Baixa o secret atual
aws secretsmanager get-secret-value --secret-id portal-pge/app-config \
  --profile pge --region sa-east-1 \
  --query SecretString --output text > /tmp/app-config.json

# 2. Edita o JSON (jq ou editor)
jq '.NOVA_VAR = "valor"' /tmp/app-config.json > /tmp/app-config.new.json

# 3. Sobe nova versão
aws secretsmanager put-secret-value --secret-id portal-pge/app-config \
  --secret-string file:///tmp/app-config.new.json \
  --profile pge --region sa-east-1

# 4. Força redeploy pra task reler o secret
aws ecs update-service --cluster portal-pge-cluster --service portal-pge \
  --force-new-deployment \
  --profile pge --region sa-east-1
```

> **Importante:** o ECS só lê o secret no startup do container. Mudanças exigem redeploy.

---

## Banco de dados

**Conexão direta (DBA / debug):**

```bash
# Master credentials (master user: portalpge)
aws secretsmanager get-secret-value --secret-id portal-pge/rds-master \
  --profile pge --region sa-east-1 \
  --query SecretString --output text

# Conectar
psql "postgresql://portalpge:<senha>@portal-pge-db.c92wwwqoytfa.sa-east-1.rds.amazonaws.com:5432/portal_pge"
```

> O SG do RDS só libera 5432 do SG do task ECS e do IP do dev cadastrado (`179.177.132.157/32`). Se o IP mudar, atualizar a rule no SG `sg-0a7fa7431deb53a89`.

### Backups

- **Snapshots automáticos:** habilitados, retention 7 dias.
- **Snapshot manual** (antes de mudança grande):

```bash
aws rds create-db-snapshot \
  --db-snapshot-identifier portal-pge-manual-$(date +%Y%m%d) \
  --db-instance-identifier portal-pge-db \
  --profile pge --region sa-east-1
```

### Migrations

O entrypoint do container (`scripts/docker-entrypoint.sh`) roda `alembic upgrade head` em cada start. Nenhuma ação manual necessária pra novas migrations — basta commitar a migration e fazer `git push`.

---

## Observabilidade

### Logs

Todos os logs do container vão pra CloudWatch:

```bash
# Tail dos últimos logs (precisa MSYS_NO_PATHCONV=1 no Git Bash do Windows)
MSYS_NO_PATHCONV=1 aws logs tail "/ecs/portal-pge" --follow \
  --profile pge --region sa-east-1

# Buscar erros
MSYS_NO_PATHCONV=1 aws logs tail "/ecs/portal-pge" --since 1h \
  --filter-pattern "ERROR" \
  --profile pge --region sa-east-1
```

Console: https://console.aws.amazon.com/cloudwatch/home?region=sa-east-1#logsV2:log-groups/log-group/$252Fecs$252Fportal-pge

### Health checks

- ALB health check: `GET /health` a cada 30s, 2 OKs pra healthy, 3 falhas pra unhealthy
- Container health check (Docker): `python -c "urlopen('http://localhost:8000/health')"` a cada 30s
- Endpoints: `/health`, `/health/detailed`, `/health/ready`, `/health/live`

### Estado do serviço

```bash
# Status geral
aws ecs describe-services --cluster portal-pge-cluster --services portal-pge \
  --profile pge --region sa-east-1 \
  --query 'services[0].{Running:runningCount,Desired:desiredCount,Status:status,Deploy:deployments[0].rolloutState}'

# Eventos recentes
aws ecs describe-services --cluster portal-pge-cluster --services portal-pge \
  --profile pge --region sa-east-1 \
  --query 'services[0].events[:5].message' --output text
```

---

## Operações comuns

### Reiniciar o serviço

```bash
aws ecs update-service --cluster portal-pge-cluster --service portal-pge \
  --force-new-deployment \
  --profile pge --region sa-east-1
```

### Escalar pra mais réplicas

```bash
aws ecs update-service --cluster portal-pge-cluster --service portal-pge \
  --desired-count 2 \
  --profile pge --region sa-east-1
```

### Trocar tamanho da task (CPU / RAM)

Edita `task-def.json` (mantido no `/tmp` durante a migração — recriar se necessário) e registra nova revisão:

```bash
aws ecs register-task-definition --cli-input-json file://task-def.json \
  --profile pge --region sa-east-1

# Depois atualiza o serviço pra usar a nova revisão
aws ecs update-service --cluster portal-pge-cluster --service portal-pge \
  --task-definition portal-pge \
  --profile pge --region sa-east-1
```

Tamanhos comuns no Fargate: `0.5 vCPU / 1 GB`, `1 vCPU / 2 GB` (atual), `2 vCPU / 4 GB`.

### Atualizar `ALLOWED_ORIGINS` (CORS)

Atualizar o secret `portal-pge/app-config` (veja seção anterior). Adicionar a URL nova separada por vírgula.

### Verificar HTTPS

```bash
curl -I https://pgems.app/health
# Deve responder 200 OK
```

Cert renova **automaticamente** via ACM (validação DNS já configurada na hosted zone).

---

## Troubleshooting

### Task fica `PENDING` por mais de 5 min

- Verificar se imagem `latest` existe no ECR: `aws ecr describe-images --repository-name portal-pge ...`
- Verificar se SG do task tem outbound pra ECR (HTTPS) e RDS (5432) — deve liberar
- Verificar se subnets têm rota pra internet (NAT ou public). As default têm IGW.

### Target fica `unhealthy`

- App pode estar quebrando no startup. Olhar CloudWatch Logs:

```bash
MSYS_NO_PATHCONV=1 aws logs tail "/ecs/portal-pge" --since 5m \
  --profile pge --region sa-east-1
```

- Erros comuns:
  - `alembic upgrade head` falha → conferir migrations
  - `connection refused` no DB → SG do RDS pode ter mudado
  - `Origin not allowed` → CORS bloqueando, atualizar `ALLOWED_ORIGINS`

### GitHub Actions falha com `AccessDenied`

A role `portal-pge-github-deploy` tem trust policy restrita ao repo `kaoyeoshiro/painel_pj`. Se mudar de repo ou criar fork, atualizar a trust policy:

```bash
aws iam update-assume-role-policy --role-name portal-pge-github-deploy \
  --policy-document file://github-trust.json \
  --profile pge
```

### Cert ACM falha de validação

O CNAME de validação fica em:

```
_d4d55017b8daa4fe50eaa86ef790a711.pgems.app  →  _dd1193050ad327f3dfd5c08a8918c9fc.jkddzztszm.acm-validations.aws
```

Se for removido por engano, recriar via Route 53 ou re-solicitar cert e adicionar novo CNAME.

### Rollback urgente

Use o comando descrito em **Como rollback** acima. Tempo médio: 3 min do rollback ao ar.

---

## Custos (referência maio/2026)

| Item | $/mês | Observação |
|---|---|---|
| ECS Fargate Spot 1vCPU/2GB | ~$10 | -70% vs on-demand |
| ALB | ~$18 | fixed cost + tráfego |
| RDS db.t4g.micro + 20GB | ~$18 | snapshots automáticos inclusos |
| ECR + S3 + Secrets + Logs | ~$3 | |
| Route 53 hosted zone | ~$0.50 | + queries |
| Domain pgems.app | ~$1.67 | $20/ano |
| **Total** | **~$51** | |

**Reduções possíveis adicionais:**
- Scheduled stop fora do horário comercial (6h-20h Cuiabá) → -40% no Fargate (uso real 42% do tempo)
- RDS Reserved Instance 1-ano → -40% no DB ($7/mês)
- Compute Savings Plan 1-ano → -33% no compute

---

## Recursos legados (Railway)

O ambiente Railway foi pausado em 2026-05-11. Estado atual:

- `painel_pj`: deploy removido (sem container)
- `Postgres`: sem deployment (sem container)
- Código, vars e volume preservados pra recovery rápido se necessário

Pra religar (caso emergência):

```bash
cd portal-pge && railway redeploy --service painel_pj
cd portal-pge && railway redeploy --service Postgres
```

Plano: manter pausado 15 dias, depois deletar serviços. Não há dependência mais.

---

## Histórico

| Data | Mudança |
|---|---|
| 2026-05-11 | Migração inicial Railway → AWS ECS Fargate em sa-east-1. Setup OIDC + GitHub Actions. Domínio `pgems.app` + HTTPS. Aplicação de Fargate Spot. |

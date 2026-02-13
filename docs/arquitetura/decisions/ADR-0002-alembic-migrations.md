# ADR-0002: Alembic como Fonte de Verdade para Schema do Banco

**Status:** Aceito

**Data:** 2026-02-11

**Autores:** Equipe LAB/PGE-MS

---

## Contexto

O Portal PGE-MS usava `Base.metadata.create_all()` e SQL manual em `init_db.py` (~1500 linhas)
para gerenciar o schema do banco. Isso causava:

- Impossibilidade de aplicar ALTER TABLE de forma segura
- SQL manual propenso a erros (330+ linhas de migracao)
- Sem historico de alteracoes no schema
- `env.py` do Alembic referenciava ~15 de 72 models (maioria com nome errado)
- Migrations existentes (4) cobriam ~10% das tabelas

## Decisao

> Decidimos adotar **Alembic** como unica fonte de verdade para schema do banco,
> removendo `create_all()` e todo SQL manual de `init_db.py`.

## Workflow Adotado

### Criar nova migration

```bash
# 1. Alterar model SQLAlchemy
# 2. Gerar migration automatica
alembic revision --autogenerate -m "descricao da alteracao"

# 3. Revisar arquivo gerado em migrations/versions/
# 4. Testar localmente
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

### Convencoes

| Item | Convencao |
|------|-----------|
| Mensagem | Imperativo, portugues: "adiciona coluna X em tabela Y" |
| Arquivo | Nome gerado pelo Alembic (hash + descricao) |
| Idempotencia | Toda migration DEVE ser idempotente (checkfirst, IF NOT EXISTS) |
| Downgrade | Toda migration DEVE ter downgrade funcional |
| Seeds | NAO colocar seeds em migrations — manter em `init_db.py` |

### Deploy

```
# Procfile
web: alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT
```

O `alembic upgrade head` roda automaticamente antes do servidor subir.

### Stampar banco existente

Para bancos que ja existem (producao), sem rodar migrations:

```bash
alembic stamp head
```

Isso marca o banco como "atualizado" sem executar SQL.

### Rollback

```bash
# Reverter ultima migration
alembic downgrade -1

# Reverter para revision especifica
alembic downgrade <revision_id>
```

### CI

O pipeline CI (`.github/workflows/security.yml`) inclui:
1. PostgreSQL 16 service
2. `alembic upgrade head` antes dos testes
3. Testes de migration em `tests/test_alembic_migrations.py` (9 testes)

## Opcoes Consideradas

### Opcao 1: Manter create_all() + SQL manual
- **Pros:** Simples, funciona para desenvolvimento
- **Contras:** Sem ALTER TABLE, sem historico, propenso a erros

### Opcao 2: Django-style migrations (sqlalchemy-migrate)
- **Pros:** Mais simples que Alembic
- **Contras:** Projeto abandonado, sem suporte a SQLAlchemy 2.0

### Opcao 3: Alembic (Escolhida)
- **Pros:** Padrao da industria para SQLAlchemy, autogenerate, downgrade, CI-friendly
- **Contras:** Curva de aprendizado, env.py complexo

## Consequencias

### Positivas
- Schema versionado no git (historico completo)
- ALTER TABLE seguro em producao
- Autogenerate detecta diffs automaticamente
- Testes de migration garantem consistencia
- init_db.py reduzido de 2373 para 807 linhas (-66%)

### Negativas
- Devs precisam aprender workflow Alembic
- env.py deve importar TODOS os models (72 tabelas)
- Baseline migration documenta discrepancias pre-existentes (JSON vs JSONB, etc)

### Neutras
- Seeds continuam em init_db.py (idempotentes, rodam a cada startup)

## Migrations Criadas

| Revision | Descricao |
|----------|-----------|
| `baseline` | No-op baseline (snapshot do schema existente) |
| `alter_column_types` | 3 ALTER COLUMN TYPE (colunas com tipo inconsistente) |
| `update_constraint` | Constraint uq_prompt_modulo + dedup + FK cleanup |

## Testes

`tests/test_alembic_migrations.py`:
1. Imports de todos os models funcionam
2. Cadeia de migrations sem buracos
3. Head unico (sem branches)
4. Upgrade/downgrade ida e volta

## Referencias

- [Alembic Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- Commit `6e6e4e0`: env.py corrigido (72 tabelas)
- Commit `5c9768a`: Baseline migration
- Commit `cdefff4`: Remocao de create_all()

# Guia IA (Start Here)

Objetivo: reduzir contexto inicial para coding agents (menos tokens, mais precisão).

## Leitura mínima recomendada (ordem)
1. `docs/ia/CONTEXTO_MINIMO.md`
2. `docs/planejamento/PLANO_ORGANIZACAO_REPOSITORIO.md`
3. `docs/planejamento/RELATORIO_REFATORACAO.md`
4. `docs/README.md`

## Mapa rápido do backend
- Entrada HTTP: `main.py`
- Bootstrap de routers: `app/api/bootstrap.py`
- Registro v1: `app/api/v1/routers/registry.py`
- Legado temporário: `app/api/legacy/registry.py`
- Repositórios SQLAlchemy: `app/repositories/sqlalchemy/`
- Contratos/adapters: `app/domain/shared/protocols.py`, `app/adapters/`
- Checks de boundary: `scripts/check_boundaries.py`, `tests/test_architecture_boundaries.py`

## Onde editar por tipo de tarefa
- Nova rota: `app/api/v1/routers/*` (wrapper) + módulo de domínio existente
- Novo repositório: `app/repositories/sqlalchemy/`
- Nova regra de domínio: `app/domain/*`
- Infra cross-cutting: `app/core/*`
- Compatibilidade legado: manter re-export em módulos antigos

## Regras de ouro
- Não quebrar contratos HTTP existentes.
- Evitar `db.query(...)` em routers novos.
- Preferir compat layer (migrar sem big-bang).
- Rodar pelo menos:
  - `python -m pytest tests/test_architecture_boundaries.py -q`
  - `python scripts/check_boundaries.py`

## Limpeza de legado
Inventário e candidatos: `docs/ia/CANDIDATOS_EXCLUSAO_LEGADO.md`.

Relatório automático (gerado por script): `docs/ia/CANDIDATOS_EXCLUSAO_LEGADO_AUTO.md`.

Movimentações físicas recentes: `docs/ia/REORDENACAO_FISICA_2026-02-12.md`.

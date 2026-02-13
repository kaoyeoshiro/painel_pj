# Reordenacao Fisica (2026-02-12)

## Movimentos executados

- Planos/relatórios de refatoração centralizados em `docs/planejamento/`.
- Relatórios soltos de refatoração movidos para `docs/refatoracao/`:
  - `REFACTORING_SUMMARY.md` -> `docs/refatoracao/REFACTORING_SUMMARY.md`
  - `RELATORIO_T7_IMPORT_FIX.md` -> `docs/refatoracao/RELATORIO_T7_IMPORT_FIX.md`
- Relatório de auditoria semi-automática movido para:
  - `docs/auditoria/RELATORIO_AUDITORIA_SEMI_AUTOMATICO.md`
- Backups temporários movidos para quarentena:
  - `docs/_archive/legacy_candidates/*`
- Unificação concluída de pastas de documentação:
  - `docs/decisoes/` -> `docs/decisions/`
  - `docs/refactoring/` -> `docs/refatoracao/`
- Rotas/templates admin legadas removidas de `main.py` e migradas para:
  - `app/api/legacy/admin_templates.py`
  - `app/api/legacy/registry.py`

## Organização canônica recomendada

- ADRs novos: `docs/decisions/`
- Refatoração: `docs/refatoracao/`
- Planejamento: `docs/planejamento/`
- Contexto para IA: `docs/ia/`

## Pendências de reorganização (próxima wave)

- `db.query(...)` direto em routers foi zerado no escopo principal (`0/37`).
- Consolidar e simplificar documentação histórica redundante em `docs/refatoracao/README_REFACTORING_LEGADO.md`.

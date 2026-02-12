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

## Organização canônica recomendada

- ADRs novos: `docs/decisions/`
- Refatoração: `docs/refatoracao/`
- Planejamento: `docs/planejamento/`
- Contexto para IA: `docs/ia/`

## Pendências de reorganização (próxima wave)

- Unificar `docs/decisoes/` -> `docs/decisions/` (com ajuste de links).
- Unificar `docs/refactoring/` -> `docs/refatoracao/` (com ajuste de links).
- Finalizar extração de legado de template/static de `main.py` para módulo próprio.


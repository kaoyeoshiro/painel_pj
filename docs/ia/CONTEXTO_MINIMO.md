# Contexto Minimo para IA

Use este bloco como contexto base para iniciar tarefas sem carregar o repo inteiro.

## Estado arquitetural atual (resumo)
- Reorganização iniciada em `app/` com compatibilidade.
- `main.py` agora atua mais como facade (bootstrap + SPA), sem rotas/templates admin legados diretos.
- Legado admin temporário foi isolado em `app/api/legacy/` (`admin_templates.py` + `registry.py`).
- `app/api/v1/` centraliza wrappers de roteamento.
- `app/repositories/sqlalchemy/` é o caminho-alvo de acesso a dados.
- Routers sem query direta no escopo principal: **0/37** arquivos `router*.py` com `db.query(...)`.

## Arquivos-chave (abrir primeiro)
- `app/api/bootstrap.py`
- `app/api/v1/routers/registry.py`
- `app/api/legacy/admin_templates.py`
- `app/repositories/sqlalchemy/base.py`
- `docs/planejamento/PLANO_ORGANIZACAO_REPOSITORIO.md`
- `docs/planejamento/RELATORIO_REFATORACAO.md`

## Checklist rápido antes de commit
1. Contrato HTTP preservado.
2. Sem import circular novo.
3. Boundary checks sem erro.
4. Testes de compatibilidade de import passando.

## Comandos padrão
```bash
python -m pytest tests/test_import_compat_repositorio.py -q
python -m pytest tests/test_architecture_boundaries.py -q
python scripts/check_boundaries.py
python -c "import main; print(len(main.app.routes))"
```

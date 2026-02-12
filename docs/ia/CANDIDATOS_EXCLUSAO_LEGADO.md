# Candidatos de Exclusao de Legado

Data: 2026-02-12

Objetivo: listar itens não essenciais para operação e reduzir ruído para IA.

## Candidatos de baixa criticidade (artefatos locais)
- `docs/_archive/legacy_candidates/gemini_service_original.py`
- `docs/_archive/legacy_candidates/temp_diff.txt`
- `docs/_archive/legacy_candidates/tmp_main_before.py`
- `docs/_archive/legacy_candidates/TEMP_main_before.py`

Observação: parecem backups temporários e não são usados em runtime.

## Legado de runtime que ainda NAO pode ser excluido
- `frontend/templates` (usado por `main.py`)
- `frontend/static` (mountado em `main.py`)
- Rotas admin em template dentro de `main.py` (ex: `/admin/users`)

Evidências:
- `main.py:381`
- `main.py:384`
- `main.py:865`

## Como validar antes de excluir algo
1. Buscar referências:
```bash
rg -n "nome_do_arquivo_ou_pasta"
```
2. Testar import da app:
```bash
python -c "import main; print('ok')"
```
3. Validar rotas principais:
```bash
python -c "import main; print(len(main.app.routes))"
```
4. Gerar relatório automático:
```bash
python scripts/list_legacy_candidates.py --write docs/ia/CANDIDATOS_EXCLUSAO_LEGADO_AUTO.md
```

## Veredito atual
- Excluir agora: apenas artefatos locais/temporários.
- Adiar exclusão: legado Jinja/static até migrar admin/template routes para React/API.

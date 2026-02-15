#!/bin/bash
set -e

echo "=== Portal PGE — Iniciando (prod) ==="

# Inicializa banco (cria tabelas se virgem, stamp alembic se necessario)
echo "Inicializando banco de dados..."
python scripts/docker_init_db.py

# Roda migrations pendentes
echo "Executando migrations (alembic upgrade head)..."
alembic upgrade head

# Inicia servidor (exec substitui o shell pelo processo do uvicorn)
echo "Iniciando uvicorn na porta ${PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" "$@"

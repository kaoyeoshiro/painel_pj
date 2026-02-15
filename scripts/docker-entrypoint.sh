#!/bin/bash
set -e

echo "=== Portal PGE — Iniciando (prod) ==="

# Pre-deploy: garante que Alembic reconhece o estado do banco
echo "Executando pre_deploy.py..."
python scripts/pre_deploy.py

# Roda migrations pendentes
echo "Executando migrations (alembic upgrade head)..."
alembic upgrade head

# Inicia servidor (exec substitui o shell pelo processo do uvicorn)
echo "Iniciando uvicorn na porta ${PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" "$@"

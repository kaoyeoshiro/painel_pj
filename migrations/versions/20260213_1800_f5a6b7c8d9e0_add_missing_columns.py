"""add_missing_columns

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-02-13 18:00:00.000000

HOTFIX: Adiciona colunas que existem nos models mas nao foram criadas
no banco de producao. O baseline migration (create_all checkfirst=True)
so cria TABELAS faltantes, nao adiciona colunas a tabelas existentes.

Colunas adicionadas:
1. categorias_documento.resolver_config (JSON) - config do resolver BERT
2. execucoes_classificacao.max_retries (INTEGER)
3. execucoes_classificacao.ultimo_codigo_processado (VARCHAR 100)
4. execucoes_classificacao.ultimo_heartbeat (DATETIME)
5. execucoes_classificacao.tentativas_retry (INTEGER)
6. execucoes_classificacao.rota_origem (VARCHAR 200)
7. resultados_classificacao.erro_stack (TEXT)
8. resultados_classificacao.ultimo_erro_em (DATETIME)
9. resultados_classificacao.tentativas (INTEGER)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Verifica se coluna ja existe (idempotencia)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :col)"
        ),
        {"table": table_name, "col": column_name},
    )
    return result.scalar()


# Lista de colunas a adicionar: (tabela, nome, tipo SQLAlchemy, kwargs)
MISSING_COLUMNS = [
    ("categorias_documento", "resolver_config", sa.JSON(), {"nullable": True}),
    ("execucoes_classificacao", "max_retries", sa.Integer(), {"nullable": True}),
    ("execucoes_classificacao", "ultimo_codigo_processado", sa.String(100), {"nullable": True}),
    ("execucoes_classificacao", "ultimo_heartbeat", sa.DateTime(timezone=True), {"nullable": True}),
    ("execucoes_classificacao", "tentativas_retry", sa.Integer(), {"nullable": True}),
    ("execucoes_classificacao", "rota_origem", sa.String(200), {"nullable": True}),
    ("resultados_classificacao", "erro_stack", sa.Text(), {"nullable": True}),
    ("resultados_classificacao", "ultimo_erro_em", sa.DateTime(timezone=True), {"nullable": True}),
    ("resultados_classificacao", "tentativas", sa.Integer(), {"nullable": True}),
]


def upgrade() -> None:
    for table, col_name, col_type, kwargs in MISSING_COLUMNS:
        if not _column_exists(table, col_name):
            op.add_column(table, sa.Column(col_name, col_type, **kwargs))


def downgrade() -> None:
    for table, col_name, _, _ in reversed(MISSING_COLUMNS):
        if _column_exists(table, col_name):
            op.drop_column(table, col_name)

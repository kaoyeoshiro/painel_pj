"""add_activation_trace_column

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-02-13 17:00:00.000000

Adiciona coluna activation_trace (JSONB) na tabela geracoes_pecas
para armazenar o rastreamento completo de ativação de módulos.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
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


def upgrade() -> None:
    if not _column_exists("geracoes_pecas", "activation_trace"):
        op.add_column(
            "geracoes_pecas",
            sa.Column(
                "activation_trace",
                sa.JSON(),
                nullable=True,
                comment="Rastreamento de ativação de módulos (JSONB)",
            ),
        )


def downgrade() -> None:
    if _column_exists("geracoes_pecas", "activation_trace"):
        op.drop_column("geracoes_pecas", "activation_trace")

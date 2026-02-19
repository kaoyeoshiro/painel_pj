"""add_obrigatoriedade_column

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-19 10:00:00.000000

Adiciona coluna obrigatoriedade (JSON) a categorias_resumo_json.
Formato: {"ativo": bool, "tipos_peca": [str], "mensagem_quando_ausente": str}
Permite configurar categorias de documento como obrigatorias para determinados
tipos de peca, de forma generica e data-driven.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
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
    if not _column_exists("categorias_resumo_json", "obrigatoriedade"):
        op.add_column(
            "categorias_resumo_json",
            sa.Column("obrigatoriedade", sa.JSON, nullable=True),
        )


def downgrade() -> None:
    if _column_exists("categorias_resumo_json", "obrigatoriedade"):
        op.drop_column("categorias_resumo_json", "obrigatoriedade")

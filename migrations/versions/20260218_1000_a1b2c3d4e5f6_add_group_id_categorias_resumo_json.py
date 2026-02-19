"""add_group_id_categorias_resumo_json

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2026-02-18 10:00:00.000000

Adiciona group_id a categorias_resumo_json para suporte multi-grupo.
- Adiciona coluna group_id (FK para prompt_groups)
- Migra registros existentes para grupo PS
- Torna NOT NULL apos migrar dados
- Remove unique em nome isolado, cria unique (nome, group_id)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
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


def _constraint_exists(constraint_name: str) -> bool:
    """Verifica se constraint ja existe."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.table_constraints "
            "WHERE constraint_name = :name)"
        ),
        {"name": constraint_name},
    )
    return result.scalar()


def upgrade() -> None:
    # 1. Adiciona coluna group_id (nullable=True inicialmente)
    if not _column_exists("categorias_resumo_json", "group_id"):
        op.add_column(
            "categorias_resumo_json",
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("prompt_groups.id"), nullable=True),
        )

    # 2. Migra dados existentes para grupo PS
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE categorias_resumo_json "
            "SET group_id = (SELECT id FROM prompt_groups WHERE slug = 'ps' LIMIT 1) "
            "WHERE group_id IS NULL"
        )
    )

    # 3. Torna NOT NULL
    op.alter_column("categorias_resumo_json", "group_id", nullable=False)

    # 4. Cria index em group_id
    if not _constraint_exists("ix_categorias_resumo_json_group_id"):
        op.create_index("ix_categorias_resumo_json_group_id", "categorias_resumo_json", ["group_id"])

    # 5. Remove unique constraint antigo em nome (se existir)
    # PostgreSQL nomeia como categorias_resumo_json_nome_key
    if _constraint_exists("categorias_resumo_json_nome_key"):
        op.drop_constraint("categorias_resumo_json_nome_key", "categorias_resumo_json", type_="unique")

    # 6. Cria novo unique constraint (nome, group_id)
    if not _constraint_exists("uq_categoria_nome_group"):
        op.create_unique_constraint(
            "uq_categoria_nome_group",
            "categorias_resumo_json",
            ["nome", "group_id"],
        )


def downgrade() -> None:
    # Remove unique constraint novo
    if _constraint_exists("uq_categoria_nome_group"):
        op.drop_constraint("uq_categoria_nome_group", "categorias_resumo_json", type_="unique")

    # Recria unique constraint antigo em nome
    if not _constraint_exists("categorias_resumo_json_nome_key"):
        op.create_unique_constraint("categorias_resumo_json_nome_key", "categorias_resumo_json", ["nome"])

    # Remove index
    op.drop_index("ix_categorias_resumo_json_group_id", "categorias_resumo_json")

    # Remove coluna group_id
    if _column_exists("categorias_resumo_json", "group_id"):
        op.drop_column("categorias_resumo_json", "group_id")

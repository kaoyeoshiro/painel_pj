"""add_tipo_peca_grupo_categorias

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-19 11:00:00.000000

Cria tabela tipo_peca_grupo_categorias para filtro de categorias
de documento por grupo (PS, PP, Detran) e tipo de peca.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """Verifica se tabela ja existe (idempotencia)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :table)"
        ),
        {"table": table_name},
    )
    return result.scalar()


def upgrade() -> None:
    if _table_exists("tipo_peca_grupo_categorias"):
        return

    op.create_table(
        "tipo_peca_grupo_categorias",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("tipo_peca_nome", sa.String(50), nullable=False, index=True),
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("prompt_groups.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "categoria_documento_id",
            sa.Integer,
            sa.ForeignKey("categorias_documento.id"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "tipo_peca_nome",
            "group_id",
            "categoria_documento_id",
            name="uq_tpgc_tipo_group_cat",
        ),
    )

    op.create_index(
        "ix_tpgc_tipo_group",
        "tipo_peca_grupo_categorias",
        ["tipo_peca_nome", "group_id"],
    )

    # ------------------------------------------------------------------
    # Migra dados existentes de tipo_peca_categorias (sem grupo) para
    # tipo_peca_grupo_categorias (com grupo).
    # Para cada grupo ativo, replica as associacoes da tabela antiga.
    # ------------------------------------------------------------------
    conn = op.get_bind()

    has_old_table = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'tipo_peca_categorias')"
        )
    ).scalar()
    if not has_old_table:
        return

    old_count = conn.execute(
        sa.text("SELECT count(*) FROM tipo_peca_categorias")
    ).scalar()
    if not old_count:
        return

    conn.execute(sa.text("""
        INSERT INTO tipo_peca_grupo_categorias
            (tipo_peca_nome, group_id, categoria_documento_id)
        SELECT tp.nome, pg.id, tpc.categoria_documento_id
        FROM tipo_peca_categorias tpc
        JOIN tipos_peca tp ON tp.id = tpc.tipo_peca_id
        CROSS JOIN prompt_groups pg
        WHERE pg.active = true
        ON CONFLICT ON CONSTRAINT uq_tpgc_tipo_group_cat DO NOTHING
    """))


def downgrade() -> None:
    if not _table_exists("tipo_peca_grupo_categorias"):
        return

    op.drop_index("ix_tpgc_tipo_group", table_name="tipo_peca_grupo_categorias")
    op.drop_table("tipo_peca_grupo_categorias")

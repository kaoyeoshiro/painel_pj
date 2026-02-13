"""add_nota_feedback_stars

Revision ID: d3e4f5a6b7c8
Revises: c2b3d4e5f6a7
Create Date: 2026-02-13 15:00:00.000000

Padroniza feedback por estrelas (1-5) em todas as 6 tabelas de feedback.

Mudancas:
- Adiciona coluna `nota` (Integer) onde falta (feedbacks_analise, feedbacks_matricula)
- Backfill: converte avaliacao textual -> nota numerica onde nota IS NULL
- Torna `nota` NOT NULL com server_default='3' e CHECK(1..5)
- Cria UNIQUE constraint (geracao_id/consulta_id/analise_id + usuario_id)
- Cria indices para performance do dashboard (nota, criado_em)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c2b3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Mapeamento de tabela -> coluna FK (geracao_id, consulta_id ou analise_id)
FEEDBACK_TABLES = {
    "feedbacks_analise": "consulta_id",
    "feedbacks_matricula": "analise_id",
    "feedbacks_pecas": "geracao_id",
    "feedbacks_pedido_calculo": "geracao_id",
    "feedbacks_prestacao_contas": "geracao_id",
    "feedbacks_relatorio_cumprimento": "geracao_id",
}


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


def _constraint_exists(table_name: str, constraint_name: str) -> bool:
    """Verifica se constraint ja existe."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_name = :table AND constraint_name = :name)"
        ),
        {"table": table_name, "name": constraint_name},
    )
    return result.scalar()


def _index_exists(index_name: str) -> bool:
    """Verifica se indice ja existe."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :name)"
        ),
        {"name": index_name},
    )
    return result.scalar()


def upgrade() -> None:
    """Adiciona nota, backfill, constraints e indices."""

    # 1. Adicionar coluna `nota` onde falta (nullable inicialmente para backfill)
    for table in ["feedbacks_analise", "feedbacks_matricula"]:
        if not _column_exists(table, "nota"):
            op.add_column(
                table,
                sa.Column("nota", sa.Integer(), nullable=True, comment="Nota 1-5 estrelas"),
            )

    # 2. Backfill: converter avaliacao -> nota onde nota IS NULL
    for table in FEEDBACK_TABLES:
        op.execute(
            sa.text(f"""
                UPDATE {table} SET nota = CASE avaliacao
                    WHEN 'correto' THEN 5
                    WHEN 'parcial' THEN 3
                    WHEN 'incorreto' THEN 2
                    WHEN 'erro_ia' THEN 1
                    ELSE 3
                END WHERE nota IS NULL
            """)
        )

    # 3. Tornar NOT NULL + CHECK constraint
    for table in FEEDBACK_TABLES:
        op.alter_column(
            table, "nota",
            existing_type=sa.Integer(),
            nullable=False,
            server_default="3",
        )

        ck_name = f"ck_{table}_nota_range"
        if not _constraint_exists(table, ck_name):
            op.create_check_constraint(ck_name, table, "nota >= 1 AND nota <= 5")

    # 4. UNIQUE constraint: 1 feedback por geracao/consulta/analise por usuario
    unique_constraints = {
        "feedbacks_analise": ("uq_feedbacks_analise_consulta_user", ["consulta_id", "usuario_id"]),
        "feedbacks_matricula": ("uq_feedbacks_matricula_analise_user", ["analise_id", "usuario_id"]),
        "feedbacks_pecas": ("uq_feedbacks_pecas_geracao_user", ["geracao_id", "usuario_id"]),
        "feedbacks_pedido_calculo": ("uq_feedbacks_pedcalc_geracao_user", ["geracao_id", "usuario_id"]),
        "feedbacks_prestacao_contas": ("uq_feedbacks_prestacao_geracao_user", ["geracao_id", "usuario_id"]),
        "feedbacks_relatorio_cumprimento": ("uq_feedbacks_relcumpr_geracao_user", ["geracao_id", "usuario_id"]),
    }

    for table, (uq_name, cols) in unique_constraints.items():
        if not _constraint_exists(table, uq_name):
            # Remover duplicatas antes de criar constraint
            fk_col = cols[0]
            op.execute(
                sa.text(f"""
                    DELETE FROM {table}
                    WHERE id NOT IN (
                        SELECT MIN(id) FROM {table}
                        GROUP BY {fk_col}, usuario_id
                    )
                """)
            )
            op.create_unique_constraint(uq_name, table, cols)

    # 5. Indices para dashboard performance
    for table in FEEDBACK_TABLES:
        idx_nota = f"ix_{table}_nota"
        if not _index_exists(idx_nota):
            op.create_index(idx_nota, table, ["nota"])

        idx_criado = f"ix_{table}_criado_em"
        if not _index_exists(idx_criado):
            op.create_index(idx_criado, table, ["criado_em"])


def downgrade() -> None:
    """Reverte: remove indices, constraints, coluna nota (onde adicionada)."""

    # Remover indices
    for table in FEEDBACK_TABLES:
        idx_nota = f"ix_{table}_nota"
        if _index_exists(idx_nota):
            op.drop_index(idx_nota, table_name=table)

        idx_criado = f"ix_{table}_criado_em"
        if _index_exists(idx_criado):
            op.drop_index(idx_criado, table_name=table)

    # Remover UNIQUE constraints
    for table, uq_name in [
        ("feedbacks_analise", "uq_feedbacks_analise_consulta_user"),
        ("feedbacks_matricula", "uq_feedbacks_matricula_analise_user"),
        ("feedbacks_pecas", "uq_feedbacks_pecas_geracao_user"),
        ("feedbacks_pedido_calculo", "uq_feedbacks_pedcalc_geracao_user"),
        ("feedbacks_prestacao_contas", "uq_feedbacks_prestacao_geracao_user"),
        ("feedbacks_relatorio_cumprimento", "uq_feedbacks_relcumpr_geracao_user"),
    ]:
        if _constraint_exists(table, uq_name):
            op.drop_constraint(uq_name, table, type_="unique")

    # Remover CHECK constraints
    for table in FEEDBACK_TABLES:
        ck_name = f"ck_{table}_nota_range"
        if _constraint_exists(table, ck_name):
            op.drop_constraint(ck_name, table, type_="check")

    # Reverter NOT NULL (voltar para nullable)
    for table in FEEDBACK_TABLES:
        op.alter_column(
            table, "nota",
            existing_type=sa.Integer(),
            nullable=True,
            server_default=None,
        )

    # Remover coluna nota das tabelas onde foi adicionada
    for table in ["feedbacks_analise", "feedbacks_matricula"]:
        if _column_exists(table, "nota"):
            op.drop_column(table, "nota")

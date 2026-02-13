"""add_stopping_status_to_jobstatus_enum

Revision ID: 0fc5d5f02232
Revises: a7c3b8d2e1f0
Create Date: 2026-02-04 11:22:13.267374

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0fc5d5f02232'
down_revision: Union[str, None] = 'a7c3b8d2e1f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Adiciona 'stopping' ao enum jobstatus."""
    # PostgreSQL permite adicionar valores a enums existentes
    op.execute("ALTER TYPE jobstatus ADD VALUE IF NOT EXISTS 'stopping' AFTER 'training'")


def downgrade() -> None:
    """Remove 'stopping' do enum jobstatus."""
    # PostgreSQL não permite remover valores de enums facilmente
    # Seria necessário recriar o enum, o que é complexo
    # Por simplicidade, deixamos o valor (não causa problemas)
    pass

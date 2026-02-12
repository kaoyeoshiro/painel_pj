"""baseline_schema_completo

Revision ID: 9e503612a490
Revises: 0fc5d5f02232
Create Date: 2026-02-11 22:43:05.630350

BASELINE: Garante que todas as tabelas definidas nos models existam no banco.

Usa Base.metadata.create_all(checkfirst=True), que e idempotente:
- Banco existente (producao): nenhuma alteracao (tabelas ja existem)
- Banco novo (CI, dev): cria todas as 72+ tabelas baseadas nos models

Discrepancias conhecidas entre models e banco de producao:
- BERT models usam JSON nos models mas JSONB no banco (manter JSONB)
- extraction_questions tem colunas fonte_verdade_* no banco mas nao nos models
- performance_logs tem user_id/username no banco mas nao no model
- prompt_groups tem ref_base/peca_group_id no banco mas nao no model
- Varios indexes manuais (idx_*) que nao estao nos models
- Server defaults e comments divergentes
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e503612a490'
down_revision: Union[str, None] = '0fc5d5f02232'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria todas as tabelas baseadas nos models atuais.

    checkfirst=True garante idempotencia: tabelas que ja existem
    nao sao recriadas. Em bancos novos (CI), cria tudo do zero.
    """
    # Importa o Base que ja tem todos os models registrados
    # (via imports no topo de migrations/env.py)
    from database.connection import Base

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    """Baseline — nao e possivel fazer downgrade alem deste ponto."""
    pass

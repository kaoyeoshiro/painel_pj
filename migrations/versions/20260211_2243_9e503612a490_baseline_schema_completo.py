"""baseline_schema_completo

Revision ID: 9e503612a490
Revises: 0fc5d5f02232
Create Date: 2026-02-11 22:43:05.630350

NOTA: Esta migration e uma BASELINE — serve como ponto de referencia
para que o Alembic saiba que o banco esta sincronizado ate aqui.

O autogenerate detectou diffs entre models e banco existente
(JSONB vs JSON, colunas extras no banco, indexes manuais).
Esses diffs serao tratados em migrations separadas com revisao manual,
para evitar perda de dados ou regressao de performance.

Discrepancias conhecidas (tratar em migrations futuras):
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
    """Baseline — nenhuma alteracao aplicada.

    O banco existente ja contem todas as tabelas e colunas necessarias.
    Esta migration serve apenas como ponto de referencia para o Alembic.
    """
    pass


def downgrade() -> None:
    """Baseline — nenhuma alteracao a reverter."""
    pass

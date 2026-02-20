"""alter_column_types

Revision ID: b1a2c3d4e5f6
Revises: 9e503612a490
Create Date: 2026-02-11 23:30:00.000000

Corrige tipos de colunas que divergiam entre models e banco.
Estas alteracoes ja foram aplicadas em producao via run_migrations()
(init_db.py), mas precisam estar registradas no Alembic para
manter a cadeia de migrations consistente.

Alteracoes:
1. geracoes_pecas.conteudo_gerado: JSON → TEXT
2. geracoes_prestacao_contas.numero_cnj_formatado: VARCHAR(20) → VARCHAR(30)
3. prompt_activation_logs.modo_ativacao: VARCHAR(30) → TEXT
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1a2c3d4e5f6'
down_revision: Union[str, None] = '0fc5d5f02232'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Ajusta tipos de colunas para corresponder aos models."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Helper: verifica se tabela existe antes de alterar
    tables = set(inspector.get_table_names())

    # 1. geracoes_pecas.conteudo_gerado: JSON → TEXT
    if 'geracoes_pecas' in tables:
        columns = {c['name']: c for c in inspector.get_columns('geracoes_pecas')}
        if 'conteudo_gerado' in columns:
            col_type = str(columns['conteudo_gerado']['type']).upper()
            if 'JSON' in col_type:
                op.execute(
                    "ALTER TABLE geracoes_pecas "
                    "ALTER COLUMN conteudo_gerado TYPE TEXT "
                    "USING conteudo_gerado::text"
                )

    # 2. geracoes_prestacao_contas.numero_cnj_formatado: VARCHAR(20) → VARCHAR(30)
    if 'geracoes_prestacao_contas' in tables:
        op.alter_column(
            'geracoes_prestacao_contas',
            'numero_cnj_formatado',
            type_=sa.String(30),
            existing_type=sa.String(20),
        )

    # 3. prompt_activation_logs.modo_ativacao: VARCHAR(30) → TEXT
    if 'prompt_activation_logs' in tables:
        op.alter_column(
            'prompt_activation_logs',
            'modo_ativacao',
            type_=sa.Text(),
            existing_type=sa.String(30),
        )


def downgrade() -> None:
    """Downgrade seguro — nao reverte tipos para evitar perda de dados.

    Reverter TEXT → VARCHAR(30) truncaria dados existentes.
    Reverter TEXT → JSON falharia se conteudo nao for JSON valido.
    Reverter VARCHAR(30) → VARCHAR(20) truncaria CNJs formatados.
    """
    pass

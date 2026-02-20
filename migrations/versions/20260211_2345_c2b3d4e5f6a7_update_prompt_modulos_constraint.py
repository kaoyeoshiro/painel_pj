"""update_prompt_modulos_constraint

Revision ID: c2b3d4e5f6a7
Revises: b1a2c3d4e5f6
Create Date: 2026-02-11 23:45:00.000000

Atualiza UniqueConstraint em prompt_modulos para incluir group_id.
Necessario apos migracao de prompts base/peca por grupo (PS, PP, DETRAN).

Antes: UNIQUE(tipo, categoria, subcategoria, nome)
Depois: UNIQUE(tipo, nome, group_id)

Ja aplicado em producao via migrate_per_group_prompts() em init_db.py.
Inclui limpeza de duplicatas e FK refs para garantir idempotencia.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2b3d4e5f6a7'
down_revision: Union[str, None] = 'b1a2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tabelas com FK para prompt_modulos
_FK_TABLES = [
    ('modulo_embeddings', 'modulo_id'),
    ('prompt_modulos_historico', 'modulo_id'),
    ('regra_deterministica_tipo_peca', 'modulo_id'),
    ('prompt_activation_logs', 'prompt_id'),
    ('prompt_modulo_subcategorias', 'modulo_id'),
    ('prompt_modulo_tipo_peca', 'modulo_id'),
    ('prompt_variable_usage', 'prompt_id'),
]


def _remove_duplicates(tables: set[str], group_cols: list[str]) -> None:
    """Remove APENAS duplicatas reais de base/peca (criadas por migrate_per_group_prompts).

    IMPORTANTE: Nunca deletar prompts de tipo 'conteudo' — eles sao criados
    manualmente pelos usuarios e nao devem ser tratados como duplicatas.
    """
    group_by = ", ".join(group_cols)

    # Apenas prompts base/peca podem ter duplicatas (criadas pela migracao por grupo)
    tipo_filter = "tipo IN ('base', 'peca')"

    dup_subquery = (
        f"SELECT id FROM prompt_modulos WHERE {tipo_filter} AND id NOT IN ("
        f"  SELECT MIN(id) FROM prompt_modulos WHERE {tipo_filter} GROUP BY {group_by}"
        f")"
    )

    # Remove refs de FK apontando para as duplicatas
    for fk_table, fk_col in _FK_TABLES:
        if fk_table in tables:
            op.execute(
                f"DELETE FROM {fk_table} WHERE {fk_col} IN ({dup_subquery})"
            )

    # Remove apenas duplicatas de base/peca
    op.execute(
        f"DELETE FROM prompt_modulos WHERE {tipo_filter} AND id NOT IN ("
        f"  SELECT MIN(id) FROM prompt_modulos WHERE {tipo_filter} GROUP BY {group_by}"
        f")"
    )


def upgrade() -> None:
    """Troca UniqueConstraint para incluir group_id."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if 'prompt_modulos' not in tables:
        return

    constraints = {c['name'] for c in inspector.get_unique_constraints('prompt_modulos')}

    # Constraint nova ja existe (producao) — nada a fazer
    if 'uq_prompt_modulo_group' in constraints:
        return

    # Remove constraint antiga se existir
    if 'uq_prompt_modulo' in constraints:
        op.drop_constraint('uq_prompt_modulo', 'prompt_modulos', type_='unique')

    # Limpa duplicatas (com FKs) e cria constraint nova
    _remove_duplicates(tables, ['tipo', 'nome', 'group_id'])
    op.create_unique_constraint(
        'uq_prompt_modulo_group',
        'prompt_modulos',
        ['tipo', 'nome', 'group_id'],
    )


def downgrade() -> None:
    """Reverte para constraint original."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if 'prompt_modulos' not in tables:
        return

    constraints = {c['name'] for c in inspector.get_unique_constraints('prompt_modulos')}

    if 'uq_prompt_modulo_group' in constraints:
        op.drop_constraint('uq_prompt_modulo_group', 'prompt_modulos', type_='unique')

    if 'uq_prompt_modulo' not in constraints:
        _remove_duplicates(tables, ['tipo', 'categoria', 'subcategoria', 'nome'])
        op.create_unique_constraint(
            'uq_prompt_modulo',
            'prompt_modulos',
            ['tipo', 'categoria', 'subcategoria', 'nome'],
        )

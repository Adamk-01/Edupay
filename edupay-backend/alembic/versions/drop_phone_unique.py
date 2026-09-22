"""drop unique constraint on phone column

Revision ID: drop_phone_unique
Revises: 7de558c1e5ce
Create Date: 2026-09-01 12:00:00.000000
"""
from alembic import op

revision = 'drop_phone_unique'
down_revision = '7de558c1e5ce'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index('ix_users_phone', table_name='users', if_exists=True)
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('users_phone_key', type_='unique')


def downgrade():
    with op.batch_alter_table('users') as batch_op:
        batch_op.create_unique_constraint('users_phone_key', ['phone'])

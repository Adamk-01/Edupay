"""Add non-negative balance check constraint to wallets table

Revision ID: add_wallet_balance_check
Revises: drop_phone_unique
Create Date: 2026-09-04 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_wallet_balance_check'
down_revision = 'drop_phone_unique'
branch_labels = None
depends_on = None


def upgrade():
    op.create_check_constraint(
        'ck_wallet_balance_non_negative',
        'wallets',
        'balance >= 0',
    )


def downgrade():
    op.drop_constraint(
        'ck_wallet_balance_non_negative',
        'wallets',
        type_='check',
    )

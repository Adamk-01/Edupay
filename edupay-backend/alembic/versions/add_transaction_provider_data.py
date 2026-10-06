"""add provider_data to transactions

Revision ID: add_transaction_provider_data
Revises: drop_phone_unique
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "add_transaction_provider_data"
down_revision = ("drop_phone_unique", "arewa_service_prices")
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("transactions", sa.Column("provider_data", JSONB, nullable=True))


def downgrade():
    op.drop_column("transactions", "provider_data")

"""Persist EduPay selling prices for Arewa Gate services."""

from alembic import op
import sqlalchemy as sa


revision = "arewa_service_prices"
down_revision = "add_wallet_balance_check"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "arewa_service_prices",
        sa.Column("category", sa.String(length=100), primary_key=True),
        sa.Column("service_slug", sa.String(length=150), primary_key=True),
        sa.Column("sell_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("arewa_service_prices")
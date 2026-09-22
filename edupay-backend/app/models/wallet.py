import uuid
import enum
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, Numeric, DateTime, ForeignKey, String, Enum, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class TransactionType(str, enum.Enum):
    credit = "credit"
    debit  = "debit"


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed  = "failed"


class Wallet(Base):
    __tablename__ = "wallets"
    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_wallet_balance_non_negative"),
    )

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    balance    = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="wallet")


class Transaction(Base):
    __tablename__ = "transactions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount      = Column(Numeric(12, 2), nullable=False)
    type        = Column(Enum(TransactionType), nullable=False)
    status      = Column(Enum(TransactionStatus), default=TransactionStatus.pending)
    reference   = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="transactions")

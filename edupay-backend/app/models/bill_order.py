import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class BillCategory(str, enum.Enum):
    airtime     = "airtime"
    data        = "data"
    electricity = "electricity"
    cable       = "cable"


class BillOrderStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed  = "failed"


class BillOrder(Base):
    __tablename__ = "bill_orders"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category     = Column(Enum(BillCategory), nullable=False)
    provider     = Column(String, nullable=False)
    account_no   = Column(String, nullable=False)
    amount       = Column(Numeric(10, 2), nullable=False)
    extra        = Column(String, nullable=True)
    reference    = Column(String, unique=True, nullable=False)
    status       = Column(Enum(BillOrderStatus), default=BillOrderStatus.pending)
    provider_ref = Column(String, nullable=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="bill_orders")

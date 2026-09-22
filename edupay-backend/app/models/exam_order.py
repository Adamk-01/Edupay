import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ExamType(str, enum.Enum):
    JAMB_EPIN   = "JAMB_EPIN"
    JAMB_RESULT = "JAMB_RESULT"
    WAEC_PIN    = "WAEC_PIN"
    WAEC_REG    = "WAEC_REG"
    NECO_PIN    = "NECO_PIN"
    NECO_REG    = "NECO_REG"


class OrderStatus(str, enum.Enum):
    pending    = "pending"
    processing = "processing"
    completed  = "completed"
    failed     = "failed"


class ExamOrder(Base):
    __tablename__ = "exam_orders"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    exam_type    = Column(Enum(ExamType), nullable=False)
    quantity     = Column(Integer, default=1)
    unit_price   = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    phone        = Column(String, nullable=False)
    email        = Column(String, nullable=False)
    status       = Column(Enum(OrderStatus), default=OrderStatus.pending)
    pins_data    = Column(String, nullable=True)   # JSON list of PINs
    reference    = Column(String, unique=True, nullable=False)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="exam_orders")

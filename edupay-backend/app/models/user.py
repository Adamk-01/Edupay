import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    student = "student"
    admin   = "admin"


class User(Base):
    __tablename__ = "users"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email           = Column(String, unique=True, nullable=False, index=True)
    phone           = Column(String, unique=True, nullable=True)
    full_name       = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(Enum(UserRole), default=UserRole.student, nullable=False)
    is_active       = Column(Boolean, default=True)
    is_verified     = Column(Boolean, default=False)
    referral_code   = Column(String, unique=True, nullable=True)
    referred_by     = Column(String, nullable=True)
    state_of_origin = Column(String, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    wallet        = relationship("Wallet",       back_populates="user", uselist=False, cascade="all, delete-orphan")
    transactions  = relationship("Transaction",  back_populates="user")
    exam_orders   = relationship("ExamOrder",    back_populates="user")

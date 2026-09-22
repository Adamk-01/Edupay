import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.ext.hybrid import hybrid_property
from app.utils.crypto import encrypt, decrypt
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
    _phone          = Column('phone', String, nullable=True)
    _full_name      = Column('full_name', String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(Enum(UserRole), default=UserRole.student, nullable=False)
    is_active           = Column(Boolean, default=True)
    is_verified         = Column(Boolean, default=False)
    verification_otp    = Column(String, nullable=True)
    otp_expires_at      = Column(DateTime, nullable=True)
    referral_code   = Column(String, unique=True, nullable=True)
    referred_by     = Column(String, nullable=True)
    state_of_origin = Column(String, nullable=True)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @hybrid_property
    def full_name(self) -> str:
        return decrypt(self._full_name) if self._full_name else None

    @full_name.setter
    def full_name(self, value: str):
        self._full_name = encrypt(value) if value else None

    @hybrid_property
    def phone(self) -> str:
        return decrypt(self._phone) if self._phone else None

    @phone.setter
    def phone(self, value: str):
        self._phone = encrypt(value) if value else None

    wallet        = relationship("Wallet",       back_populates="user", uselist=False, cascade="all, delete-orphan")
    transactions  = relationship("Transaction",  back_populates="user")
    exam_orders   = relationship("ExamOrder",    back_populates="user")

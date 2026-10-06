from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Numeric, String

from app.core.database import Base


class ArewaServicePrice(Base):
    __tablename__ = "arewa_service_prices"

    category = Column(String(100), primary_key=True)
    service_slug = Column(String(150), primary_key=True)
    sell_price = Column(Numeric(12, 2), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
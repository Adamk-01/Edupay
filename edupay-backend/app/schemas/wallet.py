from typing import Optional, List, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, field_validator


class FundWalletRequest(BaseModel):
    amount:         Decimal
    payment_method: str = "card"   # card | transfer | ussd


class FundWalletResponse(BaseModel):
    authorization_url: str
    access_code:       str
    reference:         str


class WalletOut(BaseModel):
    id:         str
    balance:    Decimal
    updated_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return str(v)

    class Config:
        from_attributes = True


class TransactionOut(BaseModel):
    id:          str
    amount:      Decimal
    type:        str
    status:      str
    reference:   str
    description: Optional[str]
    created_at:  datetime

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return str(v)

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    transactions: List[TransactionOut]
    total:        int
    page:         int
    pages:        int

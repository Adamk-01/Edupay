import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.models.user   import User
from app.models.wallet import Wallet, Transaction, TransactionType, TransactionStatus
from app.schemas.wallet import (
    FundWalletRequest, FundWalletResponse,
    WalletOut, TransactionListResponse,
)
from app.dependencies import get_current_user, require_verified
from app.services.paystack_service import PaystackService
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router  = APIRouter(prefix="/wallet", tags=["Wallet"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/", response_model=WalletOut)
async def get_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet


@router.post("/fund", response_model=FundWalletResponse)
@limiter.limit("10/minute")
async def initiate_funding(
    request: Request,
    data: FundWalletRequest,
    current_user: User = Depends(require_verified),
    db: Session = Depends(get_db),
):
    if data.amount < Decimal("100"):
        raise HTTPException(status_code=400, detail="Minimum funding amount is ₦100")

    reference = f"EDUPAY-FUND-{uuid.uuid4().hex[:12].upper()}"

    transaction = Transaction(
        user_id=current_user.id,
        amount=data.amount,
        type=TransactionType.credit,
        status=TransactionStatus.pending,
        reference=reference,
        description=f"Wallet funding via Paystack",
    )
    db.add(transaction)
    db.commit()

    paystack = PaystackService()

    if not paystack.enabled:
        if settings.ENVIRONMENT == "development":
            logger.info("Dev mode: Paystack not configured. Simulating redirect for ref=%s", reference)
            return FundWalletResponse(
                authorization_url=f"{settings.FRONTEND_URL}/payment/verify?reference={reference}&trxref={reference}",
                access_code="DEV_MOCK",
                reference=reference,
            )
        raise HTTPException(
            status_code=400,
            detail="Paystack is not configured. Add PAYSTACK_SECRET_KEY to .env and restart.",
        )

    try:
        result = await paystack.initialize_payment(
            email=current_user.email,
            amount=float(data.amount),
            reference=reference,
            callback_url=f"{settings.FRONTEND_URL}/payment/verify?reference={reference}&trxref={reference}",
        )
    except Exception as e:
        logger.exception("Paystack initialize failed for user %s", current_user.id)
        raise HTTPException(status_code=502, detail=str(e))

    return FundWalletResponse(
        authorization_url=result["authorization_url"],
        access_code=result["access_code"],
        reference=reference,
    )


@router.get("/transactions", response_model=TransactionListResponse)
@limiter.limit("60/minute")
async def get_transactions(
    request: Request,
    page:   int           = Query(1, ge=1),
    limit:  int           = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    type:   Optional[str] = Query(None),
    current_user: User    = Depends(get_current_user),
    db: Session           = Depends(get_db),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if status: query = query.filter(Transaction.status == status)
    if type:   query = query.filter(Transaction.type   == type)

    total        = query.count()
    transactions = (
        query
        .order_by(desc(Transaction.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "transactions": transactions,
        "total":        total,
        "page":         page,
        "pages":        max(1, (total + limit - 1) // limit),
    }

import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.user   import User
from app.models.wallet import Wallet, Transaction, TransactionType, TransactionStatus
from app.schemas.wallet import (
    FundWalletRequest, FundWalletResponse,
    WalletOut, TransactionListResponse,
)
from app.dependencies        import get_current_user
from app.services.paystack_service import PaystackService

router   = APIRouter(prefix="/wallet", tags=["Wallet"])
paystack = PaystackService()


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
async def initiate_funding(
    data: FundWalletRequest,
    current_user: User = Depends(get_current_user),
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
        description=f"Wallet funding via {data.payment_method}",
    )
    db.add(transaction)
    db.commit()

    result = await paystack.initialize_payment(
        email=current_user.email,
        amount=int(data.amount * 100),
        reference=reference,
        callback_url=f"http://localhost:5173/payment/verify?ref={reference}",
    )

    return FundWalletResponse(
        authorization_url=result["authorization_url"],
        access_code=result["access_code"],
        reference=reference,
    )


@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(
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

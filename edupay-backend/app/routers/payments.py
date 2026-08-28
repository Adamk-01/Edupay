import hashlib
import hmac
import json
from decimal import Decimal
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config   import settings
from app.models.wallet import Wallet, Transaction, TransactionStatus

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/webhook/paystack")
async def paystack_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    body      = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    # Verify webhook signature
    expected = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode(),
        body,
        hashlib.sha512,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = json.loads(body)
    event   = payload.get("event")
    data    = payload.get("data", {})

    if event == "charge.success":
        reference   = data.get("reference")
        amount_kobo = data.get("amount", 0)
        amount_naira = Decimal(str(amount_kobo)) / 100

        transaction = db.query(Transaction).filter(
            Transaction.reference == reference,
            Transaction.status    == TransactionStatus.pending,
        ).first()

        if transaction:
            transaction.status = TransactionStatus.success

            wallet = db.query(Wallet).filter(
                Wallet.user_id == transaction.user_id
            ).with_for_update().first()

            if wallet:
                wallet.balance += transaction.amount

            db.commit()

    return {"status": "ok"}

import uuid
import logging
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from app.core.database import get_db
from app.models.user import User
from app.models.wallet import Wallet, Transaction, TransactionType, TransactionStatus
from app.models.bill_order import BillOrder, BillCategory, BillOrderStatus
from app.dependencies import get_current_user, require_verified
from app.services.vtu_service import VTUService
from app.services.email_service import send_order_confirmation

router = APIRouter(prefix="/bills", tags=["Bills & VTU"])
logger = logging.getLogger(__name__)

# Factory for VTUService (Task 14)
_vtu_instance: Optional[VTUService] = None

def get_vtu() -> VTUService:
    global _vtu_instance
    if _vtu_instance is None:
        _vtu_instance = VTUService()
    return _vtu_instance


# ── Schemas ───────────────────────────────────────────────────
class AirtimeRequest(BaseModel):
    provider: str
    phone:    str
    amount:   Decimal


class DataRequest(BaseModel):
    provider:  str
    phone:     str
    bundle_id: str
    amount:    Decimal


class ElectricityRequest(BaseModel):
    provider:     str
    meter_number: str
    amount:       Decimal
    meter_type:   str = "prepaid"


class CableRequest(BaseModel):
    provider:   str
    smart_card: str
    package_id: str
    amount:     Decimal


# ── Helpers ───────────────────────────────────────────────────
async def _deduct_and_record(
    db: Session, user: User, amount: Decimal,
    category: BillCategory, provider: str,
    account_no: str, extra: str = None,
):
    """Atomically deduct balance and commit transaction before calling external provider.
    Prevents race condition and double-spending.
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    wallet = db.query(Wallet).filter(
        Wallet.user_id == user.id
    ).with_for_update().first()

    if not wallet or wallet.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    reference = f"EDUPAY-BILL-{uuid.uuid4().hex[:12].upper()}"
    wallet.balance -= amount

    txn = Transaction(
        user_id=user.id,
        amount=amount,
        type=TransactionType.debit,
        status=TransactionStatus.pending,
        reference=reference,
        description=f"{category.value if hasattr(category, 'value') else category} – {provider} – {account_no}",
    )
    order = BillOrder(
        user_id=user.id,
        category=category,
        provider=provider,
        account_no=account_no,
        amount=amount,
        extra=extra,
        reference=reference,
    )

    try:
        db.add(txn)
        db.add(order)
        db.commit()
        db.refresh(order)
        db.refresh(txn)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Transaction failed: Insufficient balance or invalid data")

    return order, txn, reference


async def _finalize(
    db: Session, order_id: uuid.UUID, txn_id: uuid.UUID,
    success: bool, provider_ref: str = None,
):
    """Finalize order status and refund wallet if operation failed."""
    order = db.query(BillOrder).filter(BillOrder.id == order_id).first()
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()

    if not order or not txn:
        logger.error("Failed to finalize order %s / txn %s: record not found", order_id, txn_id)
        return

    order.status = BillOrderStatus.success if success else BillOrderStatus.failed
    order.provider_ref = provider_ref
    txn.status = TransactionStatus.success if success else TransactionStatus.failed

    if not success:
        wallet = db.query(Wallet).filter(
            Wallet.user_id == order.user_id
        ).with_for_update().first()
        if wallet:
            wallet.balance += order.amount
            refund_txn = Transaction(
                user_id=order.user_id,
                amount=order.amount,
                type=TransactionType.credit,
                status=TransactionStatus.success,
                reference=f"REFUND-{order.reference}",
                description=f"Refund: Failed {order.category.value if hasattr(order.category, 'value') else order.category} purchase",
            )
            db.add(refund_txn)

    db.commit()


# ── Routes ────────────────────────────────────────────────────
@router.get("/providers")
async def get_providers():
    return {
        "airtime": [
            {"id": "MTN",     "name": "MTN",     "color": "#FFCB05"},
            {"id": "Airtel",  "name": "Airtel",  "color": "#EF4444"},
            {"id": "Glo",     "name": "Glo",     "color": "#16A34A"},
            {"id": "9mobile", "name": "9mobile", "color": "#22D3EE"},
        ],
        "data": [
            {"id": "MTN",     "name": "MTN",     "color": "#FFCB05"},
            {"id": "Airtel",  "name": "Airtel",  "color": "#EF4444"},
            {"id": "Glo",     "name": "Glo",     "color": "#16A34A"},
            {"id": "9mobile", "name": "9mobile", "color": "#22D3EE"},
        ],
        "electricity": [
            {"id": "IKEDC", "name": "IKEDC", "color": "#1A56DB"},
            {"id": "EKEDC", "name": "EKEDC", "color": "#EA580C"},
            {"id": "IBEDC", "name": "IBEDC", "color": "#7C3AED"},
            {"id": "PHED",  "name": "PHED",  "color": "#0F766E"},
        ],
        "cable": [
            {"id": "DStv",      "name": "DStv",      "color": "#1A56DB"},
            {"id": "GOtv",      "name": "GOtv",      "color": "#16A34A"},
            {"id": "Startimes", "name": "Startimes", "color": "#DC2626"},
            {"id": "ShowMax",   "name": "ShowMax",   "color": "#F59E0B"},
        ],
    }


@router.get("/data-bundles/{provider}")
async def get_data_bundles(provider: str):
    STATIC_BUNDLES = {
        "MTN": [
            {"id": "mtn-1gb-1d",   "size": "1GB",  "price": 300,  "validity": "1 day"},
            {"id": "mtn-2gb-30d",  "size": "2GB",  "price": 500,  "validity": "30 days"},
            {"id": "mtn-5gb-30d",  "size": "5GB",  "price": 1500, "validity": "30 days"},
            {"id": "mtn-10gb-30d", "size": "10GB", "price": 2500, "validity": "30 days"},
            {"id": "mtn-20gb-30d", "size": "20GB", "price": 3500, "validity": "30 days"},
            {"id": "mtn-50gb-30d", "size": "50GB", "price": 7000, "validity": "30 days"},
        ],
        "Airtel": [
            {"id": "airtel-1gb-7d",   "size": "1GB",  "price": 350,  "validity": "7 days"},
            {"id": "airtel-3gb-30d",  "size": "3GB",  "price": 1000, "validity": "30 days"},
            {"id": "airtel-6gb-30d",  "size": "6GB",  "price": 1500, "validity": "30 days"},
            {"id": "airtel-10gb-30d", "size": "10GB", "price": 2500, "validity": "30 days"},
        ],
        "Glo": [
            {"id": "glo-2gb-30d",  "size": "2GB",  "price": 500,  "validity": "30 days"},
            {"id": "glo-7gb-30d",  "size": "7GB",  "price": 1500, "validity": "30 days"},
            {"id": "glo-14gb-30d", "size": "14GB", "price": 2500, "validity": "30 days"},
        ],
        "9mobile": [
            {"id": "9m-1.5gb-30d", "size": "1.5GB", "price": 500,  "validity": "30 days"},
            {"id": "9m-4.5gb-30d", "size": "4.5GB", "price": 1500, "validity": "30 days"},
        ],
    }
    return {"bundles": STATIC_BUNDLES.get(provider, [])}


@router.post("/airtime")
async def buy_airtime(
    data: AirtimeRequest,
    current_user: User = Depends(require_verified),
    db: Session = Depends(get_db),
    vtu: VTUService = Depends(get_vtu),
):
    if data.amount < 50 or data.amount > 50000:
        raise HTTPException(status_code=400, detail="Amount must be between ₦50 and ₦50,000")

    order, txn, reference = await _deduct_and_record(
        db, current_user, data.amount,
        BillCategory.airtime, data.provider, data.phone,
    )
    try:
        result = await vtu.buy_airtime(data.provider, data.phone, float(data.amount), reference)
        await _finalize(db, order.id, txn.id, success=True, provider_ref=result.get("ref"))
        await run_in_threadpool(send_order_confirmation, current_user.email, current_user.full_name, reference, f"{data.provider} Airtime ₦{data.amount}")
        return {"success": True, "reference": reference, "message": f"₦{data.amount} airtime sent to {data.phone}"}
    except Exception:
        logger.exception("Airtime purchase failed: ref=%s", reference)
        await _finalize(db, order.id, txn.id, success=False)
        raise HTTPException(status_code=502, detail="Airtime purchase failed. Your wallet has been refunded.")


@router.post("/data")
async def buy_data(
    data: DataRequest,
    current_user: User = Depends(require_verified),
    db: Session = Depends(get_db),
    vtu: VTUService = Depends(get_vtu),
):
    order, txn, reference = await _deduct_and_record(
        db, current_user, data.amount,
        BillCategory.data, data.provider, data.phone, extra=data.bundle_id,
    )
    try:
        result = await vtu.buy_data(data.provider, data.phone, data.bundle_id, reference)
        await _finalize(db, order.id, txn.id, success=True, provider_ref=result.get("ref"))
        await run_in_threadpool(send_order_confirmation, current_user.email, current_user.full_name, reference, f"{data.provider} Data Bundle")
        return {"success": True, "reference": reference, "message": f"Data bundle activated on {data.phone}"}
    except Exception:
        logger.exception("Data purchase failed: ref=%s", reference)
        await _finalize(db, order.id, txn.id, success=False)
        raise HTTPException(status_code=502, detail="Data purchase failed. Your wallet has been refunded.")


@router.post("/electricity")
async def pay_electricity(
    data: ElectricityRequest,
    current_user: User = Depends(require_verified),
    db: Session = Depends(get_db),
    vtu: VTUService = Depends(get_vtu),
):
    if data.amount < 500:
        raise HTTPException(status_code=400, detail="Minimum electricity payment is ₦500")

    order, txn, reference = await _deduct_and_record(
        db, current_user, data.amount,
        BillCategory.electricity, data.provider, data.meter_number, extra=data.meter_type,
    )
    try:
        result = await vtu.pay_electricity(
            data.provider, data.meter_number, float(data.amount), data.meter_type, reference
        )
        token = result.get("token", "")
        await _finalize(db, order.id, txn.id, success=True, provider_ref=result.get("ref"))
        await run_in_threadpool(send_order_confirmation, current_user.email, current_user.full_name, reference, f"{data.provider} Electricity")
        return {
            "success":   True,
            "reference": reference,
            "token":     token,
            "message":   f"Electricity token: {token}" if token else "Payment successful",
        }
    except Exception:
        logger.exception("Electricity payment failed: ref=%s", reference)
        await _finalize(db, order.id, txn.id, success=False)
        raise HTTPException(status_code=502, detail="Electricity payment failed. Your wallet has been refunded.")


@router.post("/cable")
async def pay_cable(
    data: CableRequest,
    current_user: User = Depends(require_verified),
    db: Session = Depends(get_db),
    vtu: VTUService = Depends(get_vtu),
):
    order, txn, reference = await _deduct_and_record(
        db, current_user, data.amount,
        BillCategory.cable, data.provider, data.smart_card, extra=data.package_id,
    )
    try:
        result = await vtu.pay_cable(data.provider, data.smart_card, data.package_id, reference)
        await _finalize(db, order.id, txn.id, success=True, provider_ref=result.get("ref"))
        await run_in_threadpool(send_order_confirmation, current_user.email, current_user.full_name, reference, f"{data.provider} Cable Subscription")
        return {"success": True, "reference": reference, "message": f"{data.provider} subscription renewed"}
    except Exception:
        logger.exception("Cable payment failed: ref=%s", reference)
        await _finalize(db, order.id, txn.id, success=False)
        raise HTTPException(status_code=502, detail="Cable payment failed. Your wallet has been refunded.")


@router.get("/history")
async def bill_history(
    category:     Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    query = db.query(BillOrder).filter(BillOrder.user_id == current_user.id)
    if category:
        query = query.filter(BillOrder.category == category)
    orders = query.order_by(BillOrder.created_at.desc()).limit(50).all()
    return {
        "orders": [
            {
                "id":         str(o.id),
                "category":   o.category.value if hasattr(o.category, "value") else o.category,
                "provider":   o.provider,
                "account_no": o.account_no,
                "amount":     float(o.amount),
                "status":     o.status.value if hasattr(o.status, "value") else o.status,
                "reference":  o.reference,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ]
    }

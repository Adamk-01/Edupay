import uuid
import json
import logging
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user       import User
from app.models.wallet     import Wallet, Transaction, TransactionType, TransactionStatus
from app.models.exam_order import ExamOrder, ExamType, OrderStatus
from app.dependencies      import get_current_user, require_verified
from app.services.email_service import send_order_confirmation

router = APIRouter(prefix="/exams", tags=["Exam Services"])
logger = logging.getLogger(__name__)

EXAM_PRICES: dict[ExamType, Decimal] = {
    ExamType.JAMB_EPIN:   Decimal("4700"),
    ExamType.JAMB_RESULT: Decimal("500"),
    ExamType.WAEC_PIN:    Decimal("3500"),
    ExamType.WAEC_REG:    Decimal("22000"),
    ExamType.NECO_PIN:    Decimal("2500"),
    ExamType.NECO_REG:    Decimal("18000"),
}


@router.get("/services")
async def list_services():
    return {
        "services": [
            {
                "id":    k.value,
                "name":  k.value.replace("_", " "),
                "price": float(v),
            }
            for k, v in EXAM_PRICES.items()
        ]
    }


@router.post("/order")
async def place_order(
    exam_type: str,
    quantity:  int,
    phone:     str,
    email:     str,
    current_user: User    = Depends(require_verified),
    db:           Session = Depends(get_db),
):
    try:
        exam_enum = ExamType(exam_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam type: {exam_type}")

    unit_price   = EXAM_PRICES[exam_enum]
    total_amount = unit_price * quantity

    wallet = db.query(Wallet).filter(
        Wallet.user_id == current_user.id
    ).with_for_update().first()

    if not wallet or wallet.balance < total_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient wallet balance. Need ₦{total_amount:,.2f}, have ₦{wallet.balance if wallet else 0:,.2f}",
        )

    reference = f"EDUPAY-EXAM-{uuid.uuid4().hex[:12].upper()}"
    wallet.balance -= total_amount

    txn = Transaction(
        user_id=current_user.id,
        amount=total_amount,
        type=TransactionType.debit,
        status=TransactionStatus.success,
        reference=reference,
        description=f"{exam_enum.value} x{quantity}",
    )
    order = ExamOrder(
        user_id=current_user.id,
        exam_type=exam_enum,
        quantity=quantity,
        unit_price=unit_price,
        total_amount=total_amount,
        phone=phone,
        email=email,
        status=OrderStatus.processing,
        reference=reference,
    )

    db.add(txn)
    db.add(order)
    db.commit()
    db.refresh(order)

    # ── Mock PIN Generation (until VTU provider is active) ──
    pins = []
    for _ in range(quantity):
        pins.append(f"{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:4].upper()}")
    
    order.pins_data = json.dumps(pins)
    order.status    = OrderStatus.completed
    db.commit()

    await run_in_threadpool(
        send_order_confirmation,
        current_user.email, current_user.full_name,
        reference, f"{exam_enum.value} x{quantity}",
    )

    return {
        "order_id":  str(order.id),
        "reference": reference,
        "status":    order.status,
        "message":   f"Order placed! Your {exam_enum.value} will be delivered to {email} within 5 minutes.",
    }


@router.get("/orders")
async def get_orders(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    orders = (
        db.query(ExamOrder)
        .filter(ExamOrder.user_id == current_user.id)
        .order_by(ExamOrder.created_at.desc())
        .all()
    )
    return {
        "orders": [
            {
                "id":           str(o.id),
                "exam_type":    o.exam_type,
                "quantity":     o.quantity,
                "total_amount": float(o.total_amount),
                "phone":        o.phone,
                "email":        o.email,
                "status":       o.status,
                "reference":    o.reference,
                "created_at":   o.created_at.isoformat(),
            }
            for o in orders
        ]
    }

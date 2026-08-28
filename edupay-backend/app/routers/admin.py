import uuid
from decimal import Decimal
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.database import get_db
from app.models.user       import User, UserRole
from app.models.wallet     import Wallet, Transaction, TransactionType, TransactionStatus
from app.models.exam_order import ExamOrder, OrderStatus
from app.routers.forms        import FormOrder
from app.routers.bills        import BillOrder
from app.routers.consultation import Consultant, ConsultationSession, ConsultantStatus
from app.routers.news         import NewsPost
from app.dependencies         import get_current_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── DASHBOARD STATS ──────────────────────────────────────────
@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    now       = datetime.utcnow()
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_users   = db.query(User).count()
    new_this_week = db.query(User).filter(User.created_at >= week_ago).count()
    suspended     = db.query(User).filter(User.is_active == False).count()

    total_revenue = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type   == TransactionType.credit,
        Transaction.status == TransactionStatus.success,
    ).scalar() or Decimal("0")

    monthly_revenue = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type      == TransactionType.credit,
        Transaction.status    == TransactionStatus.success,
        Transaction.created_at >= month_ago,
    ).scalar() or Decimal("0")

    return {
        "users": {
            "total":         total_users,
            "new_this_week": new_this_week,
            "suspended":     suspended,
        },
        "revenue": {
            "total":   float(total_revenue),
            "monthly": float(monthly_revenue),
        },
        "orders": {
            "exam_total":   db.query(ExamOrder).count(),
            "exam_pending": db.query(ExamOrder).filter(ExamOrder.status == OrderStatus.pending).count(),
            "forms_total":  db.query(FormOrder).count(),
            "bills_total":  db.query(BillOrder).count(),
        },
        "consultations": {
            "total":  db.query(ConsultationSession).count(),
            "active": db.query(ConsultationSession).filter(
                ConsultationSession.status == "confirmed"
            ).count(),
        },
        "content": {
            "published": db.query(NewsPost).filter(NewsPost.is_published == True).count(),
            "drafts":    db.query(NewsPost).filter(NewsPost.is_published == False).count(),
        },
    }


# ── USER MANAGEMENT ──────────────────────────────────────────
@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page:   int = Query(1, ge=1),
    limit:  int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    query = db.query(User)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))     |
            (User.phone.ilike(f"%{search}%"))
        )
    if status == "active":     query = query.filter(User.is_active == True)
    elif status == "suspended": query = query.filter(User.is_active == False)

    total = query.count()
    users = (
        query.order_by(desc(User.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    result = []
    for u in users:
        wallet     = db.query(Wallet).filter(Wallet.user_id == u.id).first()
        exam_count = db.query(ExamOrder).filter(ExamOrder.user_id == u.id).count()
        result.append({
            "id":             str(u.id),
            "full_name":      u.full_name,
            "email":          u.email,
            "phone":          u.phone,
            "role":           u.role,
            "is_active":      u.is_active,
            "is_verified":    u.is_verified,
            "wallet_balance": float(wallet.balance) if wallet else 0,
            "exam_orders":    exam_count,
            "created_at":     u.created_at.isoformat() if u.created_at else None,
        })

    return {"users": result, "total": total, "page": page}


@router.patch("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Cannot suspend an admin account")
    user.is_active = not user.is_active
    db.commit()
    return {
        "message":   "suspended" if not user.is_active else "restored",
        "is_active": user.is_active,
    }


@router.post("/users/{user_id}/credit-wallet")
async def credit_wallet(
    user_id: str,
    amount:  float,
    reason:  str    = "Admin credit",
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    wallet = db.query(Wallet).filter(
        Wallet.user_id == user_id
    ).with_for_update().first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    wallet.balance += Decimal(str(amount))

    txn = Transaction(
        user_id=user_id,
        amount=Decimal(str(amount)),
        type=TransactionType.credit,
        status=TransactionStatus.success,
        reference=f"ADMIN-CREDIT-{uuid.uuid4().hex[:10].upper()}",
        description=f"Admin credit: {reason}",
    )
    db.add(txn)
    db.commit()
    return {"message": "Credited successfully", "new_balance": float(wallet.balance)}


# ── ORDER MANAGEMENT ─────────────────────────────────────────
@router.get("/orders/exam")
async def list_exam_orders(
    status: Optional[str] = Query(None),
    page:   int = Query(1, ge=1),
    limit:  int = Query(25),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    query = db.query(ExamOrder)
    if status:
        query = query.filter(ExamOrder.status == status)
    total  = query.count()
    orders = (
        query.order_by(desc(ExamOrder.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "orders": [
            {
                "id":           str(o.id),
                "user_id":      str(o.user_id),
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
        ],
        "total": total,
        "page":  page,
    }


@router.patch("/orders/exam/{order_id}/fulfill")
async def fulfill_exam_order(
    order_id: str,
    pins:     str,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    order = db.query(ExamOrder).filter(ExamOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.pending:
        raise HTTPException(status_code=400, detail="Order is not in pending state")

    import json
    order.pins_data = json.dumps(pins.split(","))
    order.status    = OrderStatus.completed
    db.commit()
    return {"message": "Order fulfilled", "pins_delivered": pins.split(",")}


@router.get("/orders/bills")
async def list_bill_orders(
    category: Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
    page:     int = Query(1, ge=1),
    limit:    int = Query(25),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    query = db.query(BillOrder)
    if category: query = query.filter(BillOrder.category == category)
    if status:   query = query.filter(BillOrder.status   == status)
    total  = query.count()
    orders = (
        query.order_by(desc(BillOrder.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "orders": [
            {
                "id":         str(o.id),
                "user_id":    str(o.user_id),
                "category":   o.category,
                "provider":   o.provider,
                "account_no": o.account_no,
                "amount":     float(o.amount),
                "status":     o.status,
                "reference":  o.reference,
                "created_at": o.created_at.isoformat(),
            }
            for o in orders
        ],
        "total": total,
        "page":  page,
    }


# ── CONSULTANT MANAGEMENT ────────────────────────────────────
@router.get("/consultants")
async def list_consultants_admin(
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    consultants = db.query(Consultant).order_by(Consultant.full_name).all()
    result = []
    for c in consultants:
        session_count = db.query(ConsultationSession).filter(
            ConsultationSession.consultant_id == c.id
        ).count()
        result.append({
            "id":               str(c.id),
            "full_name":        c.full_name,
            "initials":         c.initials,
            "role":             c.role,
            "specialties":      c.specialties,
            "avatar_color":     c.avatar_color,
            "price_per_session":float(c.price_per_session),
            "rating":           c.rating,
            "status":           c.status,
            "email":            c.email,
            "pdf_url":          c.pdf_url,
            "pdf_filename":     c.pdf_filename,
            "has_pdf":          bool(c.pdf_url),
            "session_count":    session_count,
        })
    return {"consultants": result}


@router.post("/consultants")
async def create_consultant(
    payload: dict,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    c = Consultant(**{k: v for k, v in payload.items() if hasattr(Consultant, k)})
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"message": "Consultant created", "id": str(c.id)}


@router.patch("/consultants/{consultant_id}")
async def update_consultant(
    consultant_id: str,
    payload:       dict,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    c = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultant not found")
    for k, v in payload.items():
        if hasattr(c, k) and k not in ("id", "pdf_url", "pdf_filename"):
            setattr(c, k, v)
    db.commit()
    return {"message": "Updated"}


@router.patch("/consultants/{consultant_id}/toggle-status")
async def toggle_consultant_status(
    consultant_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    c = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    c.status = (
        ConsultantStatus.inactive
        if c.status == ConsultantStatus.active
        else ConsultantStatus.active
    )
    db.commit()
    return {"status": c.status}


@router.delete("/consultants/{consultant_id}")
async def delete_consultant(
    consultant_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    c = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(c)
    db.commit()
    return {"message": "Deleted"}

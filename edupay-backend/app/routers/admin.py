import uuid
from decimal import Decimal
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.models.user       import User, UserRole
from app.models.wallet     import Wallet, Transaction, TransactionType, TransactionStatus
from app.models.exam_order import ExamOrder, OrderStatus
from app.models.bill_order import BillOrder
from app.routers.forms        import FormOrder
from app.routers.consultation import Consultant, ConsultationSession, ConsultantStatus
from app.routers.news         import NewsPost
from app.dependencies         import get_current_admin
from app.services.email_service import send_form_completed_email
from app.utils.crypto import decrypt

router = APIRouter(prefix="/admin", tags=["Admin"])
limiter = Limiter(key_func=get_remote_address)


class CreateConsultantRequest(BaseModel):
    full_name: str
    initials: Optional[str] = None
    role: str
    bio: Optional[str] = None
    specialties: Optional[str] = None
    avatar_color: Optional[str] = "#1A56DB"
    price_per_session: Decimal
    duration_minutes: Optional[str] = "60"
    rating: Optional[str] = "5.0"
    status: Optional[ConsultantStatus] = ConsultantStatus.active
    email: Optional[str] = None


class UpdateConsultantRequest(BaseModel):
    full_name: Optional[str] = None
    initials: Optional[str] = None
    role: Optional[str] = None
    bio: Optional[str] = None
    specialties: Optional[str] = None
    avatar_color: Optional[str] = None
    price_per_session: Optional[Decimal] = None
    duration_minutes: Optional[str] = None
    rating: Optional[str] = None
    status: Optional[ConsultantStatus] = None
    email: Optional[str] = None


# ── DASHBOARD STATS ──────────────────────────────────────────
@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    now       = datetime.now(timezone.utc)
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
    if status == "active":
        query = query.filter(User.is_active == True)
    elif status == "suspended":
        query = query.filter(User.is_active == False)

    if search:
        term = search.strip().lower()
        all_users = query.order_by(desc(User.created_at)).all()
        matched = []
        for u in all_users:
            if (
                (u.email and term in u.email.lower())
                or (u.full_name and term in u.full_name.lower())
                or (u.phone and term in u.phone)
            ):
                matched.append(u)
        total = len(matched)
        users = matched[(page - 1) * limit : page * limit]
    else:
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
@limiter.limit("20/minute")
async def suspend_user(
    request: Request,
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
@limiter.limit("20/minute")
async def credit_wallet(
    request: Request,
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
@limiter.limit("20/minute")
async def fulfill_exam_order(
    request: Request,
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


@router.get("/orders/forms")
async def list_form_orders(
    status: Optional[str] = Query(None),
    page:   int = Query(1, ge=1),
    limit:  int = Query(25),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    from app.routers.forms import SchoolForm, Institution
    query = db.query(FormOrder)
    if status:
        query = query.filter(FormOrder.status == status)
    total  = query.count()
    orders = (
        query.order_by(desc(FormOrder.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    result = []
    for o in orders:
        user = db.query(User).filter(User.id == o.user_id).first()
        form = db.query(SchoolForm).filter(SchoolForm.id == o.form_id).first()
        inst = db.query(Institution).filter(Institution.id == form.institution_id).first() if form else None
        result.append({
            "id":         str(o.id),
            "user_id":    str(o.user_id),
            "user_name":  decrypt(user.full_name) if user else None,
            "user_email": user.email if user else None,
            "form_name":  f"{inst.name} — {form.form_type}" if form and inst else None,
            "amount":     float(o.amount),
            "status":     o.status,
            "reference":  o.reference,
            "created_at": o.created_at.isoformat(),
        })
    return {"orders": result, "total": total, "page": page}


@router.patch("/orders/forms/{order_id}/complete")
@limiter.limit("20/minute")
async def complete_form_order(
    request: Request,
    order_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    from app.routers.forms import FormOrder, FormOrderStatus, SchoolForm, Institution
    order = db.query(FormOrder).filter(FormOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != FormOrderStatus.pending:
        raise HTTPException(status_code=400, detail="Order is not pending")

    order.status = FormOrderStatus.completed
    db.commit()

    user = db.query(User).filter(User.id == order.user_id).first()
    form = db.query(SchoolForm).filter(SchoolForm.id == order.form_id).first()
    inst = db.query(Institution).filter(Institution.id == form.institution_id).first() if form else None
    form_name = f"{inst.name} — {form.form_type}" if form and inst else "School Form"

    if user:
        from fastapi.concurrency import run_in_threadpool
        await run_in_threadpool(
            send_form_completed_email,
            user.email, decrypt(user.full_name), form_name, order.reference,
        )
    return {"message": "Order marked as completed"}


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
@limiter.limit("20/minute")
async def create_consultant(
    request: Request,
    payload: CreateConsultantRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    initials = payload.initials
    if not initials and payload.full_name:
        parts = payload.full_name.split()
        initials = "".join([p[0].upper() for p in parts[:2]])

    c = Consultant(
        full_name=payload.full_name,
        initials=initials or "ED",
        role=payload.role,
        bio=payload.bio,
        specialties=payload.specialties,
        avatar_color=payload.avatar_color or "#1A56DB",
        price_per_session=payload.price_per_session,
        duration_minutes=payload.duration_minutes or "60",
        rating=payload.rating or "5.0",
        status=payload.status or ConsultantStatus.active,
        email=payload.email,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"message": "Consultant created", "id": str(c.id)}


@router.patch("/consultants/{consultant_id}")
@limiter.limit("20/minute")
async def update_consultant(
    request: Request,
    consultant_id: str,
    payload:       UpdateConsultantRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    c = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultant not found")
    update_data = payload.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(c, k, v)
    db.commit()
    return {"message": "Updated"}


@router.patch("/consultants/{consultant_id}/toggle-status")
@limiter.limit("20/minute")
async def toggle_consultant_status(
    request: Request,
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
@limiter.limit("20/minute")
async def delete_consultant(
    request: Request,
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

import uuid
import enum
from decimal import Decimal
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session, relationship, joinedload
from pydantic import BaseModel

from app.core.database import Base, get_db
from app.models.user   import User
from app.models.wallet import Wallet, Transaction, TransactionType, TransactionStatus
from app.dependencies  import get_current_user, get_current_admin

router = APIRouter(prefix="/forms", tags=["School Forms"])


# ── Models ────────────────────────────────────────────────────
class FormStatus(str, enum.Enum):
    open   = "open"
    closed = "closed"


class FormOrderStatus(str, enum.Enum):
    pending   = "pending"
    completed = "completed"
    failed    = "failed"


class Institution(Base):
    __tablename__ = "institutions"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String, nullable=False)
    short_name  = Column(String, nullable=True)
    type        = Column(String, nullable=False)
    state       = Column(String, nullable=True)
    is_featured = Column(Boolean, default=False)
    forms       = relationship("SchoolForm", back_populates="institution")


class SchoolForm(Base):
    __tablename__ = "school_forms"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=False)
    form_type      = Column(String, nullable=False)
    price          = Column(Numeric(10, 2), nullable=False)
    deadline       = Column(DateTime, nullable=True)
    status         = Column(Enum(FormStatus), default=FormStatus.open)
    session        = Column(String, nullable=False)
    instructions   = Column(String, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    institution    = relationship("Institution", back_populates="forms")


class FormOrder(Base):
    __tablename__ = "form_orders"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    form_id    = Column(UUID(as_uuid=True), ForeignKey("school_forms.id"), nullable=False)
    amount     = Column(Numeric(10, 2), nullable=False)
    reference  = Column(String, unique=True, nullable=False)
    status     = Column(Enum(FormOrderStatus), default=FormOrderStatus.pending)
    pin        = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Schemas ───────────────────────────────────────────────────
class BuyFormRequest(BaseModel):
    form_id: str
    phone:   str
    email:   str


# ── Routes ────────────────────────────────────────────────────
@router.get("/institutions")
async def list_institutions(
    type:   Optional[str] = Query(None),
    state:  Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page:   int = Query(1, ge=1),
    limit:  int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Institution)
    if type:   query = query.filter(Institution.type.ilike(f"%{type}%"))
    if state:  query = query.filter(Institution.state.ilike(f"%{state}%"))
    if search: query = query.filter(Institution.name.ilike(f"%{search}%"))

    total        = query.count()
    institutions = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "institutions": [
            {"id": str(i.id), "name": i.name, "short_name": i.short_name, "type": i.type, "state": i.state}
            for i in institutions
        ],
        "total": total, "page": page,
    }


@router.get("/")
async def list_forms(
    institution_id: Optional[str] = Query(None),
    form_type:      Optional[str] = Query(None),
    status:         Optional[str] = Query(None),
    search:         Optional[str] = Query(None),
    page:           int = Query(1, ge=1),
    limit:          int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(SchoolForm).options(joinedload(SchoolForm.institution))
    if institution_id: query = query.filter(SchoolForm.institution_id == institution_id)
    if form_type:      query = query.filter(SchoolForm.form_type.ilike(f"%{form_type}%"))
    if status:         query = query.filter(SchoolForm.status == status)

    if search:
        query = query.join(Institution).filter(Institution.name.ilike(f"%{search}%"))

    total = query.count()
    forms = query.order_by(SchoolForm.deadline.asc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "forms": [
            {
                "id":          str(f.id),
                "form_type":   f.form_type,
                "price":       float(f.price),
                "deadline":    f.deadline.isoformat() if f.deadline else None,
                "status":      f.status,
                "session":     f.session,
                "institution": {"id": str(f.institution.id), "name": f.institution.name} if f.institution else None,
            }
            for f in forms
        ],
        "total": total, "page": page,
    }


@router.post("/buy")
async def buy_form(
    data: BuyFormRequest,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    form = db.query(SchoolForm).filter(SchoolForm.id == data.form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.status != FormStatus.open:
        raise HTTPException(status_code=400, detail="This form is no longer available")

    wallet = db.query(Wallet).filter(
        Wallet.user_id == current_user.id
    ).with_for_update().first()

    if not wallet or wallet.balance < form.price:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    reference      = f"EDUPAY-FORM-{uuid.uuid4().hex[:12].upper()}"
    wallet.balance -= form.price

    txn = Transaction(
        user_id=current_user.id,
        amount=form.price,
        type=TransactionType.debit,
        status=TransactionStatus.success,
        reference=reference,
        description=f"School form purchase",
    )
    order = FormOrder(
        user_id=current_user.id,
        form_id=form.id,
        amount=form.price,
        reference=reference,
        status=FormOrderStatus.completed,
        pin=f"EP{uuid.uuid4().hex[:8].upper()}",
    )
    db.add(txn)
    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "order_id":  str(order.id),
        "reference": reference,
        "pin":       order.pin,
        "message":   "Form purchased successfully. Use this PIN to access the school portal.",
    }


@router.get("/my-orders")
async def my_form_orders(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    orders = (
        db.query(FormOrder)
        .filter(FormOrder.user_id == current_user.id)
        .order_by(FormOrder.created_at.desc())
        .all()
    )
    return {
        "orders": [
            {"id": str(o.id), "form_id": str(o.form_id), "amount": float(o.amount),
             "reference": o.reference, "status": o.status, "pin": o.pin,
             "created_at": o.created_at.isoformat()}
            for o in orders
        ]
    }


# ── Admin routes ──────────────────────────────────────────────
@router.post("/admin/institutions", dependencies=[Depends(get_current_admin)])
async def create_institution(payload: dict, db: Session = Depends(get_db)):
    inst = Institution(**{k: v for k, v in payload.items() if hasattr(Institution, k)})
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return {"id": str(inst.id), "message": "Institution created"}


@router.post("/admin/forms", dependencies=[Depends(get_current_admin)])
async def create_form(payload: dict, db: Session = Depends(get_db)):
    # Sanitize deadline: empty string or None → NULL in DB
    deadline_raw = payload.get("deadline", None)
    if deadline_raw and isinstance(deadline_raw, str) and deadline_raw.strip():
        try:
            payload["deadline"] = datetime.fromisoformat(deadline_raw.strip())
        except ValueError:
            payload["deadline"] = None
    else:
        payload["deadline"] = None

    form = SchoolForm(**{k: v for k, v in payload.items() if hasattr(SchoolForm, k)})
    db.add(form)
    db.commit()
    db.refresh(form)
    return {"id": str(form.id), "message": "Form created"}


@router.patch("/admin/forms/{form_id}", dependencies=[Depends(get_current_admin)])
async def update_form_status(form_id: str, status: str, db: Session = Depends(get_db)):
    form = db.query(SchoolForm).filter(SchoolForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    form.status = status
    db.commit()
    return {"message": "Updated"}

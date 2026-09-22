import uuid
import enum
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import Base, get_db
from app.models.user   import User
from app.models.wallet import Wallet, Transaction, TransactionType, TransactionStatus
from app.dependencies  import get_current_user, get_current_admin, require_verified
from app.services.email_service import send_email

router = APIRouter(prefix="/consultations", tags=["Consultation"])


# ── Models ────────────────────────────────────────────────────
class ConsultantStatus(str, enum.Enum):
    active   = "active"
    inactive = "inactive"
    on_leave = "on_leave"


class SessionStatus(str, enum.Enum):
    pending   = "pending"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"


class Consultant(Base):
    __tablename__ = "consultants"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name         = Column(String,  nullable=False)
    initials          = Column(String,  nullable=False)
    role              = Column(String,  nullable=False)
    bio               = Column(Text,    nullable=True)
    specialties       = Column(String,  nullable=True)
    avatar_color      = Column(String,  default="#1A56DB")
    price_per_session = Column(Numeric(10, 2), nullable=False)
    duration_minutes  = Column(String,  default="60")
    rating            = Column(String,  default="5.0")
    total_sessions    = Column(String,  default="0")
    status            = Column(Enum(ConsultantStatus), default=ConsultantStatus.active)
    email             = Column(String,  nullable=True)
    pdf_url           = Column(String,  nullable=True)
    pdf_filename      = Column(String,  nullable=True)
    created_at        = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ConsultationSession(Base):
    __tablename__ = "consultation_sessions"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    consultant_id  = Column(UUID(as_uuid=True), ForeignKey("consultants.id"), nullable=False)
    topic          = Column(String, nullable=False)
    notes          = Column(Text,   nullable=True)
    scheduled_date = Column(String, nullable=False)
    scheduled_time = Column(String, nullable=False)
    amount         = Column(Numeric(10, 2), nullable=False)
    status         = Column(Enum(SessionStatus), default=SessionStatus.pending)
    reference      = Column(String, unique=True, nullable=False)
    meet_link      = Column(String, nullable=True)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ── Schemas ───────────────────────────────────────────────────
class BookSessionRequest(BaseModel):
    consultant_id:  str
    topic:          str
    scheduled_date: str
    scheduled_time: str
    notes:          Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────
def _consultant_to_dict(c: Consultant, session_count: int = 0) -> dict:
    return {
        "id":               str(c.id),
        "full_name":        c.full_name,
        "initials":         c.initials,
        "role":             c.role,
        "bio":              c.bio,
        "specialties":      c.specialties,
        "avatar_color":     c.avatar_color,
        "price_per_session":float(c.price_per_session),
        "duration_minutes": c.duration_minutes,
        "rating":           c.rating,
        "total_sessions":   c.total_sessions,
        "status":           c.status,
        "email":            c.email,
        "pdf_url":          c.pdf_url,
        "pdf_filename":     c.pdf_filename,
        "has_pdf":          bool(c.pdf_url),
        "session_count":    session_count,
    }


# ── Public routes ─────────────────────────────────────────────
@router.get("/consultants")
async def list_consultants(
    specialty: Optional[str] = Query(None),
    status:    str           = Query("active"),
    db: Session = Depends(get_db),
):
    query = db.query(Consultant).filter(Consultant.status == status)
    if specialty:
        query = query.filter(Consultant.specialties.ilike(f"%{specialty}%"))
    consultants = query.order_by(Consultant.rating.desc()).all()
    return {"consultants": [_consultant_to_dict(c) for c in consultants]}


@router.get("/consultants/{consultant_id}")
async def get_consultant(consultant_id: str, db: Session = Depends(get_db)):
    c = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultant not found")
    session_count = db.query(ConsultationSession).filter(
        ConsultationSession.consultant_id == consultant_id
    ).count()
    return _consultant_to_dict(c, session_count)


@router.get("/consultants/{consultant_id}/availability")
async def get_availability(consultant_id: str, date: str = Query(...)):
    all_slots = ["9:00 AM","10:00 AM","11:00 AM","12:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM"]
    # TODO: filter out already-booked slots for this date
    return {"date": date, "available_slots": all_slots}


@router.post("/book")
async def book_session(
    data: BookSessionRequest,
    background_tasks: BackgroundTasks,
    current_user: User    = Depends(require_verified),
    db:           Session = Depends(get_db),
):
    consultant = db.query(Consultant).filter(
        Consultant.id     == data.consultant_id,
        Consultant.status == ConsultantStatus.active,
    ).first()
    if not consultant:
        raise HTTPException(status_code=404, detail="Consultant not found or unavailable")

    # Check slot conflict
    existing = db.query(ConsultationSession).filter(
        ConsultationSession.consultant_id  == data.consultant_id,
        ConsultationSession.scheduled_date == data.scheduled_date,
        ConsultationSession.scheduled_time == data.scheduled_time,
        ConsultationSession.status.notin_([SessionStatus.cancelled]),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This time slot is already booked")

    # Deduct from wallet
    wallet = db.query(Wallet).filter(
        Wallet.user_id == current_user.id
    ).with_for_update().first()
    if not wallet or wallet.balance < consultant.price_per_session:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    reference      = f"EDUPAY-CONSULT-{uuid.uuid4().hex[:10].upper()}"
    wallet.balance -= consultant.price_per_session

    txn = Transaction(
        user_id=current_user.id,
        amount=consultant.price_per_session,
        type=TransactionType.debit,
        status=TransactionStatus.success,
        reference=reference,
        description=f"Consultation – {consultant.full_name} – {data.scheduled_date}",
    )
    session = ConsultationSession(
        user_id=current_user.id,
        consultant_id=consultant.id,
        topic=data.topic,
        notes=data.notes,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        amount=consultant.price_per_session,
        status=SessionStatus.confirmed,
        reference=reference,
    )
    db.add(txn)
    db.add(session)
    db.commit()
    db.refresh(session)

    background_tasks.add_task(
        _send_booking_email,
        user_email=current_user.email,
        user_name=current_user.full_name,
        consultant_name=consultant.full_name,
        date=data.scheduled_date,
        time=data.scheduled_time,
        topic=data.topic,
        reference=reference,
    )

    return {
        "session_id":     str(session.id),
        "reference":      reference,
        "status":         session.status,
        "scheduled_date": data.scheduled_date,
        "scheduled_time": data.scheduled_time,
        "consultant":     consultant.full_name,
        "message":        f"Session booked with {consultant.full_name} on {data.scheduled_date} at {data.scheduled_time}",
    }


@router.get("/my-sessions")
async def my_sessions(
    status:       Optional[str] = Query(None),
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    query = db.query(ConsultationSession).filter(
        ConsultationSession.user_id == current_user.id
    )
    if status:
        query = query.filter(ConsultationSession.status == status)
    sessions = query.order_by(ConsultationSession.created_at.desc()).all()
    return {
        "sessions": [
            {
                "id":             str(s.id),
                "consultant_id":  str(s.consultant_id),
                "topic":          s.topic,
                "scheduled_date": s.scheduled_date,
                "scheduled_time": s.scheduled_time,
                "amount":         float(s.amount),
                "status":         s.status,
                "reference":      s.reference,
                "meet_link":      s.meet_link,
                "created_at":     s.created_at.isoformat(),
            }
            for s in sessions
        ]
    }


@router.patch("/sessions/{session_id}/cancel")
async def cancel_session(
    session_id:   str,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    session = db.query(ConsultationSession).filter(
        ConsultationSession.id      == session_id,
        ConsultationSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == SessionStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed session")

    session.status = SessionStatus.cancelled

    # Refund wallet
    wallet = db.query(Wallet).filter(
        Wallet.user_id == current_user.id
    ).with_for_update().first()
    if wallet:
        wallet.balance += session.amount

    db.commit()
    return {"message": "Session cancelled. Your wallet has been refunded."}


# ── Admin routes ──────────────────────────────────────────────
@router.post("/admin/consultants", dependencies=[Depends(get_current_admin)])
async def create_consultant(payload: dict, db: Session = Depends(get_db)):
    c = Consultant(**{k: v for k, v in payload.items() if hasattr(Consultant, k)})
    db.add(c)
    db.commit()
    db.refresh(c)
    return _consultant_to_dict(c)


@router.patch("/admin/sessions/{session_id}/meet-link", dependencies=[Depends(get_current_admin)])
async def set_meet_link(session_id: str, meet_link: str, db: Session = Depends(get_db)):
    session = db.query(ConsultationSession).filter(ConsultationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.meet_link = meet_link
    db.commit()
    return {"message": "Meet link set"}


# ── Email helper ──────────────────────────────────────────────
def _send_booking_email(user_email, user_name, consultant_name, date, time, topic, reference):
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#1A56DB">Consultation Booked!</h2>
      <p>Hi {user_name}, your session has been confirmed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#64748B">Consultant</td><td style="font-weight:600">{consultant_name}</td></tr>
        <tr><td style="padding:8px 0;color:#64748B">Date</td><td style="font-weight:600">{date}</td></tr>
        <tr><td style="padding:8px 0;color:#64748B">Time</td><td style="font-weight:600">{time}</td></tr>
        <tr><td style="padding:8px 0;color:#64748B">Topic</td><td style="font-weight:600">{topic}</td></tr>
        <tr><td style="padding:8px 0;color:#64748B">Reference</td><td style="font-weight:600">{reference}</td></tr>
      </table>
      <p style="color:#64748B;font-size:13px">A meeting link will be sent 30 minutes before your session.</p>
    </div>
    """
    send_email(user_email, f"Consultation Confirmed – {date} at {time}", html)

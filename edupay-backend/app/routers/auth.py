import uuid
import secrets
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.models.user   import User, UserRole
from app.models.wallet import Wallet
from app.schemas.auth  import (
    RegisterRequest, LoginRequest, TokenResponse,
    UserOut, RefreshRequest, ChangePasswordRequest, UpdateProfileRequest,
)
from app.dependencies        import get_current_user
from app.services.email_service import send_verification_email, _send_smtp
from app.utils.crypto import decrypt

router  = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)
logger  = logging.getLogger(__name__)


def _generate_referral_code(name: str) -> str:
    prefix = name.split()[0][:4].upper()
    return f"EDU-{prefix}{uuid.uuid4().hex[:4].upper()}"


def _user_to_out(user: User) -> dict:
    return {
        "id":             str(user.id),
        "email":          user.email,
        "full_name":      user.full_name,
        "phone":          user.phone,
        "is_verified":    user.is_verified,
        "role":           user.role.value if hasattr(user.role, "value") else user.role,
        "referral_code":  user.referral_code,
        "state_of_origin":user.state_of_origin,
        "created_at":     user.created_at.isoformat() if user.created_at else None,
    }


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


@router.post("/verify-email/send")
async def send_verify_otp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    raw_otp = f"{secrets.randbelow(900000) + 100000:06d}"
    current_user.verification_otp   = _hash_otp(raw_otp)
    current_user.otp_expires_at     = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.commit()

    _send_smtp(
        current_user.email,
        "Your EduPay Email Verification Code",
        f"<div style='font-family:sans-serif;max-width:520px;margin:0 auto'>"
        f"<h2 style='color:#1A56DB'>Verify Your Email</h2>"
        f"<p>Hi {current_user.full_name}, use the code below to verify your email. It expires in 10 minutes.</p>"
        f"<div style='font-size:36px;font-weight:800;letter-spacing:.15em;color:#1A56DB;margin:24px 0'>{raw_otp}</div>"
        f"<p style='color:#64748B;font-size:13px'>If you didn't request this, ignore this email.</p></div>",
    )
    return {"message": "Verification code sent to your email"}


@router.post("/verify-email/confirm")
async def confirm_verify_otp(
    otp: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    clean_otp = otp.strip()
    hashed = _hash_otp(clean_otp)
    stored = current_user.verification_otp or ""

    is_valid_otp = hmac.compare_digest(stored, hashed) or hmac.compare_digest(stored, clean_otp)

    now = datetime.now(timezone.utc)
    is_expired = False
    if current_user.otp_expires_at:
        exp = current_user.otp_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        is_expired = now > exp

    if not is_valid_otp or not current_user.otp_expires_at or is_expired:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    current_user.is_verified       = True
    current_user.verification_otp  = None
    current_user.otp_expires_at    = None
    db.commit()
    db.refresh(current_user)
    return {"message": "Email verified successfully", "user": _user_to_out(current_user)}


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("20/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    if data.phone:
        phone_records = db.query(User._phone).filter(User._phone.isnot(None)).all()
        for (raw_phone,) in phone_records:
            if decrypt(raw_phone) == data.phone:
                raise HTTPException(status_code=409, detail="Phone number already registered")

    user = User(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        hashed_password=hash_password(data.password),
        referral_code=_generate_referral_code(data.full_name),
        referred_by=data.referral_code,
    )
    db.add(user)
    db.flush()

    wallet = Wallet(user_id=user.id)
    db.add(wallet)
    db.commit()
    db.refresh(user)

    background_tasks.add_task(send_verification_email, user.email, user.full_name)

    return {
        "access_token":  create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
        "user":          _user_to_out(user),
    }


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
async def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == data.email,
        User.is_active == True,
    ).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    logger.info("User login: %s", user.id)

    return {
        "access_token":  create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
        "user":          _user_to_out(user),
    }


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh_token(request: Request, data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "access_token":  create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
        "user":          _user_to_out(user),
    }


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return _user_to_out(current_user)


@router.patch("/me")
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info("Profile update requested: user=%s", getattr(current_user, "id", None))

    if data.phone is not None and data.phone != current_user.phone:
        phone_records = db.query(User._phone).filter(User.id != current_user.id, User._phone.isnot(None)).all()
        for (raw_phone,) in phone_records:
            if decrypt(raw_phone) == data.phone:
                raise HTTPException(status_code=409, detail="Phone number already in use")

    if data.full_name       is not None: current_user.full_name       = data.full_name
    if data.phone           is not None: current_user.phone           = data.phone
    if data.state_of_origin is not None: current_user.state_of_origin = data.state_of_origin

    try:
        db.commit()
        db.refresh(current_user)
        logger.info("Profile update persisted for user=%s: %s", current_user.id, _user_to_out(current_user))
    except Exception:
        db.rollback()
        logger.exception("Profile update failed for user %s", current_user.id)
        raise HTTPException(status_code=500, detail="Failed to save profile")
    return _user_to_out(current_user)


@router.patch("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}

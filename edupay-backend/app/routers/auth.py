import uuid
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
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
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


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


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if data.phone and db.query(User).filter(User.phone == data.phone).first():
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
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == data.email,
        User.is_active == True,
    ).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "access_token":  create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
        "user":          _user_to_out(user),
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
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
    if data.full_name:       current_user.full_name       = data.full_name
    if data.phone:           current_user.phone           = data.phone
    if data.state_of_origin: current_user.state_of_origin = data.state_of_origin
    db.commit()
    db.refresh(current_user)
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

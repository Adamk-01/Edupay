import uuid
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config   import settings
from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token
from app.models.user   import User, UserRole
from app.models.wallet import Wallet

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/google-auth", tags=["Google OAuth"])

REDIRECT_URI = f"{settings.FRONTEND_URL}/auth/google/callback"


def _user_to_out(user: User) -> dict:
    return {
        "id":              str(user.id),
        "email":           user.email,
        "full_name":       user.full_name,
        "phone":           user.phone,
        "is_verified":     user.is_verified,
        "role":            user.role.value if hasattr(user.role, "value") else user.role,
        "referral_code":   user.referral_code,
        "state_of_origin": user.state_of_origin,
        "created_at":      user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/login")
async def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
    )
    return {"auth_url": auth_url}


@router.get("/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    # 1. Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code":          code,
                "client_id":     settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri":  REDIRECT_URI,
                "grant_type":    "authorization_code",
            },
        )

    if token_res.status_code != 200:
        logger.error("Google token exchange failed: %s", token_res.text)
        raise HTTPException(status_code=400, detail="Google authentication failed")

    google_tokens = token_res.json()
    id_token      = google_tokens.get("access_token")

    # 2. Fetch user info from Google
    async with httpx.AsyncClient() as client:
        info_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {id_token}"},
        )

    if info_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch Google user info")

    info       = info_res.json()
    email      = info.get("email")
    full_name  = info.get("name", "")
    is_verified = info.get("verified_email", False)

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    # 3. Find or create user
    user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            full_name=full_name,
            email=email,
            hashed_password=uuid.uuid4().hex,  # unusable random password
            referral_code=f"EDU-{full_name.split()[0][:4].upper()}{uuid.uuid4().hex[:4].upper()}" if full_name else f"EDU-{uuid.uuid4().hex[:8].upper()}",
            is_verified=is_verified,
        )
        db.add(user)
        db.flush()
        db.add(Wallet(user_id=user.id))
        db.commit()
        db.refresh(user)
        logger.info("New Google user created: %s", user.id)
    elif not user.is_active:
        raise HTTPException(status_code=403, detail="Account suspended")

    return {
        "access_token":  create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
        "token_type":    "bearer",
        "user":          _user_to_out(user),
    }

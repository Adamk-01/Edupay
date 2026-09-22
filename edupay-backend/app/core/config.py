from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import base64
import logging
# Ensure .env is loaded into the environment for pydantic BaseSettings
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=".env")
except Exception:
    # dotenv is optional; if it's not installed, pydantic will still read env vars
    # Fallback: manually parse .env into os.environ so Settings can read them
    try:
        import os
        from pathlib import Path
        p = Path('.env')
        if p.exists():
            for line in p.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k = k.strip()
                v = v.strip().strip('"')
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

# Debug: show whether MONNIFY keys are present in environment (masked)
try:
    import os
    pub = os.environ.get("MONNIFY_PUBLIC_KEY", "")
    sec = os.environ.get("MONNIFY_SECRET_KEY", "")
    def _mask(s):
        if not s: return "(empty)"
        return s[:4] + "..." + s[-2:]
    logger.debug("ENV MONNIFY_PUBLIC_KEY=%s MONNIFY_SECRET_KEY=%s", _mask(pub), _mask(sec))
    # Also print for quick python -c checks
    try:
        print(f"[config] MONNIFY_PUBLIC_KEY={_mask(pub)}")
        print(f"[config] MONNIFY_SECRET_KEY={_mask(sec)}")
    except Exception:
        pass
except Exception:
    pass

logger = logging.getLogger(__name__)

WEAK_SECRETS = {
    "", "supersecret", "your-super-secret-key-change-this-in-production",
    "base64encodedkey", "your_base64_key", "your_jwt_secret",
    "edupay-dev-secret-key-v1-992837465",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Monnify
    MONNIFY_API_KEY: str = ""
    MONNIFY_PUBLIC_KEY: str = ""
    MONNIFY_SECRET_KEY: str = ""
    MONNIFY_BASE_URL: str = "https://sandbox.monnify.com"
    MONNIFY_CONTRACT_CODE: str = ""
    MONNIFY_WALLET_ACCOUNT_NUMBER: str = ""

    # VTU
    VTU_API_KEY: str = ""
    VTU_BASE_URL: str = "https://sandbox.vtpass.com/api"

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "EduPay.ng <noreply@edupay.ng>"

    # SMS
    TERMII_API_KEY: str = ""
    TERMII_SENDER_ID: str = "EduPay"

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY: str = ""
    R2_SECRET_KEY: str = ""
    R2_BUCKET: str = "edupay-uploads"

    # App
    FRONTEND_URL: str = "http://localhost:5173"
    ADMIN_URL: str = "http://localhost:5174"
    ENVIRONMENT: str = "development"
    ENCRYPTION_KEY: str = ""
    JWT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Admin contact (for form order notifications)
    ADMIN_EMAIL: str = ""
    ADMIN_WHATSAPP: str = ""  # international format without +, e.g. 2348012345678

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    def validate_for_production(self):
        """Raise on startup if critical secrets are missing or weak in production."""
        if not self.is_production:
            # Dev: just warn about ENCRYPTION_KEY since it will crash at runtime
            if self.ENCRYPTION_KEY in WEAK_SECRETS:
                logger.warning(
                    "ENCRYPTION_KEY is not set — user name/phone encryption will fail. "
                    "Run: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
                )
            return

        errors = []
        if self.SECRET_KEY in WEAK_SECRETS:
            errors.append("SECRET_KEY is weak or default")
        if self.ENCRYPTION_KEY in WEAK_SECRETS:
            errors.append("ENCRYPTION_KEY is not set")
        # Monnify keys are optional in production check (configure as needed)
        if not self.SMTP_USER or not self.SMTP_PASSWORD:
            errors.append("SMTP_USER and SMTP_PASSWORD must be set")
        if not self.GOOGLE_CLIENT_ID or self.GOOGLE_CLIENT_ID == "your_google_client_id":
            errors.append("GOOGLE_CLIENT_ID is not configured")
        if not self.GOOGLE_CLIENT_SECRET or self.GOOGLE_CLIENT_SECRET == "your_google_client_secret":
            errors.append("GOOGLE_CLIENT_SECRET is not configured")
        if self.FRONTEND_URL == "http://localhost:5173":
            errors.append("FRONTEND_URL must be set to your production domain")

        if errors:
            raise RuntimeError(
                "Production startup blocked — fix these .env issues:\n  - " + "\n  - ".join(errors)
            )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
settings.validate_for_production()

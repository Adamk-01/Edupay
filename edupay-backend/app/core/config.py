import base64
import logging
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Ensure .env is loaded into the environment for pydantic BaseSettings
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=".env")
except Exception:
    # dotenv is optional; if it's not installed, pydantic will still read env vars
    # Fallback: manually parse .env into os.environ so Settings can read them
    try:
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

WEAK_SECRETS = {
    "", "supersecret", "your-super-secret-key-change-this-in-production",
    "base64encodedkey", "your_base64_key", "your_jwt_secret",
    "edupay-dev-secret-key-v1-992837465",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "sqlite:///./edupay.db"

    # JWT
    SECRET_KEY: str = "dev-secret-key-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Paystack
    PAYSTACK_SECRET_KEY: str = ""
    PAYSTACK_PUBLIC_KEY: str = ""

    # Arewa Gate
    AREWA_GATE_BASE_URL: str = "https://api.arewagate.com/api/v1"
    AREWA_GATE_PUBLIC_KEY: str = ""
    AREWA_GATE_SECRET_KEY: str = ""
    AREWA_GATE_WEBHOOK_SECRET: str = ""
    AREWA_GATE_JAMB_SERVICE_CATEGORY: str = "jamb-service"
    AREWA_GATE_JAMB_SERVICE_NAME: str = "utme-only"
    AREWA_GATE_WAEC_SERVICE_CATEGORY: str = "waec-service"
    AREWA_GATE_WAEC_SERVICE_NAME: str = "result-pin"
    AREWA_GATE_NECO_SERVICE_CATEGORY: str = "neco-service"
    AREWA_GATE_NECO_SERVICE_NAME: str = "result-pin"

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
    ENCRYPTION_KEY: str = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
    JWT_SECRET: str = "dev-jwt-secret-change-me"
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
            # Dev mode should still boot reliably without a custom .env file.
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

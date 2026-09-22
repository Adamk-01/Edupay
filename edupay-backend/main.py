import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
# Monnify gateway configured and active

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from app.core.config   import settings
from app.core.database import Base, engine, SessionLocal

# ── Import all models so SQLAlchemy registers them ───────────
from app.models import user, wallet, exam_order          # noqa
from app.routers.forms        import Institution, SchoolForm, FormOrder    # noqa
from app.routers.bills        import BillOrder                             # noqa
from app.routers.news         import NewsPost                              # noqa
from app.routers.consultation import Consultant, ConsultationSession       # noqa

# ── Import routers ───────────────────────────────────────────
from app.routers import (auth, wallet as wallet_router, exams, forms,
    bills, news, consultation, payments, admin, uploads, google_auth,)
# Development-only debug routes
try:
    if not settings.is_production:
        from app.routers import debug_email  # type: ignore
except Exception:
    debug_email = None
# Dev-only debug routes
try:
    from app.routers import debug as debug_router
except Exception:
    debug_router = None


# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if settings.is_production else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Create tables ─────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Create upload directory ───────────────────────────────────
Path("uploads/consultant_pdfs").mkdir(parents=True, exist_ok=True)

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="EduPay.ng API",
    description="Backend API for EduPay.ng — Nigeria's #1 educational services platform",
    version="1.0.0",
    docs_url="/docs"   if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(429, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# ── CORS ──────────────────────────────────────────────────────
origins = (
    [settings.FRONTEND_URL, settings.ADMIN_URL]
    if settings.is_production
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve uploaded files (dev only) ──────────────────────────
if not settings.is_production:
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routes ───────────────────────────────────────────────────
API = "/api/v1"
app.include_router(auth.router,              prefix=API)
# Authenticated routes get a higher limit (120/min)
app.include_router(wallet_router.router,     prefix=API)
app.include_router(exams.router,             prefix=API)
app.include_router(forms.router,             prefix=API)
app.include_router(bills.router,             prefix=API)
app.include_router(news.router,              prefix=API)
app.include_router(consultation.router,      prefix=API)
app.include_router(payments.router,          prefix=API)
app.include_router(admin.router,             prefix=API)
app.include_router(uploads.router,           prefix=API)
app.include_router(google_auth.router, prefix=API)
if not settings.is_production and 'debug_email' in globals() and debug_email is not None:
    app.include_router(debug_email.router, prefix=API)
if not settings.is_production and debug_router:
    app.include_router(debug_router.router, prefix=API)

@app.get("/")
async def root():
    return {"message": "EduPay.ng API v1.0", "docs": "/docs"}


@app.get("/health")
async def health():
    db_ok = True
    db = SessionLocal()
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception:
        db_ok = False
    finally:
        db.close()
    return {
        "status":      "healthy" if db_ok else "degraded",
        "db":          "ok" if db_ok else "unreachable",
        "environment": settings.ENVIRONMENT,
    }

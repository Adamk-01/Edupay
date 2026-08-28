from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config   import settings
from app.core.database import Base, engine

# ── Import all models so SQLAlchemy registers them ───────────
from app.models import user, wallet, exam_order          # noqa
from app.routers.forms        import Institution, SchoolForm, FormOrder    # noqa
from app.routers.bills        import BillOrder                             # noqa
from app.routers.news         import NewsPost                              # noqa
from app.routers.consultation import Consultant, ConsultationSession       # noqa

# ── Import routers ───────────────────────────────────────────
from app.routers import (
    auth, wallet as wallet_router, exams, forms,
    bills, news, consultation, payments, admin, uploads,
)

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
app.include_router(wallet_router.router,     prefix=API)
app.include_router(exams.router,             prefix=API)
app.include_router(forms.router,             prefix=API)
app.include_router(bills.router,             prefix=API)
app.include_router(news.router,              prefix=API)
app.include_router(consultation.router,      prefix=API)
app.include_router(payments.router,          prefix=API)
app.include_router(admin.router,             prefix=API)
app.include_router(uploads.router,           prefix=API)


@app.get("/")
async def root():
    return {"message": "EduPay.ng API v1.0", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "healthy", "environment": settings.ENVIRONMENT}

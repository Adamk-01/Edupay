from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import settings
from app.services.email_service import _send_smtp

router = APIRouter()

class TestEmailRequest(BaseModel):
    to: str
    subject: str = "[EduPay] Test Email"
    html: str = "<p>This is a test email from EduPay backend.</p>"


@router.post("/email/test")
async def test_email(payload: TestEmailRequest):
    if settings.is_production:
        raise HTTPException(status_code=403, detail="Debug endpoints are disabled in production")

    success = await __import__("fastapi.concurrency").run_in_threadpool(_send_smtp, payload.to, payload.subject, payload.html)
    return {"to": payload.to, "sent": bool(success)}

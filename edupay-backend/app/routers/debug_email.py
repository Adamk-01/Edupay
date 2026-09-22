from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.config import settings
from app.services.email_service import (
    send_form_order_buyer_email,
    send_admin_form_notification,
    send_email,
)
from fastapi.concurrency import run_in_threadpool

router = APIRouter(prefix="/debug", tags=["Debug"])

class TestEmailPayload(BaseModel):
    email: str
    name: str = "Test User"
    form_name: str = "Sample Form"
    institution: str = "Sample Institution"
    order_ref: str = "TEST-REF-123"
    amount: float = 0.0
    phone: str = "08012345678"
    whatsapp_number: str = "08012345678"


@router.post("/test-form-emails")
async def test_form_emails(payload: TestEmailPayload):
    """Send both buyer confirmation and admin notification emails (dev only).

    This endpoint is intended for development and debugging. It is disabled in production.
    """
    if settings.is_production:
        raise HTTPException(status_code=404, detail="Not available in production")

    # Send buyer email
    buyer_sent = await run_in_threadpool(
        send_form_order_buyer_email,
        payload.email,
        payload.name,
        payload.form_name,
        payload.institution,
        payload.order_ref,
        float(payload.amount),
        payload.whatsapp_number,
    )

    # Send admin notification
    admin_sent = await run_in_threadpool(
        send_admin_form_notification,
        payload.name,
        payload.email,
        payload.phone,
        f"{payload.institution} — {payload.form_name}",
        payload.order_ref,
        float(payload.amount),
        payload.whatsapp_number,
    )

    return {"buyer_email_sent": bool(buyer_sent), "admin_email_sent": bool(admin_sent)}

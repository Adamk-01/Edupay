import logging
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import require_verified
from app.models.arewa_service import ArewaServicePrice
from app.models.user import User
from app.models.wallet import Wallet, Transaction, TransactionType, TransactionStatus
from app.services.arewagate_service import ArewaGateService
from app.services.email_service import send_arewa_delivery_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/arewa", tags=["Arewa Gate"])


def _service() -> ArewaGateService:
    return ArewaGateService()


def _catalog_with_prices(categories: list[dict], db: Session) -> list[dict]:
    price_rows = db.query(ArewaServicePrice).all()
    price_map = {(row.category, row.service_slug): row.sell_price for row in price_rows}
    result = []
    for category in categories:
        services = []
        for item in category.get("services", []):
            provider_price = Decimal(str(item.get("price") or "0"))
            override = price_map.get((category["slug"], item["slug"]))
            services.append({
                **item,
                "provider_price": float(provider_price),
                "selling_price": float(override if override is not None else provider_price),
                "custom_price": override is not None,
            })
        result.append({**category, "services": services})
    return result


@router.get("/catalog")
async def get_arewa_catalog(db: Session = Depends(get_db)):
    service = _service()
    if not service.enabled:
        raise HTTPException(status_code=400, detail="Arewa Gate is not configured")
    try:
        categories = await service.get_manual_catalog()
        return {"categories": _catalog_with_prices(categories, db)}
    except Exception as exc:
        logger.exception("Could not load Arewa Gate catalog")
        raise HTTPException(status_code=502, detail="Unable to load Arewa Gate services") from exc


@router.get("/status")
async def arewa_status():
    service = _service()
    return {
        "enabled": service.enabled,
        "base_url": service.base_url,
        "public_key": service.public_key[:4] + "..." + service.public_key[-4:] if service.public_key else None,
    }


@router.get("/categories")
async def list_categories():
    service = _service()
    if not service.enabled:
        raise HTTPException(status_code=400, detail="Arewa Gate is not configured")
    try:
        return await service.get_manual_categories()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/services/{category}")
async def list_services(category: str):
    service = _service()
    if not service.enabled:
        raise HTTPException(status_code=400, detail="Arewa Gate is not configured")
    try:
        return await service.get_manual_services(category)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/services/{category}/{service_name}")
async def get_service_detail(category: str, service_name: str):
    service = _service()
    if not service.enabled:
        raise HTTPException(status_code=400, detail="Arewa Gate is not configured")
    try:
        return await service.get_service_detail(category, service_name)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/manual/purchase")
async def purchase_manual_service(
    payload: Dict[str, Any],
    current_user: User = Depends(require_verified),
    db: Session = Depends(get_db),
):
    service = _service()
    if not service.enabled:
        raise HTTPException(status_code=400, detail="Arewa Gate is not configured")

    category = str(payload.get("category") or "").strip()
    service_name = str(payload.get("service") or "").strip()
    try:
        quantity = int(payload.get("quantity", 1) or 1)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="quantity must be a whole number")
    if not category or not service_name:
        raise HTTPException(status_code=400, detail="category and service are required")
    if quantity < 1:
        raise HTTPException(status_code=400, detail="quantity must be at least 1")

    service_detail = await service.get_service_detail(category, service_name)
    detail = service_detail.get("data") or {}
    if service_detail.get("success") is False or not detail:
        raise HTTPException(status_code=404, detail="Arewa Gate service not found")
    max_quantity = int(detail.get("max_quantity") or 1)
    if quantity > max_quantity:
        raise HTTPException(status_code=400, detail=f"Maximum quantity for this service is {max_quantity}")

    inputs = payload.get("data") or {}
    if not isinstance(inputs, dict):
        raise HTTPException(status_code=400, detail="data must be an object")
    missing = [
        field.get("label") or field.get("key")
        for field in detail.get("inputs", [])
        if field.get("required") and not inputs.get(field.get("key"))
    ]
    if missing:
        raise HTTPException(status_code=400, detail=f"Required fields missing: {', '.join(missing)}")

    price_row = db.query(ArewaServicePrice).filter_by(
        category=category,
        service_slug=service_name,
    ).first()
    unit_price = price_row.sell_price if price_row else Decimal(str(detail.get("price") or "0"))
    if unit_price <= 0:
        raise HTTPException(status_code=400, detail="This service is unavailable until EduPay sets a selling price")
    total = unit_price * quantity

    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).with_for_update().first()
    if not wallet or wallet.balance < total:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    reference = f"EDUPAY-AREWA-{uuid.uuid4().hex[:12].upper()}"
    wallet.balance -= total
    transaction = Transaction(
        user_id=current_user.id,
        amount=total,
        type=TransactionType.debit,
        status=TransactionStatus.pending,
        reference=reference,
        description=f"{detail.get('name') or service_name} x{quantity} via Arewa Gate",
    )
    db.add(transaction)
    db.commit()

    try:
        result = await service.purchase_manual_service(
            category=category,
            service=service_name,
            quantity=quantity,
            payload=inputs,
            idempotency_key=reference,
        )
    except Exception as exc:
        logger.exception("Arewa Gate purchase outcome is uncertain: %s", reference)
        raise HTTPException(
            status_code=502,
            detail=f"Provider response is pending. Funds are reserved; contact support with reference {reference}.",
        ) from exc

    if result.get("success") is not True:
        wallet.balance += total
        transaction.status = TransactionStatus.failed
        db.add(Transaction(
            user_id=current_user.id,
            amount=total,
            type=TransactionType.credit,
            status=TransactionStatus.success,
            reference=f"REFUND-{reference}",
            description=f"Refund: Failed Arewa Gate service {service_name}",
        ))
        db.commit()
        raise HTTPException(status_code=502, detail=result.get("message") or "Arewa Gate declined the purchase; wallet refunded")

    transaction.status = TransactionStatus.success
    transaction.provider_data = result.get("data") or {}
    db.commit()

    # Send delivery email with PIN/result
    provider_data = transaction.provider_data or {}
    try:
        await run_in_threadpool(
            send_arewa_delivery_email,
            current_user.email,
            current_user.full_name,
            detail.get("name") or service_name,
            reference,
            float(total),
            provider_data,
        )
    except Exception:
        logger.exception("Failed to send Arewa delivery email for ref=%s", reference)

    return {
        "success": True,
        "reference": reference,
        "service": detail.get("name") or service_name,
        "quantity": quantity,
        "unit_price": float(unit_price),
        "total": float(total),
        "provider_response": provider_data,
    }


@router.get("/history")
async def get_arewa_history(
    current_user: User = Depends(require_verified),
    db: Session = Depends(get_db),
):
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.reference.like("EDUPAY-AREWA-%"),
        )
        .order_by(desc(Transaction.created_at))
        .all()
    )
    return {
        "orders": [
            {
                "id":            str(t.id),
                "reference":     t.reference,
                "description":   t.description,
                "amount":        float(t.amount),
                "status":        t.status,
                "provider_data": t.provider_data or {},
                "created_at":    t.created_at.isoformat() if t.created_at else None,
            }
            for t in txns
        ]
    }


@router.post("/webhook")
async def arewa_webhook(request: Request):
    raw = await request.body()
    signature = request.headers.get("X-ArewaGate-Signature", "")
    service = _service()
    if not service.verify_webhook(raw, signature):
        raise HTTPException(status_code=401, detail="Invalid Arewa Gate webhook signature")

    try:
        import json
        payload = json.loads(raw)
    except Exception:
        payload = {"raw": raw.decode("utf-8", errors="replace")}

    logger.info("Arewa Gate webhook received: %s", payload)
    return {"status": "ok"}

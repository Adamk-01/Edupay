import hashlib
import hmac
import json
import logging
from decimal import Decimal
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.config   import settings
from app.models.user   import User, UserRole
from app.models.wallet import Wallet, Transaction, TransactionStatus
from app.services.email_service import send_wallet_funded_email
from app.services.paystack_service import PaystackService
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)
router  = APIRouter(prefix="/payments", tags=["Payments"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/webhook/paystack")
async def paystack_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    body = await request.body()

    # ── 1. Verify signature ──────────────────────────────────
    signature = request.headers.get("x-paystack-signature", "")
    paystack = PaystackService()
    if not paystack.verify_webhook(body, signature):
        logger.warning("Paystack webhook rejected: invalid signature")
        raise HTTPException(status_code=401, detail="Invalid signature")

    # ── 2. Parse payload ─────────────────────────────────────
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    logger.info("Paystack webhook event: %s", payload.get("event"))

    # Only handle successful charge events
    if payload.get("event") not in ("charge.success",):
        return {"status": "ignored"}

    data = payload.get("data", {})
    reference = data.get("reference")
    status    = (data.get("status") or "").lower()

    if not reference or status != "success":
        return {"status": "ignored"}

    # ── 3. Find pending transaction ──────────────────────────
    transaction = db.query(Transaction).filter(
        Transaction.reference == reference,
        Transaction.status    == TransactionStatus.pending,
    ).with_for_update().first()

    if not transaction:
        logger.info("Paystack webhook: no pending txn for ref=%s (already processed?)", reference)
        return {"status": "ignored"}

    # ── 4. Validate amount (Paystack sends kobo) ─────────────
    webhook_kobo = data.get("amount")
    if webhook_kobo is not None:
        try:
            paid_naira = Decimal(str(webhook_kobo)) / 100
            if abs(paid_naira - transaction.amount) > Decimal("1"):  # 1 naira tolerance
                logger.error("Paystack amount mismatch: paid=%s expected=%s ref=%s", paid_naira, transaction.amount, reference)
                transaction.status = TransactionStatus.failed
                transaction.description = f"{transaction.description} | AMOUNT MISMATCH: paid={paid_naira} expected={transaction.amount}"
                db.commit()
                return {"status": "amount_mismatch"}
        except Exception:
            pass

    # ── 5. Credit wallet ─────────────────────────────────────
    transaction.status = TransactionStatus.success
    wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).with_for_update().first()
    if wallet:
        wallet.balance += transaction.amount
    db.commit()
    logger.info("Wallet funded via Paystack webhook: ref=%s amount=%s", reference, transaction.amount)

    # ── 6. Send confirmation email ───────────────────────────
    user = db.query(User).filter(User.id == transaction.user_id).first()
    if user and wallet:
        try:
            await run_in_threadpool(
                send_wallet_funded_email,
                user.email, user.full_name,
                float(transaction.amount), reference,
                float(wallet.balance),
            )
        except Exception:
            logger.exception("Failed to send wallet-funded email for ref=%s", reference)

    return {"status": "ok"}


@router.get("/verify/{reference}")
@router.post("/verify/{reference}")
@limiter.limit("10/minute")
async def verify_payment(
    request: Request,
    reference: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Called by frontend after Paystack redirects back. Verifies and credits wallet."""
    clean_ref = reference.strip()

    transaction = db.query(Transaction).filter(Transaction.reference == clean_ref).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if transaction.user_id != current_user.id and getattr(current_user, "role", None) != UserRole.admin:
        raise HTTPException(status_code=403, detail="Unauthorized")

    wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).first()

    # Already credited (webhook may have fired first)
    if transaction.status == TransactionStatus.success:
        return {
            "status":    "success",
            "message":   "Payment verified and wallet credited.",
            "reference": clean_ref,
            "amount":    float(transaction.amount),
            "balance":   float(wallet.balance) if wallet else 0.0,
        }

    paystack = PaystackService()

    if paystack.enabled:
        try:
            data = await paystack.verify_transaction(clean_ref)
            ps_status = (data.get("status") or "").lower()

            if ps_status == "success":
                # Validate amount
                kobo = data.get("amount")
                if kobo is not None:
                    try:
                        paid = Decimal(str(kobo)) / 100
                        if abs(paid - transaction.amount) > Decimal("1"):
                            transaction.status = TransactionStatus.failed
                            db.commit()
                            return {"status": "failed", "message": "Payment amount mismatch.", "reference": clean_ref}
                    except Exception:
                        pass

                transaction.status = TransactionStatus.success
                wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).with_for_update().first()
                if wallet:
                    wallet.balance += transaction.amount
                db.commit()
                if wallet:
                    db.refresh(wallet)

                try:
                    user = db.query(User).filter(User.id == transaction.user_id).first()
                    if user and wallet:
                        await run_in_threadpool(
                            send_wallet_funded_email,
                            user.email, user.full_name,
                            float(transaction.amount), clean_ref,
                            float(wallet.balance),
                        )
                except Exception:
                    logger.exception("Failed to send wallet email for %s", clean_ref)

                return {
                    "status":    "success",
                    "message":   f"Payment successful! ₦{float(transaction.amount):,.2f} added to your wallet.",
                    "reference": clean_ref,
                    "amount":    float(transaction.amount),
                    "balance":   float(wallet.balance) if wallet else float(transaction.amount),
                }

            elif ps_status in ("failed", "abandoned"):
                transaction.status = TransactionStatus.failed
                db.commit()
                return {"status": "failed", "message": f"Payment {ps_status}.", "reference": clean_ref}

            else:
                return {"status": "pending", "message": "Payment is still being processed.", "reference": clean_ref}

        except Exception as e:
            logger.warning("Paystack verify call failed for %s: %s", clean_ref, e)
            if settings.ENVIRONMENT == "development":
                transaction.status = TransactionStatus.success
                wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).with_for_update().first()
                if wallet:
                    wallet.balance += transaction.amount
                db.commit()
                return {
                    "status":    "success",
                    "message":   f"[Dev Mode] ₦{float(transaction.amount):,.2f} added to your wallet.",
                    "reference": clean_ref,
                    "amount":    float(transaction.amount),
                    "balance":   float(wallet.balance) if wallet else float(transaction.amount),
                }
            raise HTTPException(status_code=502, detail=f"Paystack verification error: {str(e)}")

    else:
        # No Paystack key — dev auto-credit
        if settings.ENVIRONMENT == "development":
            transaction.status = TransactionStatus.success
            wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).with_for_update().first()
            if wallet:
                wallet.balance += transaction.amount
            db.commit()
            return {
                "status":    "success",
                "message":   f"[Dev Mode] ₦{float(transaction.amount):,.2f} added to your wallet.",
                "reference": clean_ref,
                "amount":    float(transaction.amount),
                "balance":   float(wallet.balance) if wallet else float(transaction.amount),
            }
        raise HTTPException(status_code=400, detail="Paystack is not configured.")

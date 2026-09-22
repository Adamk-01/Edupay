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
from app.services.monnify_service import MonnifyService
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["Payments"])
limiter = Limiter(key_func=get_remote_address)


def _verify_monnify_signature(body: bytes, signature_header: str) -> bool:
    """Verify Monnify webhook signature using HMAC-SHA512.

    Monnify sends a hash of the request body in the 'monnify-signature'
    header, computed with your secret key using HMAC-SHA512.
    """
    if not settings.MONNIFY_SECRET_KEY:
        logger.error("MONNIFY_SECRET_KEY not set — cannot verify webhook signature")
        return False

    expected = hmac.new(
        settings.MONNIFY_SECRET_KEY.encode("utf-8"),
        body,
        hashlib.sha512,
    ).hexdigest()

    return hmac.compare_digest(expected, signature_header)


@router.post("/webhook/monnify")
async def monnify_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    body = await request.body()

    # ── 1. Verify signature ──────────────────────────────────
    signature = request.headers.get("monnify-signature", "")
    if not signature or not _verify_monnify_signature(body, signature):
        logger.warning("Monnify webhook rejected: invalid or missing signature")
        raise HTTPException(status_code=401, detail="Invalid signature")

    # ── 2. Parse payload ─────────────────────────────────────
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    logger.info("Monnify webhook received: %s", payload)

    # Common Monnify payload shapes may nest data under 'responseBody' or 'data'
    data = payload.get("responseBody") or payload.get("data") or payload

    # Extract reference and status heuristically
    reference = (
        data.get("paymentReference")
        or data.get("payment_reference")
        or data.get("paymentRef")
        or data.get("transactionReference")
        or data.get("reference")
    )
    status = (data.get("paymentStatus") or data.get("status") or "").upper()

    if not reference:
        logger.warning("Monnify webhook missing reference: %s", data)
        return {"status": "ignored"}

    # Consider common success indicators
    if status not in ("PAID", "SUCCESS", "SUCCESSFUL", "COMPLETED"):
        logger.info("Monnify webhook non-success status=%s ref=%s", status, reference)
        return {"status": "ignored"}

    # ── 3. Find pending transaction ──────────────────────────
    transaction = db.query(Transaction).filter(
        Transaction.reference == reference,
        Transaction.status    == TransactionStatus.pending,
    ).with_for_update().first()

    if not transaction:
        # Already processed or unknown — idempotent response
        logger.info("Monnify webhook: no pending txn for ref=%s (already processed?)", reference)
        return {"status": "ignored"}

    # ── 4. Validate amount matches ───────────────────────────
    # Monnify may report amount in major units (Naira) or minor units (kobo).
    # Accept the amount if it matches within either interpretation.
    webhook_amount_raw = data.get("amountPaid") or data.get("amount") or data.get("settlementAmount")
    if webhook_amount_raw is not None:
        try:
            webhook_amount = Decimal(str(webhook_amount_raw))
            # Check both Naira-to-Naira and Kobo-to-Naira
            expected_naira = transaction.amount
            if webhook_amount != expected_naira and webhook_amount != expected_naira * 100:
                logger.error(
                    "Monnify webhook amount mismatch: webhook=%s expected=%s ref=%s",
                    webhook_amount, expected_naira, reference,
                )
                # Do NOT credit — flag for manual review
                transaction.status = TransactionStatus.failed
                transaction.description = (
                    f"{transaction.description or ''} | "
                    f"AMOUNT MISMATCH: webhook={webhook_amount} expected={expected_naira}"
                )
                db.commit()
                return {"status": "amount_mismatch"}
        except (ValueError, TypeError):
            logger.warning("Monnify webhook: could not parse amount: %s", webhook_amount_raw)
            # Proceed cautiously — log but don't block if amount field is missing/malformed

    # ── 5. Credit wallet ─────────────────────────────────────
    transaction.status = TransactionStatus.success

    wallet = db.query(Wallet).filter(
        Wallet.user_id == transaction.user_id
    ).with_for_update().first()

    if wallet:
        wallet.balance += transaction.amount

    db.commit()
    logger.info("Wallet funded via Monnify: ref=%s amount=%s", reference, transaction.amount)

    # ── 6. Send confirmation email (non-blocking) ────────────
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
    """Verify payment status for a reference, query Monnify if pending, and credit user wallet."""
    clean_ref = reference.strip()

    # Find the pending or existing transaction
    transaction = (
        db.query(Transaction)
        .filter(Transaction.reference == clean_ref)
        .first()
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Ensure transaction belongs to current user (unless admin)
    if transaction.user_id != current_user.id and getattr(current_user, "role", None) != UserRole.admin:
        raise HTTPException(status_code=403, detail="Unauthorized to verify this transaction")

    wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).first()

    # If transaction is already successfully credited
    if transaction.status == TransactionStatus.success:
        return {
            "status": "success",
            "message": "Payment verified and credited",
            "reference": clean_ref,
            "amount": float(transaction.amount),
            "balance": float(wallet.balance) if wallet else 0.0,
        }

    monnify = MonnifyService()

    if monnify.enabled:
        try:
            m_data = await monnify.verify_transaction(clean_ref)
            logger.info("Monnify verify response for %s: %s", clean_ref, m_data)

            # Extract status heuristically from Monnify response
            m_status = (
                m_data.get("paymentStatus")
                or m_data.get("status")
                or ""
            ).upper()

            if m_status in ("PAID", "SUCCESS", "SUCCESSFUL", "COMPLETED", "OVERPAID"):
                # Validate amount
                raw_amt = m_data.get("amountPaid") or m_data.get("amount") or m_data.get("settlementAmount")
                if raw_amt is not None:
                    try:
                        paid_amt = Decimal(str(raw_amt))
                        if paid_amt != transaction.amount and paid_amt != transaction.amount * 100:
                            logger.error("Verify amount mismatch: paid=%s expected=%s", paid_amt, transaction.amount)
                            transaction.status = TransactionStatus.failed
                            transaction.description = f"{transaction.description or ''} | Amount mismatch: paid {paid_amt}"
                            db.commit()
                            return {
                                "status": "failed",
                                "message": "Payment amount does not match transaction amount",
                                "reference": clean_ref,
                            }
                    except Exception:
                        pass

                # Credit wallet
                transaction.status = TransactionStatus.success
                wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).with_for_update().first()
                if wallet:
                    wallet.balance += transaction.amount
                db.commit()
                if wallet:
                    db.refresh(wallet)

                # Send confirmation email
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
                    "status": "success",
                    "message": f"Payment successful! ₦{float(transaction.amount):,.2f} added to your wallet.",
                    "reference": clean_ref,
                    "amount": float(transaction.amount),
                    "balance": float(wallet.balance) if wallet else float(transaction.amount),
                }

            elif m_status in ("FAILED", "CANCELLED", "EXPIRED"):
                transaction.status = TransactionStatus.failed
                db.commit()
                return {
                    "status": "failed",
                    "message": f"Payment was {m_status.lower()}",
                    "reference": clean_ref,
                }
            else:
                return {
                    "status": "pending",
                    "message": "Payment is still being processed by Monnify",
                    "reference": clean_ref,
                }
        except Exception as e:
            logger.warning("Monnify verification call failed for %s: %s", clean_ref, e)
            if settings.ENVIRONMENT == "development":
                # In development mode, permit simulated completion
                logger.info("Dev fallback: completing funding for ref=%s", clean_ref)
                transaction.status = TransactionStatus.success
                wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).with_for_update().first()
                if wallet:
                    wallet.balance += transaction.amount
                db.commit()
                return {
                    "status": "success",
                    "message": f"[Dev Mode] Payment verified! ₦{float(transaction.amount):,.2f} added to your wallet.",
                    "reference": clean_ref,
                    "amount": float(transaction.amount),
                    "balance": float(wallet.balance) if wallet else float(transaction.amount),
                }
            raise HTTPException(status_code=502, detail=f"Monnify verification error: {str(e)}")

    else:
        # Monnify credentials not set
        if settings.ENVIRONMENT == "development":
            logger.info("Dev mode (no Monnify keys): auto-crediting funding for ref=%s", clean_ref)
            transaction.status = TransactionStatus.success
            wallet = db.query(Wallet).filter(Wallet.user_id == transaction.user_id).with_for_update().first()
            if wallet:
                wallet.balance += transaction.amount
            db.commit()
            return {
                "status": "success",
                "message": f"[Dev Mode] Payment simulated! ₦{float(transaction.amount):,.2f} added to your wallet.",
                "reference": clean_ref,
                "amount": float(transaction.amount),
                "balance": float(wallet.balance) if wallet else float(transaction.amount),
            }
        else:
            raise HTTPException(status_code=400, detail="Monnify is not configured on the server")


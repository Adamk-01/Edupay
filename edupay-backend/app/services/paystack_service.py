import hashlib
import hmac
import httpx
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class PaystackService:
    def __init__(self):
        self.secret_key = (settings.PAYSTACK_SECRET_KEY or "").strip()
        self.base_url = "https://api.paystack.co"
        self.enabled = bool(self.secret_key)
        if self.enabled:
            logger.info("Paystack configured (key=%s...%s)", self.secret_key[:8], self.secret_key[-4:])
        else:
            logger.warning("Paystack not configured: PAYSTACK_SECRET_KEY missing")

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    async def initialize_payment(self, email: str, amount: float, reference: str, callback_url: str) -> dict:
        """Initialize a Paystack transaction. Amount must be in Naira — we convert to kobo."""
        payload = {
            "email": email,
            "amount": int(amount * 100),  # Paystack uses kobo
            "reference": reference,
            "callback_url": callback_url,
            "currency": "NGN",
            "metadata": {"custom_fields": [{"display_name": "Platform", "variable_name": "platform", "value": "EduPay.ng"}]},
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(f"{self.base_url}/transaction/initialize", json=payload, headers=self._headers())
            if res.status_code >= 400:
                logger.error("Paystack init failed (%s): %s", res.status_code, res.text)
                raise RuntimeError(f"Paystack initialization failed ({res.status_code}): {res.text}")
            d = res.json()
            data = d.get("data", {})
            return {
                "authorization_url": data.get("authorization_url"),
                "access_code": data.get("access_code", ""),
                "reference": data.get("reference", reference),
            }

    async def verify_transaction(self, reference: str) -> dict:
        """Verify a Paystack transaction by reference."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(
                f"{self.base_url}/transaction/verify/{reference}",
                headers=self._headers(),
            )
            if res.status_code >= 400:
                logger.error("Paystack verify failed (%s): %s", res.status_code, res.text)
                raise RuntimeError(f"Paystack verification failed ({res.status_code}): {res.text}")
            d = res.json()
            return d.get("data", d)

    def verify_webhook(self, raw_body: bytes, signature_header: str) -> bool:
        """Verify Paystack webhook signature using HMAC-SHA512."""
        if not self.secret_key:
            return False
        expected = hmac.new(self.secret_key.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, signature_header or "")

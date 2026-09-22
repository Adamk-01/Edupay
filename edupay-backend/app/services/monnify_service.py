import time
import base64
import httpx
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class MonnifyService:
    def __init__(self):
        self.base_url = settings.MONNIFY_BASE_URL.rstrip("/")
        # Accept either MONNIFY_API_KEY or MONNIFY_PUBLIC_KEY
        self.public_key = (settings.MONNIFY_API_KEY or settings.MONNIFY_PUBLIC_KEY or "").strip()
        self.secret_key = (settings.MONNIFY_SECRET_KEY or "").strip()
        self.contract_code = (settings.MONNIFY_CONTRACT_CODE or "").strip()

        self.enabled = bool(self.public_key and self.secret_key)
        if self.enabled:
            masked = f"{self.public_key[:4]}...{self.public_key[-4:]}" if len(self.public_key) > 8 else "(set)"
            logger.info("Monnify configured (api_key=%s, contract_code=%s, base_url=%s)", masked, self.contract_code, self.base_url)
        else:
            logger.warning("Monnify not configured: MONNIFY_API_KEY / MONNIFY_PUBLIC_KEY or MONNIFY_SECRET_KEY missing")

        # Token cache
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0

    async def _get_token(self) -> str:
        """Obtain an access token from Monnify auth endpoint using HTTP Basic Auth.
        
        Monnify requires:
        POST /api/v1/auth/login
        Authorization: Basic base64(apiKey:secretKey)
        """
        if not self.enabled:
            raise RuntimeError("Monnify client not configured. Set MONNIFY_API_KEY and MONNIFY_SECRET_KEY in edupay-backend/.env")

        # Return cached token if still valid
        if self._cached_token and time.time() < self._token_expires_at:
            return self._cached_token

        auth_str = f"{self.public_key}:{self.secret_key}"
        basic_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
        headers = {
            "Authorization": f"Basic {basic_auth}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{self.base_url}/api/v1/auth/login"
            res = await client.post(url, headers=headers)
            if res.status_code >= 400:
                logger.error("Monnify auth failed (HTTP %s): %s", res.status_code, res.text)
                raise RuntimeError(f"Monnify authentication failed ({res.status_code}): {res.text}")

            d = res.json()
            token = None
            expires_in = 3600  # default 1 hour
            if isinstance(d, dict):
                body = d.get("responseBody", {})
                token = body.get("accessToken") or body.get("access_token")
                expires_in = body.get("expiresIn", expires_in)

            if not token:
                raise RuntimeError(f"Failed to obtain Monnify access token: {d}")

            # Cache with 60-second safety margin
            self._cached_token = token
            self._token_expires_at = time.time() + max(expires_in - 60, 60)
            return token

    async def initialize_payment(self, email: str, amount: float, reference: str, callback_url: str) -> dict:
        """Initialize a Monnify transaction and return a dict with authorization_url and access_code."""
        token = await self._get_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "amount": amount,
            "customerEmail": email,
            "customerName": email.split("@")[0] if email else "Customer",
            "paymentReference": reference,
            "paymentDescription": f"EduPay wallet funding — {reference}",
            "currencyCode": "NGN",
            "contractCode": self.contract_code,
            "redirectUrl": callback_url,
            "paymentMethods": ["CARD", "ACCOUNT_TRANSFER", "USSD"],
        }

        url = f"{self.base_url}/api/v1/merchant/transactions/init-transaction"
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code >= 400:
                logger.error("Monnify init failed (HTTP %s): %s", res.status_code, res.text)
                raise RuntimeError(f"Monnify payment initialization failed ({res.status_code}): {res.text}")

            d = res.json()
            body = d.get("responseBody", d)
            auth_url = body.get("checkoutUrl") or body.get("paymentUrl") or body.get("payment_link")
            access_code = body.get("transactionReference") or body.get("paymentReference") or body.get("reference")
            return {"authorization_url": auth_url, "access_code": access_code or "", **body}

    async def verify_transaction(self, reference: str) -> dict:
        """Verify a Monnify transaction status by payment reference."""
        token = await self._get_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try v2 endpoint first (current standard)
            url_v2 = f"{self.base_url}/api/v2/merchant/transactions/query"
            try:
                res = await client.get(url_v2, params={"paymentReference": reference}, headers=headers)
                if res.status_code == 200:
                    d = res.json()
                    return d.get("responseBody", d)
            except Exception as e:
                logger.warning("Monnify v2 query failed (%s), trying v1", e)

            # Fallback to v1 endpoint
            url_v1 = f"{self.base_url}/api/v1/merchant/transactions/query"
            res = await client.get(url_v1, params={"paymentReference": reference}, headers=headers)
            res.raise_for_status()
            d = res.json()
            return d.get("responseBody", d)


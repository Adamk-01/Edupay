import hashlib
import hmac
import logging
import time
import asyncio
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class ArewaGateService:
    def __init__(self, public_key: Optional[str] = None, secret_key: Optional[str] = None, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.AREWA_GATE_BASE_URL or "https://api.arewagate.com/api/v1").rstrip("/")
        self.public_key = (public_key or settings.AREWA_GATE_PUBLIC_KEY or "").strip()
        self.secret_key = (secret_key or settings.AREWA_GATE_SECRET_KEY or "").strip()
        self.webhook_secret = (settings.AREWA_GATE_WEBHOOK_SECRET or "").strip()
        self.enabled = bool(self.public_key and self.secret_key)
        self._access_token: Optional[str] = None
        self._token_expires_at = 0.0

    @staticmethod
    def _mask(value: str) -> str:
        if not value:
            return "(empty)"
        if len(value) <= 8:
            return "***"
        return f"{value[:4]}...{value[-4:]}"

    def _build_auth_headers(self, token: Optional[str] = None, extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if extra_headers:
            headers.update(extra_headers)
        return headers

    async def get_access_token(self) -> str:
        if not self.enabled:
            raise RuntimeError("Arewa Gate is not configured. Add AREWA_GATE_PUBLIC_KEY and AREWA_GATE_SECRET_KEY.")

        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token

        auth = httpx.BasicAuth(self.public_key, self.secret_key)
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(f"{self.base_url}/auth/token", auth=auth)
            if res.status_code >= 400:
                body = res.text
                logger.error("Arewa Gate token request failed: %s %s", res.status_code, body)
                raise RuntimeError(f"Arewa Gate token request failed ({res.status_code}): {body}")

            payload = res.json()
            data = payload.get("data") or {}
            token = data.get("access_token") or payload.get("access_token")
            expires_in = data.get("expires_in") or 3600
            if not token:
                raise RuntimeError(f"Could not read Arewa Gate access token from response: {payload}")

            self._access_token = token
            self._token_expires_at = time.time() + max(int(expires_in) - 60, 60)
            return token

    async def _request(self, method: str, path: str, *, token: Optional[str] = None, json_body: Optional[dict] = None, params: Optional[dict] = None, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        if token is None:
            token = await self.get_access_token()

        headers = self._build_auth_headers(token)
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                json=json_body,
                params=params,
            )

            payload = response.json() if response.content else {}
            if response.status_code >= 400:
                msg = payload.get("message") or payload.get("errors") or response.text
                raise RuntimeError(f"Arewa Gate request failed ({response.status_code}) for {path}: {msg}")

            return payload

    async def get_manual_categories(self) -> dict:
        return await self._request("GET", "/services/categories")

    async def get_manual_catalog(self) -> list[dict]:
        response = await self.get_manual_categories()
        categories = response.get("data") or []
        if isinstance(categories, dict):
            categories = categories.get("categories") or []
        if response.get("success") is False:
            raise RuntimeError(response.get("message") or "Could not load Arewa Gate categories")

        async def load_category(category: dict) -> dict:
            slug = str(category.get("slug") or "")
            if not slug:
                return {**category, "services": []}
            services_response = await self.get_manual_services(slug)
            if services_response.get("success") is False:
                raise RuntimeError(services_response.get("message") or f"Could not load services for {slug}")
            services_data = services_response.get("data") or {}
            return {
                **category,
                "name": category.get("name") or (services_data.get("category") or {}).get("name") or slug,
                "slug": slug,
                "services": services_data.get("services") or [],
            }

        return await asyncio.gather(*(load_category(category) for category in categories))

    async def get_manual_services(self, category: str) -> dict:
        return await self._request("GET", f"/services/{category}")

    async def get_service_detail(self, category: str, service: str) -> dict:
        return await self._request("GET", f"/services/{category}/{service}")

    async def purchase_manual_service(
        self,
        category: str,
        service: str,
        quantity: int = 1,
        payload: Optional[dict] = None,
        idempotency_key: Optional[str] = None,
    ) -> dict:
        request_payload = {"quantity": quantity}
        if payload:
            request_payload.update(payload)
        return await self._request(
            "POST",
            f"/services/{category}/{service}/purchase",
            json_body=request_payload,
            idempotency_key=idempotency_key,
        )

    async def purchase_airtime(self, payload: dict, idempotency_key: Optional[str] = None) -> dict:
        return await self._request(
            "POST",
            "/airtime/purchase",
            json_body=payload,
            idempotency_key=idempotency_key,
        )

    async def purchase_data_subscription(self, payload: dict, idempotency_key: Optional[str] = None) -> dict:
        return await self._request(
            "POST",
            "/data-subscription/purchase",
            json_body=payload,
            idempotency_key=idempotency_key,
        )

    async def pay_utility_bill(self, payload: dict, idempotency_key: Optional[str] = None) -> dict:
        return await self._request(
            "POST",
            "/utility-bills/pay",
            json_body=payload,
            idempotency_key=idempotency_key,
        )

    async def verify_nin(self, payload: dict, idempotency_key: Optional[str] = None) -> dict:
        return await self._request(
            "POST",
            "/verification/nin",
            json_body=payload,
            idempotency_key=idempotency_key,
        )

    async def purchase_scratch_card(self, payload: dict, idempotency_key: Optional[str] = None) -> dict:
        return await self._request(
            "POST",
            "/scratch-card/purchase",
            json_body=payload,
            idempotency_key=idempotency_key,
        )

    async def get_transactions(self, params: Optional[dict] = None) -> dict:
        return await self._request("GET", "/transactions", params=params)

    async def purchase_verification(self, verification_type: str, inputs: dict, idempotency_key: Optional[str] = None) -> dict:
        return await self._request(
            "POST",
            f"/verification/{verification_type}",
            json_body=inputs,
            idempotency_key=idempotency_key,
        )

    def verify_webhook(self, raw_body: bytes, signature_header: str) -> bool:
        if not self.webhook_secret:
            logger.warning("Arewa Gate webhook secret is not configured; rejecting webhook.")
            return False
        expected = "sha256=" + hmac.new(self.webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature_header or "")

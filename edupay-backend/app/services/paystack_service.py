import httpx
from app.core.config import settings

class PaystackService:
    def __init__(self):
        self.base_url = settings.PAYSTACK_BASE_URL
        self.headers  = {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
            "Content-Type":  "application/json",
        }

    async def initialize_payment(self, email: str, amount: int, reference: str, callback_url: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(f"{self.base_url}/transaction/initialize", headers=self.headers,
                json={"email": email, "amount": amount, "reference": reference, "callback_url": callback_url})
            res.raise_for_status()
            data = res.json()
            if not data.get("status"):
                raise Exception(data.get("message", "Paystack initialization failed"))
            return data["data"]

    async def verify_payment(self, reference: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(f"{self.base_url}/transaction/verify/{reference}", headers=self.headers)
            res.raise_for_status()
            data = res.json()
            if not data.get("status"):
                raise Exception(data.get("message", "Verification failed"))
            return data["data"]

import httpx
from app.core.config import settings

class VTUService:
    def __init__(self):
        self.base_url = settings.VTU_BASE_URL.rstrip("/")
        self.headers  = {"Authorization": f"Bearer {settings.VTU_API_KEY}", "Content-Type": "application/json"}

    AIRTIME_MAP  = {"MTN": "mtn", "Airtel": "airtel", "Glo": "glo", "9mobile": "etisalat"}
    DATA_MAP     = {"MTN": "mtn-data", "Airtel": "airtel-data", "Glo": "glo-data", "9mobile": "etisalat-data"}
    ELECTRIC_MAP = {"IKEDC": "ikeja-electric", "EKEDC": "eko-electric", "IBEDC": "ibadan-electric", "PHED": "phed"}
    CABLE_MAP    = {"DStv": "dstv", "GOtv": "gotv", "Startimes": "startimes"}

    async def _post(self, endpoint: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(f"{self.base_url}/{endpoint}", headers=self.headers, json=payload)
            res.raise_for_status()
            data = res.json()
            if data.get("code") not in ("000", "success", "00"):
                raise Exception(data.get("response_description") or "VTU request failed")
            return data.get("content") or data

    async def buy_airtime(self, provider: str, phone: str, amount: float, reference: str) -> dict:
        sid = self.AIRTIME_MAP.get(provider)
        if not sid: raise Exception(f"Unsupported provider: {provider}")
        result = await self._post("pay", {"request_id": reference, "serviceID": sid, "amount": str(int(amount)), "phone": phone})
        return {"ref": result.get("transaction_id") or reference}

    async def buy_data(self, provider: str, phone: str, bundle_id: str, reference: str) -> dict:
        sid = self.DATA_MAP.get(provider)
        if not sid: raise Exception(f"Unsupported provider: {provider}")
        result = await self._post("pay", {"request_id": reference, "serviceID": sid, "variation_code": bundle_id, "phone": phone, "billersCode": phone})
        return {"ref": result.get("transaction_id") or reference}

    async def pay_electricity(self, provider: str, meter_number: str, amount: float, meter_type: str, reference: str) -> dict:
        sid = self.ELECTRIC_MAP.get(provider)
        if not sid: raise Exception(f"Unsupported provider: {provider}")
        result = await self._post("pay", {"request_id": reference, "serviceID": sid, "billersCode": meter_number, "variation_code": meter_type, "amount": str(int(amount)), "phone": "08000000000"})
        return {"ref": result.get("transaction_id") or reference, "token": result.get("token", "")}

    async def pay_cable(self, provider: str, smart_card: str, package_id: str, reference: str) -> dict:
        sid = self.CABLE_MAP.get(provider)
        if not sid: raise Exception(f"Unsupported provider: {provider}")
        result = await self._post("pay", {"request_id": reference, "serviceID": sid, "billersCode": smart_card, "variation_code": package_id, "phone": "08000000000", "subscription_type": "change"})
        return {"ref": result.get("transaction_id") or reference}

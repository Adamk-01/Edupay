from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.arewagate_service import ArewaGateService


def test_arewagate_uses_default_base_url():
    service = ArewaGateService()
    assert service.base_url == "https://api.arewagate.com/api/v1"


def test_arewagate_builds_bearer_auth_headers():
    service = ArewaGateService(public_key="pk_test", secret_key="sk_test")
    headers = service._build_auth_headers("token-123")
    assert headers["Authorization"] == "Bearer token-123"
    assert headers["Content-Type"] == "application/json"


@pytest.mark.asyncio
async def test_arewagate_airtime_purchase_uses_provider_route():
    service = ArewaGateService(public_key="pk_test", secret_key="sk_test")

    mock_request = AsyncMock(return_value=MagicMock(
        status_code=200,
        content=b'{"status": "ok"}',
        text='{"status": "ok"}',
    ))
    mock_request.return_value.json.return_value = {"status": "ok"}

    with patch("httpx.AsyncClient.request", mock_request):
        result = await service.purchase_airtime({"phone": "08031234567", "amount": 500})

    assert result == {"status": "ok"}
    assert mock_request.await_count == 1
    assert mock_request.await_args.kwargs["json"] == {"phone": "08031234567", "amount": 500}

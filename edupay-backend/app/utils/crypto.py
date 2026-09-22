import base64
import os
from cryptography.fernet import Fernet

def _get_fernet() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("ENCRYPTION_KEY environment variable not set")
    # support both raw base64 and urlsafe base64
    try:
        decoded = base64.urlsafe_b64decode(key)
    except Exception:
        decoded = base64.b64decode(key)
    return Fernet(base64.urlsafe_b64encode(decoded))

def encrypt(value: str) -> str:
    if value is None:
        return None
    return _get_fernet().encrypt(value.encode()).decode()

def decrypt(token: str) -> str:
    if token is None:
        return None
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except Exception:
        # value was stored before encryption was enabled — return as-is
        return token

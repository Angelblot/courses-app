"""Credential encryption for drive configurations.

Uses Fernet symmetric encryption. The key is derived from the configured
``ENCRYPTION_KEY`` so it can be rotated without touching application code.
"""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _fernet() -> Fernet:
    key = get_settings().encryption_key.encode()
    digest = hashlib.sha256(key).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_credentials(credentials: Dict[str, Any]) -> str:
    payload = json.dumps(credentials, ensure_ascii=False).encode()
    return _fernet().encrypt(payload).decode()


def decrypt_credentials(token: Optional[str]) -> Dict[str, Any]:
    if not token:
        return {}
    try:
        raw = _fernet().decrypt(token.encode())
    except InvalidToken:
        try:
            return json.loads(token)
        except json.JSONDecodeError:
            return {}
    return json.loads(raw.decode())

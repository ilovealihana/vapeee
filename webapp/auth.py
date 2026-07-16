"""
Telegram Mini App initData verification.
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
from __future__ import annotations

import hashlib
import hmac
import json
from urllib.parse import parse_qsl, unquote

from fastapi import Header, HTTPException, status

from config import settings


def verify_init_data(init_data: str) -> dict:
    """
    Verify Telegram Mini App initData signature and return parsed user dict.
    Raises HTTPException 401 if invalid.
    """
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid init_data format")

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing hash")

    # Build data-check-string: sorted key=value pairs joined by \n
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items())
    )

    # HMAC key = HMAC-SHA256("WebAppData", bot_token)
    secret_key = hmac.new(
        b"WebAppData",
        settings.BOT_TOKEN.encode(),
        hashlib.sha256,
    ).digest()

    # Expected hash
    expected_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    # Parse user JSON
    user_str = parsed.get("user")
    if not user_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user in init_data")

    try:
        user_data = json.loads(unquote(user_str))
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user JSON")

    return user_data


def parse_init_data_unsafe(init_data: str) -> dict:
    """
    Parse initData without signature check (for local dev / testing).
    """
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    user_str = parsed.get("user", "{}")
    try:
        return json.loads(unquote(user_str))
    except Exception:
        return {}

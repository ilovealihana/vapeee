"""
Telegram Mini App initData verification.
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
from __future__ import annotations

import hashlib
import hmac
import json
from urllib.parse import parse_qsl, unquote

from config import settings
from webapp.errors import ErrorCode, api_error


def verify_init_data(init_data: str) -> dict:
    """
    Verify Telegram Mini App initData signature and return parsed user dict.
    Raises ApiError 401 if invalid.
    """
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    except Exception:
        raise api_error(401, ErrorCode.AUTH_INVALID_INIT_DATA_FORMAT, "Invalid initData format")

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise api_error(401, ErrorCode.AUTH_MISSING_HASH, "Missing hash")

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
        raise api_error(401, ErrorCode.AUTH_INVALID_SIGNATURE, "Invalid signature")

    # Parse user JSON
    user_str = parsed.get("user")
    if not user_str:
        raise api_error(401, ErrorCode.AUTH_MISSING_USER, "Missing user")

    try:
        user_data = json.loads(unquote(user_str))
    except json.JSONDecodeError:
        raise api_error(401, ErrorCode.AUTH_INVALID_USER_JSON, "Invalid user JSON")

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

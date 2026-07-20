from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class TelegramNotificationSender:
    def __init__(
        self,
        bot_token: str,
        webapp_url: str,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.bot_token = bot_token.strip() if bot_token else ""
        self.webapp_url = webapp_url.rstrip("/") if webapp_url else ""
        self.http_client = http_client

    async def send_message(
        self,
        chat_id: int,
        text: str,
        button_url: str | None = None,
        button_text: str | None = None,
        parse_mode: str | None = None,
    ) -> bool:
        if not self.bot_token:
            logger.error("Telegram notification skipped: BOT_TOKEN is not configured")
            return False

        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode

        if button_url and button_text:
            normalized_url = button_url.strip()
            if self._is_allowed_button_url(normalized_url):
                payload["reply_markup"] = {
                    "inline_keyboard": [[{"text": button_text, "url": normalized_url}]]
                }
            else:
                logger.warning("Telegram notification button URL rejected: %s", button_url)

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"

        try:
            if self.http_client is not None:
                response = await self.http_client.post(url, json=payload)
            else:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(url, json=payload)
        except httpx.HTTPError:
            logger.exception("Telegram notification failed due to HTTP client error")
            return False

        if response.status_code >= 400:
            logger.error(
                "Telegram notification failed: status=%s body=%s",
                response.status_code,
                response.text,
            )
            return False

        try:
            body = response.json()
        except ValueError:
            logger.error("Telegram notification failed: non-JSON response body=%s", response.text)
            return False

        if not body.get("ok"):
            logger.error("Telegram notification failed: body=%s", body)
            return False

        return True

    def _is_allowed_button_url(self, button_url: str) -> bool:
        if not self.webapp_url:
            logger.warning("Telegram notification button removed: WEBAPP_URL is not configured")
            return False
        return button_url == self.webapp_url or button_url.startswith(f"{self.webapp_url}/")

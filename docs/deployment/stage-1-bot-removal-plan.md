# Stage 1 Bot Removal Implementation Plan

> **For agentic workers:** implement task-by-task. Keep changes scoped to Stage 1: remove the interactive Telegram bot, remove Redis as required infrastructure, and add a backend Telegram notification sender. Do not implement product requests, staff/settings, media upload, or frontend i18n in this stage.

**Goal:** Convert the project to Mini App + FastAPI backend only, while preserving outbound Telegram notifications through a small HTTP-based backend sender.

**Architecture:** The old aiogram bot process is removed completely. FastAPI remains the only backend application process. Telegram is used only through direct Bot API HTTP calls from `webapp/services/notifications.py`.

**Tech Stack:** FastAPI, SQLAlchemy/Alembic, `httpx`, `unittest`, Docker Compose for backend + PostgreSQL.

---

## Confirmed Decisions

- Delete root `main.py`.
- Delete `bot/` completely.
- Delete old bot `.ftl` translations in `locales/`.
- Remove `aiogram`, `aiogram-i18n`, `redis`, and `fluent.runtime` from Python dependencies.
- Add `httpx`.
- Remove `REDIS_URL` and `WEBHOOK_*` settings from application config and examples.
- Keep `docker-compose.yml`, but reduce it to backend + PostgreSQL.
- Add `TelegramNotificationSender` in `webapp/services/notifications.py`.
- Use a low-level API only: `send_message(chat_id, text, button_url=None, button_text=None, parse_mode=None)`.
- `parse_mode` is optional and exists only to preserve current low-level Telegram formatting behavior for existing order notifications; new business-specific notification helpers are still out of scope.
- Validate button URLs against `WEBAPP_URL`; if invalid, log and send without a button.
- On missing token, Telegram API error, network error, or timeout: log and return `False`; do not retry and do not raise into business logic.
- `BOT_TOKEN` defaults to an empty string so the backend can start without notification credentials; the sender handles the missing-token case.
- Use `unittest`, not `pytest`.
- Do not implement new product request notifications in Stage 1.
- Existing order notifications currently use `aiogram` in `webapp/routes/orders.py`; migrate that existing notification call to the new sender so order creation does not lose current notification behavior when `aiogram` is removed.

## File Map

- Delete: `main.py`
- Delete: `bot/`
- Delete: `locales/`
- Modify: `requirements.txt`
- Modify: `config.py`
- Create: `webapp/services/__init__.py`
- Create: `webapp/services/notifications.py`
- Modify: `webapp/routes/orders.py`
- Modify: `Procfile`
- Modify: `Dockerfile`
- Create: `.dockerignore`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `tests/test_notifications.py`
- Create: `tests/test_backend_import.py`

## Task 1: Dependency Cleanup

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Update dependencies before writing sender tests**

In `requirements.txt`, remove:

```text
aiogram==3.13.1
aiogram-i18n==1.3.1
fluent.runtime==0.4.0
redis==5.2.1
```

Add:

```text
httpx==0.28.1
```

- [ ] **Step 2: Install updated dependencies if the local environment is missing `httpx`**

Run:

```bash
python -c "import httpx; print(httpx.__version__)"
```

Expected if dependencies are already installed: prints `0.28.1`.

If it fails with `ModuleNotFoundError: No module named 'httpx'`, run:

```bash
python -m pip install -r requirements.txt
```

Then re-run:

```bash
python -c "import httpx; print(httpx.__version__)"
```

Expected: prints `0.28.1`.

## Task 2: Notification Sender Tests

**Files:**
- Create: `tests/test_notifications.py`

- [ ] **Step 1: Add failing sender tests**

Create `tests/test_notifications.py`:

```python
import json
import logging
import unittest

import httpx

from webapp.services.notifications import TelegramNotificationSender


class TelegramNotificationSenderTest(unittest.IsolatedAsyncioTestCase):
    async def test_send_message_posts_text_payload(self):
        requests = []

        async def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(200, json={"ok": True, "result": {"message_id": 1}})

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://api.telegram.org",
        ) as client:
            sender = TelegramNotificationSender(
                bot_token="token",
                webapp_url="https://mini.app",
                http_client=client,
            )
            sent = await sender.send_message(123, "Hello")

        self.assertTrue(sent)
        self.assertEqual(len(requests), 1)
        self.assertEqual(
            requests[0].url.path,
            "/bottoken/sendMessage",
        )
        self.assertEqual(
            json.loads(requests[0].read().decode()),
            {"chat_id": 123, "text": "Hello"},
        )

    async def test_send_message_adds_inline_button_for_valid_webapp_url(self):
        payloads = []

        async def handler(request: httpx.Request) -> httpx.Response:
            payloads.append(request.read().decode())
            return httpx.Response(200, json={"ok": True})

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://api.telegram.org",
        ) as client:
            sender = TelegramNotificationSender(
                bot_token="token",
                webapp_url="https://mini.app",
                http_client=client,
            )
            sent = await sender.send_message(
                123,
                "Open order",
                button_url="https://mini.app/admin/orders/1",
                button_text="Open",
            )

        self.assertTrue(sent)
        self.assertIn('"reply_markup"', payloads[0])
        self.assertIn('"text":"Open"', payloads[0])
        self.assertIn('"url":"https://mini.app/admin/orders/1"', payloads[0])

    async def test_send_message_accepts_optional_parse_mode(self):
        payloads = []

        async def handler(request: httpx.Request) -> httpx.Response:
            payloads.append(json.loads(request.read().decode()))
            return httpx.Response(200, json={"ok": True})

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://api.telegram.org",
        ) as client:
            sender = TelegramNotificationSender(
                bot_token="token",
                webapp_url="https://mini.app",
                http_client=client,
            )
            sent = await sender.send_message(123, "<b>Hello</b>", parse_mode="HTML")

        self.assertTrue(sent)
        self.assertEqual(payloads[0]["parse_mode"], "HTML")

    async def test_invalid_button_url_is_logged_and_removed(self):
        payloads = []

        async def handler(request: httpx.Request) -> httpx.Response:
            payloads.append(request.read().decode())
            return httpx.Response(200, json={"ok": True})

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://api.telegram.org",
        ) as client:
            sender = TelegramNotificationSender(
                bot_token="token",
                webapp_url="https://mini.app",
                http_client=client,
            )
            with self.assertLogs("webapp.services.notifications", level=logging.WARNING):
                sent = await sender.send_message(
                    123,
                    "Unsafe link",
                    button_url="https://example.com/admin",
                    button_text="Open",
                )

        self.assertTrue(sent)
        self.assertNotIn("reply_markup", payloads[0])

    async def test_missing_token_logs_and_returns_false(self):
        sender = TelegramNotificationSender(bot_token="", webapp_url="https://mini.app")

        with self.assertLogs("webapp.services.notifications", level=logging.ERROR):
            sent = await sender.send_message(123, "Hello")

        self.assertFalse(sent)

    async def test_telegram_error_logs_and_returns_false(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={"ok": False, "description": "Bad Request"})

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://api.telegram.org",
        ) as client:
            sender = TelegramNotificationSender(
                bot_token="token",
                webapp_url="https://mini.app",
                http_client=client,
            )
            with self.assertLogs("webapp.services.notifications", level=logging.ERROR):
                sent = await sender.send_message(123, "Hello")

        self.assertFalse(sent)

    async def test_network_error_logs_and_returns_false(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("network down", request=request)

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://api.telegram.org",
        ) as client:
            sender = TelegramNotificationSender(
                bot_token="token",
                webapp_url="https://mini.app",
                http_client=client,
            )
            with self.assertLogs("webapp.services.notifications", level=logging.ERROR):
                sent = await sender.send_message(123, "Hello")

        self.assertFalse(sent)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests and verify expected failure**

Run:

```bash
python -m unittest tests.test_notifications -v
```

Expected before implementation: import failure for `webapp.services.notifications`.

## Task 3: Notification Sender Implementation

**Files:**
- Create: `webapp/services/__init__.py`
- Create: `webapp/services/notifications.py`

- [ ] **Step 1: Add service package**

Create `webapp/services/__init__.py`:

```python
"""Backend service modules."""
```

- [ ] **Step 2: Implement `TelegramNotificationSender`**

Create `webapp/services/notifications.py`:

```python
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
```

- [ ] **Step 3: Run sender tests**

Run:

```bash
python -m unittest tests.test_notifications -v
```

Expected: all sender tests pass.

## Task 4: Config Cleanup

**Files:**
- Modify: `config.py`
- Modify: `.env.example`

- [ ] **Step 1: Remove Redis/webhook settings from config**

Update `config.py` so `Settings` no longer defines:

```python
REDIS_URL: str = "redis://localhost:6379/0"
WEBHOOK_HOST: str = ""
WEBHOOK_PATH: str = "/webhook"
WEBHOOK_PORT: int = 8443

@property
def webhook_url(self) -> str | None:
    ...
```

Keep:

```python
BOT_TOKEN: str = ""
DATABASE_URL: str = "postgresql+asyncpg://vapebot:vapebot_secret@localhost:5432/vapebot"
ADMIN_IDS: List[int] = []
INPOST_DELIVERY_COST: Decimal = Decimal("15.00")
SUPPORT_USERNAME: str = "support"
WEBAPP_URL: str = "https://frontend-vapebot.vercel.app"
```

- [ ] **Step 2: Remove legacy variables from `.env.example`**

Delete these sections from `.env.example`:

```text
# Redis
REDIS_URL=redis://localhost:6379/0

# Webhook (production). Leave empty for polling (dev).
WEBHOOK_HOST=
WEBHOOK_PATH=/webhook
WEBHOOK_PORT=8443
```

- [ ] **Step 3: Verify settings ignore old local `.env`**

Run:

```bash
python -c "from config import settings; print(settings.WEBAPP_URL)"
```

Expected: prints a URL and does not fail if old `.env` still contains `REDIS_URL` or `WEBHOOK_*`, because `extra='ignore'` remains configured.

## Task 5: Migrate Existing Order Notifications Off aiogram

**Files:**
- Modify: `webapp/routes/orders.py`

- [ ] **Step 1: Replace aiogram imports inside `_notify_admins`**

Remove dynamic imports:

```python
from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
```

Use:

```python
from webapp.services.notifications import TelegramNotificationSender
```

- [ ] **Step 2: Replace bot creation and send loop**

Inside `_notify_admins`, replace aiogram bot usage with:

```python
sender = TelegramNotificationSender(
    bot_token=settings.BOT_TOKEN,
    webapp_url=settings.WEBAPP_URL,
)

for admin_id in settings.ADMIN_IDS:
    await sender.send_message(admin_id, text, parse_mode="HTML")
```

Remove:

```python
await bot.session.close()
```

- [ ] **Step 3: Preserve business behavior and log unexpected formatting failures**

Keep order creation independent from notification failures, but do not silently swallow unexpected formatting errors.

At the top of `webapp/routes/orders.py`, add:

```python
import logging
```

Near module-level helper functions, add:

```python
logger = logging.getLogger(__name__)
```

The outer exception handler in `_notify_admins` must become:

```python
    except Exception:
        logger.exception("Failed to build or send order notification")
```

The sender itself handles Telegram/network errors by logging and returning `False`, so the route still must not raise when a notification fails.

- [ ] **Step 4: Run existing order tests**

Run:

```bash
python -m unittest tests.test_order_delivery -v
```

Expected: 3 tests pass.

## Task 6: Backend Import Smoke Test

**Files:**
- Create: `tests/test_backend_import.py`

- [ ] **Step 1: Add import smoke test**

Create `tests/test_backend_import.py`:

```python
import unittest


class BackendImportTest(unittest.TestCase):
    def test_fastapi_app_imports(self):
        from webapp.main import app

        self.assertEqual(app.title, "VapeShop Mini App API")
        routes = {route.path for route in app.routes}
        self.assertIn("/health", routes)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run smoke test**

Run:

```bash
python -m unittest tests.test_backend_import -v
```

Expected: test passes.

## Task 7: Delete Legacy Bot Files

**Files:**
- Delete: `main.py`
- Delete: `bot/`
- Delete: `locales/`

- [ ] **Step 1: Delete legacy entrypoint**

Delete root `main.py`.

- [ ] **Step 2: Delete legacy bot package**

Delete the full `bot/` directory.

- [ ] **Step 3: Delete old bot locales**

Delete the full `locales/` directory.

- [ ] **Step 4: Search for forbidden imports**

Run:

```bash
rg -n "from bot|import bot|aiogram|fluent|RedisStorage|WEBHOOK_|webhook_url" -S .
```

Expected: no matches in application code. Matches inside approved docs are acceptable only when they describe legacy removal or prohibited target architecture.

Run the broader application runtime search before deployment files are cleaned:

```bash
rg -n "from bot|import bot|['\"]bot\\.|aiogram|fluent|RedisStorage|FSM|start_polling|polling|webhook|WEBHOOK_|webhook_url|from redis|import redis|redis\\.|REDIS_URL|locales" -S config.py requirements.txt webapp tests
```

Expected: no matches in application runtime code, dependency files, or tests.

## Task 8: Deployment Cleanup

**Files:**
- Modify: `Procfile`
- Modify: `Dockerfile`
- Create: `.dockerignore`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Remove bot process from `Procfile`**

Final `Procfile`:

```text
web: alembic upgrade head && uvicorn webapp.main:app --host 0.0.0.0 --port $PORT
```

- [ ] **Step 2: Update Dockerfile command**

Replace:

```dockerfile
CMD ["sh", "-c", "alembic upgrade head && python main.py"]
```

With:

```dockerfile
CMD ["sh", "-c", "alembic upgrade head && uvicorn webapp.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

Also update the nearby comment from "start bot" to "start backend".

- [ ] **Step 3: Add Docker ignore rules**

Create `.dockerignore`:

```text
__pycache__/
*.pyc
.env
.venv/
frontend/node_modules/
frontend/dist/
```

- [ ] **Step 4: Reduce Compose to backend + PostgreSQL**

Final `docker-compose.yml` should contain:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: vapebot_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-vapebot}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-vapebot_secret}
      POSTGRES_DB: ${POSTGRES_DB:-vapebot}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-vapebot}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: .
    container_name: vapebot_backend
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-vapebot}:${POSTGRES_PASSWORD:-vapebot_secret}@postgres:5432/${POSTGRES_DB:-vapebot}
    ports:
      - "${PORT:-8000}:${PORT:-8000}"
    command: sh -c "alembic upgrade head && uvicorn webapp.main:app --host 0.0.0.0 --port ${PORT:-8000}"

volumes:
  postgres_data:
```

- [ ] **Step 5: Verify no bot/Redis process remains**

Run:

```bash
rg -n "python main\\.py|^bot:|^\\s+redis:|REDIS_URL|6379|RedisStorage" Procfile Dockerfile docker-compose.yml .env.example config.py
```

Expected: no matches.

## Task 9: README Cleanup

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update stack description**

Replace references to:

```text
aiogram 3
python main.py
docker-compose up postgres redis -d
REDIS_URL
WEBHOOK_HOST
polling
```

With FastAPI/Mini App-only startup instructions:

```text
uvicorn webapp.main:app --reload
docker compose up postgres backend
```

- [ ] **Step 2: Keep env list aligned**

The README environment list must include:

```text
BOT_TOKEN
DATABASE_URL
ADMIN_IDS
INPOST_DELIVERY_COST
SUPPORT_USERNAME
WEBAPP_URL
```

It must not include:

```text
REDIS_URL
WEBHOOK_HOST
WEBHOOK_PATH
WEBHOOK_PORT
```

## Task 10: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run unittest suite**

Run:

```bash
python -m unittest discover -s tests -v
```

Expected: all tests pass.

- [ ] **Step 2: Verify backend import and routes**

Run:

```bash
python -c "from webapp.main import app; print(len(app.routes)); print(any(r.path == '/health' for r in app.routes))"
```

Expected: prints a route count and `True`.

- [ ] **Step 3: Verify forbidden runtime references are gone**

Run:

```bash
rg -n "from bot|import bot|['\"]bot\\.|aiogram|aiogram-i18n|fluent\\.runtime|RedisStorage|FSM|start_polling|polling|webhook|WEBHOOK_|webhook_url|from redis|import redis|redis\\.|redis==|REDIS_URL|python main\\.py|^bot:|locales" -S .
```

Expected:
- no matches in runtime code, dependency files, `.env.example`, or deployment files;
- documentation matches are acceptable only when describing legacy removal or prohibited target architecture.

- [ ] **Step 4: Review git status**

Run:

```bash
git status --short
```

Expected:
- planned Stage 1 files changed/deleted/created;
- unrelated existing frontend and docs changes remain untouched.

## Risks and Rollback

- Removing `aiogram` will break any hidden runtime import. Mitigation: repository-wide search and backend import smoke test.
- Existing order notifications contain corrupted text. Stage 1 should preserve behavior structure but not rewrite business copy beyond removing `aiogram`.
- Notification sending is best-effort. A failed Telegram call must not fail order creation or any future business operation.
- Local old `.env` may still contain removed variables. `SettingsConfigDict(extra="ignore")` must remain.
- Rollback: restore `main.py`, `bot/`, `locales/`, old dependencies, old deploy commands, and old `webapp/routes/orders.py` notification block from git if Stage 1 must be reverted.

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
        self.assertEqual(requests[0].url.path, "/bottoken/sendMessage")
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

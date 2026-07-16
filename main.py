"""
Entry point for the Telegram Shop Bot.
Supports both polling (dev) and webhook (production).
"""
from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import RedisStorage

from bot.handlers import start, profile, catalog, cart, order
from bot.handlers.admin import menu as admin_menu
from bot.handlers.admin import products as admin_products
from bot.handlers.admin import locations as admin_locations
from bot.handlers.admin import stock as admin_stock
from bot.handlers.admin import orders as admin_orders
from bot.middlewares.db import DbSessionMiddleware
from bot.middlewares.i18n import UserLocaleMiddleware
from config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    storage = RedisStorage.from_url(settings.REDIS_URL)

    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher(storage=storage)

    # ── Middlewares (order matters: DB first, then locale) ──
    dp.update.middleware(DbSessionMiddleware())
    dp.update.middleware(UserLocaleMiddleware())

    # ── Routers ────────────────────────────────────────────
    # Admin routers first (more specific filters)
    dp.include_router(admin_menu.router)
    dp.include_router(admin_products.router)
    dp.include_router(admin_locations.router)
    dp.include_router(admin_stock.router)
    dp.include_router(admin_orders.router)

    # User routers
    dp.include_router(start.router)
    dp.include_router(profile.router)
    dp.include_router(catalog.router)
    dp.include_router(cart.router)
    dp.include_router(order.router)

    # ── Start ──────────────────────────────────────────────
    if settings.webhook_url:
        logger.info("Starting in webhook mode: %s", settings.webhook_url)
        from aiohttp import web
        from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application

        app = web.Application()
        await bot.set_webhook(
            url=settings.webhook_url,
            drop_pending_updates=True,
        )
        SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=settings.WEBHOOK_PATH)
        setup_application(app, dp, bot=bot)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", settings.WEBHOOK_PORT)
        await site.start()
        logger.info("Webhook server started on port %s", settings.WEBHOOK_PORT)
        await asyncio.Event().wait()  # run forever
    else:
        logger.info("Starting in polling mode")
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())

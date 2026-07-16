from __future__ import annotations

import os

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)
from sqlalchemy.ext.asyncio import AsyncSession

from bot.keyboards.main_menu import main_menu_kb
from bot.utils.i18n import get_translator
from db.repositories.cart import CartRepository
from db.repositories.user import UserRepository

router = Router(name="start")

# URL фронтенда Mini App (задаётся через .env или переменную окружения)
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-vapeshop.vercel.app")


def webapp_keyboard(locale: str) -> InlineKeyboardMarkup:
    labels = {
        "ru": "🛒 Открыть магазин",
        "pl": "🛒 Otwórz sklep",
        "uk": "🛒 Відкрити магазин",
    }
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text=labels.get(locale, "🛒 Открыть магазин"),
            web_app=WebAppInfo(url=WEBAPP_URL),
        )
    ]])


@router.message(CommandStart())
async def cmd_start(message: Message, session: AsyncSession) -> None:
    tg = message.from_user
    repo = UserRepository(session)
    user = await repo.upsert(
        tg_id=tg.id,
        first_name=tg.first_name or "",
        last_name=tg.last_name,
        username=tg.username,
    )

    locale = user.language
    t = get_translator(locale)

    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    cart_count = sum(i.quantity for i in cart.items) if cart else 0

    greeting_key = "welcome" if not cart else "welcome-back"

    await message.answer(
        t(greeting_key, name=tg.first_name or ""),
        reply_markup=main_menu_kb(locale, cart_count),
    )

    # Send Mini App launch button
    await message.answer(
        "👆 Нажми кнопку ниже чтобы открыть магазин:",
        reply_markup=webapp_keyboard(locale),
    )

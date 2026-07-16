from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.filters.admin import IsAdmin

router = Router(name="admin_menu")
router.message.filter(IsAdmin())


def admin_main_kb() -> InlineKeyboardBuilder:
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="📦 Товары", callback_data="adm:products"))
    builder.row(InlineKeyboardButton(text="🏪 Локации", callback_data="adm:locations"))
    builder.row(InlineKeyboardButton(text="📊 Остатки", callback_data="adm:stock"))
    builder.row(InlineKeyboardButton(text="📋 Заказы", callback_data="adm:orders"))
    builder.row(InlineKeyboardButton(text="👥 Администраторы", callback_data="adm:admins"))
    return builder


@router.message(Command("admin"))
async def cmd_admin(message: Message) -> None:
    await message.answer(
        "🔧 <b>Панель администратора</b>\n\nВыбери раздел:",
        reply_markup=admin_main_kb().as_markup(),
        parse_mode="HTML",
    )

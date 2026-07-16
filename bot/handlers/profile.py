from __future__ import annotations

from aiogram import F, Router
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.keyboards.main_menu import main_menu_kb
from bot.utils.formatters import fmt_date, fmt_price, order_status_emoji
from bot.utils.i18n import get_translator
from config import settings
from db.repositories.cart import CartRepository
from db.repositories.order import OrderRepository
from db.repositories.user import UserRepository

router = Router(name="profile")

LANG_DISPLAY = {"ru": "🇷🇺 Русский", "pl": "🇵🇱 Polski", "uk": "🇺🇦 Українська"}


def _profile_kb(locale: str) -> InlineKeyboardMarkup:
    t = get_translator(locale)
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text=t("btn-orders-history"), callback_data="profile:orders:0"))
    builder.row(InlineKeyboardButton(text=t("btn-change-language"), callback_data="profile:lang"))
    builder.row(
        InlineKeyboardButton(text=t("btn-support"), url=f"https://t.me/{settings.SUPPORT_USERNAME}")
    )
    return builder.as_markup()


def _lang_kb() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="🇷🇺 Русский", callback_data="lang:ru"))
    builder.row(InlineKeyboardButton(text="🇵🇱 Polski", callback_data="lang:pl"))
    builder.row(InlineKeyboardButton(text="🇺🇦 Українська", callback_data="lang:uk"))
    return builder.as_markup()


# ── Show profile ───────────────────────────────────────────

@router.message(F.text.in_({"👤 Профіль", "👤 Profil", "👤 Профиль"}))
async def show_profile(message: Message, session: AsyncSession) -> None:
    repo = UserRepository(session)
    user = await repo.get_by_tg_id(message.from_user.id)
    if not user:
        await message.answer("Сначала нажми /start")
        return

    t = get_translator(user.language)
    text = t(
        "profile-text",
        name=f"{user.first_name} {user.last_name or ''}".strip(),
        date=fmt_date(user.created_at),
        lang=LANG_DISPLAY.get(user.language, user.language),
    )
    await message.answer(text, reply_markup=_profile_kb(user.language), parse_mode="HTML")


# ── Language ───────────────────────────────────────────────

@router.callback_query(F.data == "profile:lang")
async def cb_choose_lang(callback: CallbackQuery, session: AsyncSession) -> None:
    repo = UserRepository(session)
    user = await repo.get_by_tg_id(callback.from_user.id)
    locale = user.language if user else "ru"
    t = get_translator(locale)
    await callback.message.edit_text(t("language-choose"), reply_markup=_lang_kb())
    await callback.answer()


@router.callback_query(F.data.startswith("lang:"))
async def cb_set_lang(callback: CallbackQuery, session: AsyncSession) -> None:
    lang = callback.data.split(":")[1]
    if lang not in ("ru", "pl", "uk"):
        await callback.answer()
        return

    repo = UserRepository(session)
    await repo.set_language(callback.from_user.id, lang)
    user = await repo.get_by_tg_id(callback.from_user.id)

    t = get_translator(lang)
    await callback.message.edit_text(t("language-changed"))

    # Refresh main menu
    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    cart_count = sum(i.quantity for i in cart.items) if cart else 0
    await callback.message.answer(t("main-menu-text"), reply_markup=main_menu_kb(lang, cart_count))
    await callback.answer()


# ── Order history ──────────────────────────────────────────

@router.callback_query(F.data.startswith("profile:orders:"))
async def cb_order_history(callback: CallbackQuery, session: AsyncSession) -> None:
    page = int(callback.data.split(":")[-1])

    repo = UserRepository(session)
    user = await repo.get_by_tg_id(callback.from_user.id)
    if not user:
        await callback.answer()
        return

    locale = user.language
    t = get_translator(locale)

    order_repo = OrderRepository(session)
    orders = await order_repo.get_user_orders(user.id, page=page, page_size=5)

    if not orders:
        await callback.message.edit_text(t("orders-history-empty"))
        await callback.answer()
        return

    status_map = {
        "new": t("order-status-new"),
        "confirmed": t("order-status-confirmed"),
        "ready": t("order-status-ready"),
        "completed": t("order-status-completed"),
        "cancelled": t("order-status-cancelled"),
    }

    lines = [t("orders-history-header")]
    for o in orders:
        item_count = sum(i.quantity for i in o.items)
        lines.append(
            t(
                "order-item-line",
                id=o.id,
                date=fmt_date(o.created_at),
                items=str(item_count),
                total=fmt_price(o.total),
                status=status_map.get(o.status, o.status),
            )
        )

    builder = InlineKeyboardBuilder()
    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton(text="◀️", callback_data=f"profile:orders:{page - 1}"))
    if len(orders) == 5:
        nav_row.append(InlineKeyboardButton(text="▶️", callback_data=f"profile:orders:{page + 1}"))
    if nav_row:
        builder.row(*nav_row)
    builder.row(InlineKeyboardButton(text=t("btn-back"), callback_data="profile:back"))

    await callback.message.edit_text(
        "\n\n".join(lines), reply_markup=builder.as_markup(), parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data == "profile:back")
async def cb_profile_back(callback: CallbackQuery, session: AsyncSession) -> None:
    repo = UserRepository(session)
    user = await repo.get_by_tg_id(callback.from_user.id)
    if not user:
        await callback.answer()
        return
    t = get_translator(user.language)
    text = t(
        "profile-text",
        name=f"{user.first_name} {user.last_name or ''}".strip(),
        date=fmt_date(user.created_at),
        lang=LANG_DISPLAY.get(user.language, user.language),
    )
    await callback.message.edit_text(text, reply_markup=_profile_kb(user.language), parse_mode="HTML")
    await callback.answer()

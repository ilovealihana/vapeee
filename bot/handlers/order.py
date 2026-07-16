"""
Full Order FSM handler.
Manages states: delivery type → name → phone → email → [address] → date → time → summary → payment.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.states.order import OrderFSM
from bot.utils.calendar import CalendarCallback, build_calendar, build_time_slots
from bot.utils.formatters import fmt_price
from bot.utils.i18n import get_translator
from config import settings
from db.repositories.cart import CartRepository
from db.repositories.catalog import CatalogRepository
from db.repositories.order import OrderRepository
from db.repositories.user import UserRepository

router = Router(name="order")

PHONE_RE = re.compile(r"^\+?[\d\s\-()]{7,20}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def _get_user(tg_id: int, session: AsyncSession):
    return await UserRepository(session).get_by_tg_id(tg_id)


def _payment_kb(locale: str):
    t = get_translator(locale)
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text=t("btn-pay-cash"), callback_data="pay:cash"))
    builder.row(InlineKeyboardButton(text=t("btn-pay-blik"), callback_data="pay:blik"))
    builder.row(InlineKeyboardButton(text=t("btn-pay-monobank"), callback_data="pay:monobank"))
    return builder.as_markup()


# ─── Delivery type ────────────────────────────────────────

@router.callback_query(OrderFSM.SELECT_DELIVERY_TYPE, F.data.startswith("order:delivery:"))
async def cb_delivery_type(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    dtype = callback.data.split(":")[-1]  # "pickup" or "inpost"
    await state.update_data(delivery_type=dtype)

    user = await _get_user(callback.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    await state.set_state(OrderFSM.ENTER_NAME)
    await callback.message.edit_text(t("enter-name"), parse_mode="HTML")
    await callback.answer()


# ─── Name ─────────────────────────────────────────────────

@router.message(OrderFSM.ENTER_NAME)
async def fsm_name(message: Message, state: FSMContext, session: AsyncSession) -> None:
    user = await _get_user(message.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    await state.update_data(customer_name=message.text.strip())
    await state.set_state(OrderFSM.ENTER_PHONE)
    await message.answer(t("enter-phone"), parse_mode="HTML")


# ─── Phone ────────────────────────────────────────────────

@router.message(OrderFSM.ENTER_PHONE)
async def fsm_phone(message: Message, state: FSMContext, session: AsyncSession) -> None:
    user = await _get_user(message.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    phone = message.text.strip()
    if not PHONE_RE.match(phone):
        await message.answer(t("invalid-phone"))
        return

    await state.update_data(customer_phone=phone)
    await state.set_state(OrderFSM.ENTER_EMAIL)
    await message.answer(t("enter-email"), parse_mode="HTML")


# ─── Email ────────────────────────────────────────────────

@router.message(OrderFSM.ENTER_EMAIL)
async def fsm_email(message: Message, state: FSMContext, session: AsyncSession) -> None:
    user = await _get_user(message.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    email = message.text.strip()
    if not EMAIL_RE.match(email):
        await message.answer(t("invalid-email"))
        return

    await state.update_data(customer_email=email)
    data = await state.get_data()

    if data.get("delivery_type") == "inpost":
        await state.set_state(OrderFSM.ENTER_ADDRESS)
        await message.answer(t("enter-address"), parse_mode="HTML")
    else:
        await state.set_state(OrderFSM.SELECT_DATE)
        today = date.today()
        await message.answer(
            t("choose-date"),
            reply_markup=build_calendar(today.year, today.month, locale),
            parse_mode="HTML",
        )


# ─── Address (InPost only) ────────────────────────────────

@router.message(OrderFSM.ENTER_ADDRESS)
async def fsm_address(message: Message, state: FSMContext, session: AsyncSession) -> None:
    user = await _get_user(message.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    await state.update_data(delivery_address=message.text.strip())
    await state.set_state(OrderFSM.SELECT_DATE)
    today = date.today()
    await message.answer(
        t("choose-date"),
        reply_markup=build_calendar(today.year, today.month, locale),
        parse_mode="HTML",
    )


# ─── Calendar navigation ──────────────────────────────────

@router.callback_query(OrderFSM.SELECT_DATE, CalendarCallback.filter(F.action.in_(["prev", "next"])))
async def cb_cal_nav(callback: CallbackQuery, callback_data: CalendarCallback, state: FSMContext, session: AsyncSession) -> None:
    user = await _get_user(callback.from_user.id, session)
    locale = user.language if user else "ru"
    await callback.message.edit_reply_markup(
        reply_markup=build_calendar(callback_data.year, callback_data.month, locale)
    )
    await callback.answer()


@router.callback_query(OrderFSM.SELECT_DATE, CalendarCallback.filter(F.action == "ignore"))
async def cb_cal_ignore(callback: CallbackQuery) -> None:
    await callback.answer()


@router.callback_query(OrderFSM.SELECT_DATE, CalendarCallback.filter(F.action == "day"))
async def cb_cal_day(callback: CallbackQuery, callback_data: CalendarCallback, state: FSMContext, session: AsyncSession) -> None:
    selected = date(callback_data.year, callback_data.month, callback_data.day)
    await state.update_data(selected_date=selected.isoformat())
    await state.set_state(OrderFSM.SELECT_TIME)

    user = await _get_user(callback.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    await callback.message.edit_text(t("choose-time"), reply_markup=build_time_slots(locale), parse_mode="HTML")
    await callback.answer()


# ─── Time slot ────────────────────────────────────────────

@router.callback_query(OrderFSM.SELECT_TIME, F.data.startswith("time:"))
async def cb_time_slot(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    slot = callback.data.split(":", 1)[1]  # "10:00"
    await state.update_data(selected_time=slot)

    user = await _get_user(callback.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    data = await state.get_data()
    selected_date = data.get("selected_date", "")

    # Build summary preview
    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    catalog = CatalogRepository(session)

    products_total = 0.0
    item_lines = []
    if cart:
        for item in cart.items:
            variant = item.variant
            product = await catalog.get_product(variant.product_id) if variant else None
            price = float(variant.price_override or (product.base_price if product else 0)) if variant else 0.0
            subtotal = price * item.quantity
            products_total += subtotal
            v_name = getattr(variant, f"name_{locale}", None) or variant.name_ru if variant else "?"
            item_lines.append(f"• {v_name} × {item.quantity} = {fmt_price(subtotal)} zł")

    delivery_type = data.get("delivery_type", "pickup")
    delivery_cost = float(settings.INPOST_DELIVERY_COST) if delivery_type == "inpost" else 0.0
    total = products_total + delivery_cost

    await state.update_data(
        products_total=products_total,
        delivery_cost=delivery_cost,
        total=total,
        item_lines=item_lines,
    )

    if delivery_type == "pickup" and cart and cart.location:
        delivery_info = f"🏪 {cart.location.name}, {cart.location.address}"
    elif delivery_type == "inpost":
        delivery_info = f"📦 InPost: {data.get('delivery_address', '')}"
    else:
        delivery_info = "—"

    summary = (
        f"📋 <b>Сводка заказа</b>\n\n"
        f"{chr(10).join(item_lines)}\n\n"
        f"🚚 Доставка: <b>{fmt_price(delivery_cost)} zł</b>\n"
        f"💰 Итого: <b>{fmt_price(total)} zł</b>\n\n"
        f"📅 {selected_date} {slot}\n"
        f"📍 {delivery_info}\n"
        f"👤 {data.get('customer_name', '')} | {data.get('customer_phone', '')}\n"
        f"📧 {data.get('customer_email', '')}"
    )

    await state.set_state(OrderFSM.CONFIRM_SUMMARY)
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text=t("btn-add-comment"), callback_data="order:comment"))
    builder.row(InlineKeyboardButton(text=t("btn-confirm-order"), callback_data="order:confirm"))

    await callback.message.edit_text(summary, reply_markup=builder.as_markup(), parse_mode="HTML")
    await callback.answer()


# ─── Comment ──────────────────────────────────────────────

@router.callback_query(OrderFSM.CONFIRM_SUMMARY, F.data == "order:comment")
async def cb_add_comment(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    user = await _get_user(callback.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    await state.set_state(OrderFSM.ENTER_COMMENT)
    await callback.message.edit_text(t("enter-comment"))
    await callback.answer()


@router.message(OrderFSM.ENTER_COMMENT)
async def fsm_comment(message: Message, state: FSMContext, session: AsyncSession) -> None:
    comment = None if message.text.strip().lower() in ("/skip", "skip") else message.text.strip()
    await state.update_data(comment=comment)
    await state.set_state(OrderFSM.CONFIRM_SUMMARY)

    user = await _get_user(message.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text=t("btn-confirm-order"), callback_data="order:confirm"))
    await message.answer("✅ Комментарий сохранён.", reply_markup=builder.as_markup())


# ─── Confirm → payment ────────────────────────────────────

@router.callback_query(OrderFSM.CONFIRM_SUMMARY, F.data == "order:confirm")
async def cb_confirm_order(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    user = await _get_user(callback.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    await state.set_state(OrderFSM.SELECT_PAYMENT)
    await callback.message.edit_text(t("choose-payment"), reply_markup=_payment_kb(locale))
    await callback.answer()


# ─── Payment → create order ───────────────────────────────

@router.callback_query(OrderFSM.SELECT_PAYMENT, F.data.startswith("pay:"))
async def cb_payment(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    payment_method = callback.data.split(":")[1]
    data = await state.get_data()

    user = await _get_user(callback.from_user.id, session)
    locale = user.language if user else "ru"
    t = get_translator(locale)

    # Parse scheduled datetime
    raw_date = data.get("selected_date", "")
    raw_time = data.get("selected_time", "10:00")
    try:
        scheduled_at = datetime.strptime(f"{raw_date} {raw_time}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except ValueError:
        scheduled_at = None

    # Cart items
    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    catalog = CatalogRepository(session)

    order_items = []
    from decimal import Decimal
    if cart:
        for item in cart.items:
            variant = item.variant
            product = await catalog.get_product(variant.product_id) if variant else None
            price = variant.price_override or (product.base_price if product else Decimal("0"))
            order_items.append({
                "variant_id": item.variant_id,
                "quantity": item.quantity,
                "price_at_order": price,
            })

    products_total = Decimal(str(data.get("products_total", 0)))
    delivery_cost = Decimal(str(data.get("delivery_cost", 0)))
    total = Decimal(str(data.get("total", 0)))

    order_repo = OrderRepository(session)
    order = await order_repo.create(
        user_id=user.id,
        delivery_type=data.get("delivery_type", "pickup"),
        customer_name=data.get("customer_name", ""),
        customer_phone=data.get("customer_phone", ""),
        customer_email=data.get("customer_email", ""),
        products_total=products_total,
        delivery_cost=delivery_cost,
        total=total,
        payment_method=payment_method,
        location_id=cart.location_id if cart else None,
        delivery_address=data.get("delivery_address"),
        scheduled_at=scheduled_at,
        comment=data.get("comment"),
    )
    await order_repo.add_items(order.id, order_items)

    # Deduct stock if pickup
    if cart and cart.location_id:
        for item in cart.items:
            if item.variant_id:
                from sqlalchemy import select, update
                from db.models.location_stock import LocationStock
                from datetime import datetime as dt
                result = await session.execute(
                    select(LocationStock).where(
                        LocationStock.location_id == cart.location_id,
                        LocationStock.variant_id == item.variant_id,
                    )
                )
                stock = result.scalar_one_or_none()
                if stock:
                    stock.quantity = max(0, stock.quantity - item.quantity)
                    stock.last_sold_at = dt.now(tz=timezone.utc)
        await session.commit()

    # Clear cart
    await cart_repo.clear(cart.id)

    await state.clear()

    await callback.message.edit_text(
        t("order-placed", id=order.id), parse_mode="HTML"
    )
    await callback.answer()

    # Notify admins
    await _notify_admins(callback, order, data, order_items, catalog, locale, session)


async def _notify_admins(callback, order, data, items, catalog, locale, session):
    """Send new order notification to all configured admin IDs."""
    from bot.utils.formatters import fmt_price, fmt_date
    from config import settings

    item_lines = "\n".join(data.get("item_lines", []))
    delivery_label = "InPost доставка" if order.delivery_type == "inpost" else "Самовывоз"
    comment = f"💬 {order.comment}" if order.comment else ""

    text = (
        f"🆕 <b>Новый заказ #{order.id}</b>\n\n"
        f"👤 {order.customer_name} | {order.customer_phone}\n"
        f"📧 {order.customer_email}\n"
        f"🚚 {delivery_label}\n"
        f"📅 {fmt_date(order.scheduled_at)}\n"
        f"💰 {fmt_price(order.total)} zł | {order.payment_method}\n\n"
        f"{item_lines}\n\n"
        f"{comment}"
    )

    for admin_id in settings.ADMIN_IDS:
        try:
            await callback.bot.send_message(admin_id, text, parse_mode="HTML")
        except Exception:
            pass

"""Admin: Order management — view new orders, change status, notify customer."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.filters.admin import IsAdmin
from bot.utils.formatters import fmt_date, fmt_price
from db.repositories.order import OrderRepository

router = Router(name="admin_orders")
router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())

ORDER_STATUSES = [
    ("new", "🆕 Новый"),
    ("confirmed", "✅ Подтверждён"),
    ("ready", "📦 Готов"),
    ("completed", "✔️ Выполнен"),
    ("cancelled", "❌ Отменён"),
]


@router.callback_query(F.data.startswith("adm:orders"))
async def cb_admin_orders(callback: CallbackQuery, session: AsyncSession) -> None:
    page = 0
    if ":" in callback.data and callback.data != "adm:orders":
        page = int(callback.data.split(":")[-1])

    repo = OrderRepository(session)
    orders = await repo.get_new_orders(page=page, page_size=8)

    if not orders:
        builder = InlineKeyboardBuilder()
        builder.row(InlineKeyboardButton(text="◀️ Назад", callback_data="adm:menu"))
        await callback.message.edit_text("📋 Нет новых заказов.", reply_markup=builder.as_markup())
        await callback.answer()
        return

    builder = InlineKeyboardBuilder()
    for o in orders:
        builder.row(
            InlineKeyboardButton(
                text=f"#{o.id} — {o.customer_name} — {fmt_price(o.total)} zł",
                callback_data=f"adm:order:{o.id}",
            )
        )

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(text="◀️", callback_data=f"adm:orders:{page - 1}"))
    if len(orders) == 8:
        nav.append(InlineKeyboardButton(text="▶️", callback_data=f"adm:orders:{page + 1}"))
    if nav:
        builder.row(*nav)
    builder.row(InlineKeyboardButton(text="◀️ Назад", callback_data="adm:menu"))

    await callback.message.edit_text(
        "📋 <b>Новые заказы:</b>",
        reply_markup=builder.as_markup(),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:order:") & ~F.data.startswith("adm:orders"))
async def cb_admin_order_detail(callback: CallbackQuery, session: AsyncSession) -> None:
    order_id = int(callback.data.split(":")[-1])
    repo = OrderRepository(session)
    order = await repo.get(order_id)

    if not order:
        await callback.answer("Заказ не найден.")
        return

    item_lines = []
    for item in order.items:
        name = item.variant.name_ru if item.variant else "?"
        item_lines.append(f"• {name} × {item.quantity} = {fmt_price(item.price_at_order * item.quantity)} zł")

    status_label = next((label for key, label in ORDER_STATUSES if key == order.status), order.status)
    text = (
        f"📋 <b>Заказ #{order.id}</b>\n"
        f"Статус: {status_label}\n\n"
        f"👤 {order.customer_name} | {order.customer_phone}\n"
        f"📧 {order.customer_email}\n"
        f"🚚 {order.delivery_type} | 📅 {fmt_date(order.scheduled_at)}\n"
        f"💳 {order.payment_method}\n\n"
        + "\n".join(item_lines) + "\n\n"
        f"💰 Итого: {fmt_price(order.total)} zł\n"
        + (f"💬 {order.comment}" if order.comment else "")
    )

    builder = InlineKeyboardBuilder()
    for key, label in ORDER_STATUSES:
        if key != order.status:
            builder.row(
                InlineKeyboardButton(
                    text=f"→ {label}",
                    callback_data=f"adm:setstatus:{order.id}:{key}",
                )
            )
    builder.row(InlineKeyboardButton(text="◀️ Заказы", callback_data="adm:orders"))

    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("adm:setstatus:"))
async def cb_set_order_status(callback: CallbackQuery, session: AsyncSession) -> None:
    parts = callback.data.split(":")
    order_id = int(parts[2])
    new_status = parts[3]

    repo = OrderRepository(session)
    order = await repo.set_status(order_id, new_status)

    if not order:
        await callback.answer("Заказ не найден.")
        return

    # Notify customer
    status_label = next((label for key, label in ORDER_STATUSES if key == new_status), new_status)
    try:
        from db.repositories.user import UserRepository
        from sqlalchemy import select
        from db.models.user import User

        if order.user_id:
            user_repo = UserRepository(session)
            from sqlalchemy.ext.asyncio import AsyncSession
            result = await session.execute(
                __import__("sqlalchemy", fromlist=["select"]).select(User).where(User.id == order.user_id)
            )
            user = result.scalar_one_or_none()
            if user:
                await callback.bot.send_message(
                    user.tg_id,
                    f"📋 <b>Статус заказа #{order.id} обновлён:</b>\n{status_label}",
                    parse_mode="HTML",
                )
    except Exception:
        pass

    await callback.answer(f"Статус → {status_label}")
    await cb_admin_order_detail(callback, session)

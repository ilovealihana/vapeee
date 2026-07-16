from __future__ import annotations

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.utils.formatters import fmt_price
from bot.utils.i18n import get_translator
from db.repositories.cart import CartRepository
from db.repositories.catalog import CatalogRepository
from db.repositories.user import UserRepository

router = Router(name="cart")


async def _get_locale(tg_id: int, session: AsyncSession) -> str:
    repo = UserRepository(session)
    user = await repo.get_by_tg_id(tg_id)
    return user.language if user else "ru"


async def _get_user(tg_id: int, session: AsyncSession):
    repo = UserRepository(session)
    return await repo.get_by_tg_id(tg_id)


# ─── Show cart ─────────────────────────────────────────────

@router.message(F.text.startswith("🛒"))
async def show_cart(message: Message, session: AsyncSession) -> None:
    user = await _get_user(message.from_user.id, session)
    if not user:
        await message.answer("/start")
        return

    locale = user.language
    t = get_translator(locale)

    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)

    if not cart or not cart.items:
        await message.answer(t("cart-empty"))
        return

    catalog = CatalogRepository(session)
    lines = [t("cart-header")]
    total = 0.0

    builder = InlineKeyboardBuilder()
    for item in cart.items:
        variant = item.variant
        if variant:
            product = await catalog.get_product(variant.product_id)
            price = float(variant.price_override or (product.base_price if product else 0))
        else:
            price = 0.0

        v_name = getattr(variant, f"name_{locale}", None) or variant.name_ru if variant else "?"
        subtotal = price * item.quantity
        total += subtotal
        lines.append(t("cart-line", name=v_name, qty=item.quantity, price=fmt_price(subtotal)))
        builder.row(
            InlineKeyboardButton(text=f"✖ {v_name}", callback_data=f"cart:rm:{item.id}"),
        )

    lines.append(t("cart-total", total=fmt_price(total)))

    builder.row(
        InlineKeyboardButton(text=t("btn-clear-cart"), callback_data="cart:clear"),
        InlineKeyboardButton(text=t("btn-checkout"), callback_data="cart:checkout"),
    )

    await message.answer("\n".join(lines), reply_markup=builder.as_markup(), parse_mode="HTML")


# ─── Remove item ──────────────────────────────────────────

@router.callback_query(F.data.startswith("cart:rm:"))
async def cb_remove_item(callback: CallbackQuery, session: AsyncSession) -> None:
    item_id = int(callback.data.split(":")[-1])
    user = await _get_user(callback.from_user.id, session)
    if not user:
        await callback.answer()
        return

    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    if cart:
        await cart_repo.remove_item(cart.id, item_id)

    await callback.answer("Удалено")
    # Refresh cart view
    await show_cart_from_callback(callback, session)


async def show_cart_from_callback(callback: CallbackQuery, session: AsyncSession) -> None:
    """Re-render the cart in the same message."""
    user = await _get_user(callback.from_user.id, session)
    if not user:
        return

    locale = user.language
    t = get_translator(locale)
    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)

    if not cart or not cart.items:
        await callback.message.edit_text(t("cart-empty"))
        return

    catalog = CatalogRepository(session)
    lines = [t("cart-header")]
    total = 0.0
    builder = InlineKeyboardBuilder()
    for item in cart.items:
        variant = item.variant
        product = await catalog.get_product(variant.product_id) if variant else None
        price = float(variant.price_override or (product.base_price if product else 0)) if variant else 0.0
        v_name = getattr(variant, f"name_{locale}", None) or variant.name_ru if variant else "?"
        subtotal = price * item.quantity
        total += subtotal
        lines.append(t("cart-line", name=v_name, qty=item.quantity, price=fmt_price(subtotal)))
        builder.row(InlineKeyboardButton(text=f"✖ {v_name}", callback_data=f"cart:rm:{item.id}"))

    lines.append(t("cart-total", total=fmt_price(total)))
    builder.row(
        InlineKeyboardButton(text=t("btn-clear-cart"), callback_data="cart:clear"),
        InlineKeyboardButton(text=t("btn-checkout"), callback_data="cart:checkout"),
    )
    await callback.message.edit_text("\n".join(lines), reply_markup=builder.as_markup(), parse_mode="HTML")


# ─── Clear cart ───────────────────────────────────────────

@router.callback_query(F.data == "cart:clear")
async def cb_clear_cart(callback: CallbackQuery, session: AsyncSession) -> None:
    user = await _get_user(callback.from_user.id, session)
    if not user:
        await callback.answer()
        return

    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    if cart:
        await cart_repo.clear(cart.id)

    locale = user.language
    t = get_translator(locale)
    await callback.message.edit_text(t("cart-cleared"))
    await callback.answer()


# ─── Quantity adjust (from catalog) ───────────────────────

@router.callback_query(F.data.startswith("qty:"))
async def cb_qty_adjust(callback: CallbackQuery, session: AsyncSession) -> None:
    # qty:{variant_id}:{delta}
    parts = callback.data.split(":")
    variant_id = int(parts[1])
    delta = int(parts[2])

    user = await _get_user(callback.from_user.id, session)
    if not user:
        await callback.answer()
        return

    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    if not cart:
        await callback.answer()
        return

    for item in cart.items:
        if item.variant_id == variant_id:
            new_qty = item.quantity + delta
            await cart_repo.set_item_quantity(cart.id, item.id, new_qty)
            break

    await callback.answer("✅")


# ─── Go to checkout ───────────────────────────────────────

@router.callback_query(F.data == "cart:checkout")
async def cb_checkout(callback: CallbackQuery, session: AsyncSession, state: FSMContext) -> None:
    """Delegates to order FSM — just sets the state entry point."""
    from bot.states.order import OrderFSM

    user = await _get_user(callback.from_user.id, session)
    if not user:
        await callback.answer()
        return

    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    if not cart or not cart.items:
        locale = user.language
        t = get_translator(locale)
        await callback.message.edit_text(t("cart-empty"))
        await callback.answer()
        return

    locale = user.language
    t = get_translator(locale)

    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text=t("btn-pickup-delivery"), callback_data="order:delivery:pickup"),
        InlineKeyboardButton(text=t("btn-inpost-delivery"), callback_data="order:delivery:inpost"),
    )

    await state.set_state(OrderFSM.SELECT_DELIVERY_TYPE)
    await callback.message.edit_text(t("choose-delivery-type"), reply_markup=builder.as_markup())
    await callback.answer()

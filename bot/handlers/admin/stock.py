"""Admin: Stock management per location+variant."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.filters.admin import IsAdmin
from bot.states.admin import AdminStockFSM
from db.repositories.catalog import CatalogRepository

router = Router(name="admin_stock")
router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())


@router.callback_query(F.data == "adm:stock")
async def cb_admin_stock(callback: CallbackQuery, session: AsyncSession) -> None:
    catalog = CatalogRepository(session)
    cities = await catalog.get_cities()

    builder = InlineKeyboardBuilder()
    for city in cities:
        for loc in city.locations:
            if loc.is_active:
                builder.row(
                    InlineKeyboardButton(
                        text=f"📍 {city.name} — {loc.name}",
                        callback_data=f"adm:stock:loc:{loc.id}",
                    )
                )
    builder.row(InlineKeyboardButton(text="◀️ Назад", callback_data="adm:menu"))

    await callback.message.edit_text(
        "📊 <b>Управление остатками</b>\nВыбери точку:",
        reply_markup=builder.as_markup(),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:stock:loc:"))
async def cb_stock_location(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    loc_id = int(callback.data.split(":")[-1])
    catalog = CatalogRepository(session)
    stock_items = await catalog.get_stock_for_location(loc_id)
    products = await catalog.get_products(page_size=100)

    # Build list of all variants
    builder = InlineKeyboardBuilder()
    for product in products:
        for variant in product.variants:
            current_qty = next(
                (s.quantity for s in stock_items if s.variant_id == variant.id), 0
            )
            builder.row(
                InlineKeyboardButton(
                    text=f"{product.name_ru} — {variant.name_ru}: {current_qty} шт.",
                    callback_data=f"adm:stock:set:{loc_id}:{variant.id}",
                )
            )
    builder.row(InlineKeyboardButton(text="◀️ Назад", callback_data="adm:stock"))

    await state.update_data(stock_location_id=loc_id)
    await callback.message.edit_text(
        "📦 Остатки по точке. Нажми на позицию чтобы изменить:",
        reply_markup=builder.as_markup(),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:stock:set:"))
async def cb_stock_set_start(callback: CallbackQuery, state: FSMContext) -> None:
    parts = callback.data.split(":")
    loc_id = int(parts[3])
    variant_id = int(parts[4])
    await state.update_data(stock_loc_id=loc_id, stock_variant_id=variant_id)
    await state.set_state(AdminStockFSM.ENTER_QUANTITY)
    await callback.message.edit_text("Введи новое количество (число):")
    await callback.answer()


@router.message(AdminStockFSM.ENTER_QUANTITY)
async def fsm_stock_qty(message: Message, state: FSMContext, session: AsyncSession) -> None:
    try:
        qty = int(message.text.strip())
    except ValueError:
        await message.answer("❌ Введи целое число:")
        return

    data = await state.get_data()
    catalog = CatalogRepository(session)
    await catalog.upsert_stock(
        location_id=data["stock_loc_id"],
        variant_id=data["stock_variant_id"],
        quantity=qty,
    )
    await state.clear()
    await message.answer(f"✅ Остаток обновлён: {qty} шт.")

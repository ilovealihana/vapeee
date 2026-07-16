"""Admin: Product & Variant CRUD."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message, PhotoSize
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.filters.admin import IsAdmin
from bot.states.admin import AdminProductFSM, AdminVariantFSM
from bot.utils.formatters import fmt_price
from db.repositories.catalog import CatalogRepository

router = Router(name="admin_products")
router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())


# ─── Product list ─────────────────────────────────────────

@router.callback_query(F.data == "adm:products")
async def cb_admin_products(callback: CallbackQuery, session: AsyncSession) -> None:
    catalog = CatalogRepository(session)
    products = await catalog.get_products(page_size=20)

    builder = InlineKeyboardBuilder()
    for p in products:
        status = "✅" if p.is_active else "❌"
        builder.row(
            InlineKeyboardButton(
                text=f"{status} {p.name_ru} — {fmt_price(p.base_price)} zł",
                callback_data=f"adm:prod:{p.id}",
            )
        )
    builder.row(InlineKeyboardButton(text="➕ Добавить товар", callback_data="adm:prod:add"))
    builder.row(InlineKeyboardButton(text="◀️ Назад", callback_data="adm:menu"))

    await callback.message.edit_text("📦 <b>Товары:</b>", reply_markup=builder.as_markup(), parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data == "adm:menu")
async def cb_admin_menu(callback: CallbackQuery) -> None:
    from bot.handlers.admin.menu import admin_main_kb
    await callback.message.edit_text(
        "🔧 <b>Панель администратора</b>",
        reply_markup=admin_main_kb().as_markup(),
        parse_mode="HTML",
    )
    await callback.answer()


# ─── Product detail ───────────────────────────────────────

@router.callback_query(F.data.startswith("adm:prod:") & ~F.data.in_({"adm:prod:add"}))
async def cb_admin_product_detail(callback: CallbackQuery, session: AsyncSession) -> None:
    prod_id = int(callback.data.split(":")[-1])
    catalog = CatalogRepository(session)
    product = await catalog.get_product(prod_id)
    if not product:
        await callback.answer("Не найден.")
        return

    status = "✅ Активен" if product.is_active else "❌ Скрыт"
    text = (
        f"📦 <b>{product.name_ru}</b>\n"
        f"Цена: {fmt_price(product.base_price)} zł\n"
        f"Статус: {status}\n"
        f"Вариантов: {len(product.variants)}"
    )

    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="🔄 Вкл/Выкл", callback_data=f"adm:prod:toggle:{prod_id}"))
    builder.row(InlineKeyboardButton(text="➕ Добавить вариант", callback_data=f"adm:variant:add:{prod_id}"))
    builder.row(InlineKeyboardButton(text="◀️ Назад", callback_data="adm:products"))

    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("adm:prod:toggle:"))
async def cb_toggle_product(callback: CallbackQuery, session: AsyncSession) -> None:
    prod_id = int(callback.data.split(":")[-1])
    catalog = CatalogRepository(session)
    product = await catalog.toggle_product(prod_id)
    status = "активирован ✅" if product and product.is_active else "скрыт ❌"
    await callback.answer(f"Товар {status}")
    await cb_admin_product_detail(callback, session)


# ─── Add product FSM ──────────────────────────────────────

@router.callback_query(F.data == "adm:prod:add")
async def cb_add_product_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(AdminProductFSM.ENTER_NAME_RU)
    await callback.message.edit_text("Введи название товара на <b>русском</b>:", parse_mode="HTML")
    await callback.answer()


@router.message(AdminProductFSM.ENTER_NAME_RU)
async def fsm_prod_name_ru(message: Message, state: FSMContext) -> None:
    await state.update_data(name_ru=message.text.strip())
    await state.set_state(AdminProductFSM.ENTER_NAME_PL)
    await message.answer("Введи название на <b>польском</b>:", parse_mode="HTML")


@router.message(AdminProductFSM.ENTER_NAME_PL)
async def fsm_prod_name_pl(message: Message, state: FSMContext) -> None:
    await state.update_data(name_pl=message.text.strip())
    await state.set_state(AdminProductFSM.ENTER_NAME_UK)
    await message.answer("Введи название на <b>украинском</b>:", parse_mode="HTML")


@router.message(AdminProductFSM.ENTER_NAME_UK)
async def fsm_prod_name_uk(message: Message, state: FSMContext) -> None:
    await state.update_data(name_uk=message.text.strip())
    await state.set_state(AdminProductFSM.ENTER_PRICE)
    await message.answer("Введи <b>базовую цену</b> (число, напр. 29.90):", parse_mode="HTML")


@router.message(AdminProductFSM.ENTER_PRICE)
async def fsm_prod_price(message: Message, state: FSMContext) -> None:
    try:
        price = float(message.text.strip().replace(",", "."))
    except ValueError:
        await message.answer("❌ Неверный формат цены. Введи число:")
        return
    await state.update_data(base_price=price)
    await state.set_state(AdminProductFSM.ENTER_DESCRIPTION_RU)
    await message.answer("Введи описание на русском (или /skip):")


@router.message(AdminProductFSM.ENTER_DESCRIPTION_RU)
async def fsm_prod_desc(message: Message, state: FSMContext) -> None:
    desc = None if message.text.strip().lower() in ("/skip", "skip") else message.text.strip()
    await state.update_data(description_ru=desc)
    await state.set_state(AdminProductFSM.ENTER_PHOTO)
    await message.answer("Отправь фото товара или /skip:")


@router.message(AdminProductFSM.ENTER_PHOTO, F.photo)
async def fsm_prod_photo(message: Message, state: FSMContext, session: AsyncSession) -> None:
    file_id = message.photo[-1].file_id
    await state.update_data(image_file_id=file_id)
    await _finalize_product(message, state, session)


@router.message(AdminProductFSM.ENTER_PHOTO, F.text)
async def fsm_prod_photo_skip(message: Message, state: FSMContext, session: AsyncSession) -> None:
    await state.update_data(image_file_id=None)
    await _finalize_product(message, state, session)


async def _finalize_product(message: Message, state: FSMContext, session: AsyncSession) -> None:
    data = await state.get_data()
    catalog = CatalogRepository(session)
    product = await catalog.create_product(
        name_ru=data.get("name_ru", ""),
        name_pl=data.get("name_pl", ""),
        name_uk=data.get("name_uk", ""),
        base_price=data.get("base_price", 0),
        description_ru=data.get("description_ru"),
        image_file_id=data.get("image_file_id"),
    )
    await state.clear()
    await message.answer(
        f"✅ Товар <b>{product.name_ru}</b> создан (ID: {product.id}).\n"
        f"Теперь добавь варианты (вкусы/цвета) через /admin → Товары → {product.name_ru}.",
        parse_mode="HTML",
    )


# ─── Add variant FSM ──────────────────────────────────────

@router.callback_query(F.data.startswith("adm:variant:add:"))
async def cb_add_variant_start(callback: CallbackQuery, state: FSMContext) -> None:
    prod_id = int(callback.data.split(":")[-1])
    await state.update_data(product_id=prod_id)
    await state.set_state(AdminVariantFSM.ENTER_NAME_RU)
    await callback.message.edit_text("Введи название варианта на <b>русском</b> (напр. Манго):", parse_mode="HTML")
    await callback.answer()


@router.message(AdminVariantFSM.ENTER_NAME_RU)
async def fsm_var_name_ru(message: Message, state: FSMContext) -> None:
    await state.update_data(v_name_ru=message.text.strip())
    await state.set_state(AdminVariantFSM.ENTER_NAME_PL)
    await message.answer("Название на <b>польском</b>:", parse_mode="HTML")


@router.message(AdminVariantFSM.ENTER_NAME_PL)
async def fsm_var_name_pl(message: Message, state: FSMContext) -> None:
    await state.update_data(v_name_pl=message.text.strip())
    await state.set_state(AdminVariantFSM.ENTER_NAME_UK)
    await message.answer("Название на <b>украинском</b>:", parse_mode="HTML")


@router.message(AdminVariantFSM.ENTER_NAME_UK)
async def fsm_var_name_uk(message: Message, state: FSMContext) -> None:
    await state.update_data(v_name_uk=message.text.strip())
    await state.set_state(AdminVariantFSM.ENTER_PRICE_OVERRIDE)
    await message.answer("Цена варианта (или /skip чтобы использовать цену товара):")


@router.message(AdminVariantFSM.ENTER_PRICE_OVERRIDE)
async def fsm_var_price(message: Message, state: FSMContext, session: AsyncSession) -> None:
    text = message.text.strip()
    price_override = None
    if text.lower() not in ("/skip", "skip"):
        try:
            price_override = float(text.replace(",", "."))
        except ValueError:
            await message.answer("❌ Неверный формат. Введи число или /skip:")
            return

    data = await state.get_data()
    catalog = CatalogRepository(session)
    variant = await catalog.create_variant(
        product_id=data["product_id"],
        name_ru=data["v_name_ru"],
        name_pl=data["v_name_pl"],
        name_uk=data["v_name_uk"],
        price_override=price_override,
    )
    await state.clear()
    await message.answer(f"✅ Вариант <b>{variant.name_ru}</b> добавлен!", parse_mode="HTML")

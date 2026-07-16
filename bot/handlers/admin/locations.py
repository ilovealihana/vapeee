"""Admin: City & Location CRUD."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.filters.admin import IsAdmin
from bot.states.admin import AdminCityFSM, AdminLocationFSM
from db.repositories.catalog import CatalogRepository

router = Router(name="admin_locations")
router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())


# ─── City list ────────────────────────────────────────────

@router.callback_query(F.data == "adm:locations")
async def cb_admin_locations(callback: CallbackQuery, session: AsyncSession) -> None:
    catalog = CatalogRepository(session)
    cities = await catalog.get_cities()

    builder = InlineKeyboardBuilder()
    for city in cities:
        builder.row(InlineKeyboardButton(text=f"🌆 {city.name}", callback_data=f"adm:city:{city.id}"))
    builder.row(InlineKeyboardButton(text="➕ Добавить город", callback_data="adm:city:add"))
    builder.row(InlineKeyboardButton(text="◀️ Назад", callback_data="adm:menu"))

    await callback.message.edit_text("🏙 <b>Города:</b>", reply_markup=builder.as_markup(), parse_mode="HTML")
    await callback.answer()


# ─── City detail → locations ──────────────────────────────

@router.callback_query(F.data.startswith("adm:city:") & ~F.data.in_({"adm:city:add"}))
async def cb_admin_city(callback: CallbackQuery, session: AsyncSession) -> None:
    city_id = int(callback.data.split(":")[-1])
    catalog = CatalogRepository(session)
    city = await catalog.get_city(city_id)
    locations = await catalog.get_locations_for_city(city_id)

    builder = InlineKeyboardBuilder()
    for loc in locations:
        status = "✅" if loc.is_active else "❌"
        builder.row(
            InlineKeyboardButton(
                text=f"{status} {loc.name}",
                callback_data=f"adm:loc:{loc.id}",
            )
        )
    builder.row(InlineKeyboardButton(text="➕ Добавить точку", callback_data=f"adm:loc:add:{city_id}"))
    builder.row(InlineKeyboardButton(text="◀️ Города", callback_data="adm:locations"))

    await callback.message.edit_text(
        f"🏪 Точки города <b>{city.name if city else '?'}</b>:",
        reply_markup=builder.as_markup(),
        parse_mode="HTML",
    )
    await callback.answer()


# ─── Add city FSM ─────────────────────────────────────────

@router.callback_query(F.data == "adm:city:add")
async def cb_add_city_start(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(AdminCityFSM.ENTER_NAME)
    await callback.message.edit_text("Введи <b>название города</b> (напр. Wrocław):", parse_mode="HTML")
    await callback.answer()


@router.message(AdminCityFSM.ENTER_NAME)
async def fsm_city_name(message: Message, state: FSMContext) -> None:
    await state.update_data(city_name=message.text.strip())
    await state.set_state(AdminCityFSM.ENTER_SLUG)
    await message.answer("Введи <b>slug</b> (латиница, без пробелов, напр. wroclaw):", parse_mode="HTML")


@router.message(AdminCityFSM.ENTER_SLUG)
async def fsm_city_slug(message: Message, state: FSMContext, session: AsyncSession) -> None:
    slug = message.text.strip().lower().replace(" ", "-")
    data = await state.get_data()
    catalog = CatalogRepository(session)
    city = await catalog.create_city(name=data["city_name"], slug=slug)
    await state.clear()
    await message.answer(f"✅ Город <b>{city.name}</b> создан!", parse_mode="HTML")


# ─── Add location FSM ─────────────────────────────────────

@router.callback_query(F.data.startswith("adm:loc:add:"))
async def cb_add_loc_start(callback: CallbackQuery, state: FSMContext) -> None:
    city_id = int(callback.data.split(":")[-1])
    await state.update_data(city_id=city_id)
    await state.set_state(AdminLocationFSM.ENTER_NAME)
    await callback.message.edit_text("Введи <b>название точки</b>:", parse_mode="HTML")
    await callback.answer()


@router.message(AdminLocationFSM.ENTER_NAME)
async def fsm_loc_name(message: Message, state: FSMContext) -> None:
    await state.update_data(loc_name=message.text.strip())
    await state.set_state(AdminLocationFSM.ENTER_ADDRESS)
    await message.answer("Введи <b>адрес</b>:", parse_mode="HTML")


@router.message(AdminLocationFSM.ENTER_ADDRESS)
async def fsm_loc_address(message: Message, state: FSMContext) -> None:
    await state.update_data(loc_address=message.text.strip())
    await state.set_state(AdminLocationFSM.ENTER_DESCRIPTION)
    await message.answer("Описание точки (или /skip):")


@router.message(AdminLocationFSM.ENTER_DESCRIPTION)
async def fsm_loc_desc(message: Message, state: FSMContext) -> None:
    desc = None if message.text.strip().lower() in ("/skip", "skip") else message.text.strip()
    await state.update_data(loc_description=desc)
    await state.set_state(AdminLocationFSM.ENTER_CURATOR)
    await message.answer("Telegram username куратора без @ (или /skip):")


@router.message(AdminLocationFSM.ENTER_CURATOR)
async def fsm_loc_curator(message: Message, state: FSMContext, session: AsyncSession) -> None:
    curator = None if message.text.strip().lower() in ("/skip", "skip") else message.text.strip().lstrip("@")
    data = await state.get_data()
    catalog = CatalogRepository(session)
    location = await catalog.create_location(
        city_id=data["city_id"],
        name=data["loc_name"],
        address=data["loc_address"],
        description=data.get("loc_description"),
        curator_tg_username=curator,
    )
    await state.clear()
    await message.answer(f"✅ Точка <b>{location.name}</b> создана!", parse_mode="HTML")

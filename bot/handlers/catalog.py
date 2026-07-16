"""
Catalog flow:
  Main menu btn → City list → Location list → Location info popup
  → Product listing (paginated) → Product card → Variant picker → Add to cart
  Also handles InPost mode (no location).
"""
from __future__ import annotations

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from bot.utils.formatters import fmt_date, fmt_price
from bot.utils.i18n import get_translator
from db.repositories.cart import CartRepository
from db.repositories.catalog import CatalogRepository
from db.repositories.user import UserRepository

router = Router(name="catalog")

PAGE_SIZE = 5


def _get_locale(user) -> str:
    return user.language if user else "ru"


async def _get_user_and_locale(tg_id: int, session: AsyncSession):
    repo = UserRepository(session)
    user = await repo.get_by_tg_id(tg_id)
    return user, _get_locale(user)


# ─── Main menu triggers ────────────────────────────────────

@router.message(F.text.in_({"🏪 Самовывоз", "🏪 Odbiór osobisty", "🏪 Самовивіз"}))
async def show_cities(message: Message, session: AsyncSession) -> None:
    user, locale = await _get_user_and_locale(message.from_user.id, session)
    t = get_translator(locale)

    catalog = CatalogRepository(session)
    cities = await catalog.get_cities()

    if not cities:
        await message.answer("Нет доступных городов.")
        return

    builder = InlineKeyboardBuilder()
    for city in cities:
        builder.row(InlineKeyboardButton(text=city.name, callback_data=f"city:{city.id}"))

    await message.answer(t("choose-city"), reply_markup=builder.as_markup())


@router.message(F.text.in_({"🛍 Каталог", "🛍 Katalog", "🛍 Каталог"}))
async def show_catalog_inpost(message: Message, session: AsyncSession) -> None:
    """Direct catalog entry — InPost mode, no location."""
    user, locale = await _get_user_and_locale(message.from_user.id, session)
    t = get_translator(locale)

    catalog = CatalogRepository(session)
    categories = await catalog.get_categories()

    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text=t("btn-all-products"), callback_data="cat:0:0:inpost"))
    for cat in categories:
        name = getattr(cat, f"name_{locale}", None) or cat.name_ru
        builder.row(InlineKeyboardButton(text=name, callback_data=f"cat:{cat.id}:0:inpost"))

    await message.answer(t("choose-category"), reply_markup=builder.as_markup())


@router.message(F.text.in_({"📦 InPost доставка", "📦 Dostawa InPost", "📦 Доставка InPost"}))
async def show_inpost_entry(message: Message, session: AsyncSession) -> None:
    await show_catalog_inpost(message, session)


# ─── City → Locations ─────────────────────────────────────

@router.callback_query(F.data.startswith("city:"))
async def cb_city(callback: CallbackQuery, session: AsyncSession) -> None:
    city_id = int(callback.data.split(":")[1])
    user, locale = await _get_user_and_locale(callback.from_user.id, session)
    t = get_translator(locale)

    catalog = CatalogRepository(session)
    city = await catalog.get_city(city_id)
    locations = await catalog.get_locations_for_city(city_id)

    builder = InlineKeyboardBuilder()
    for loc in locations:
        builder.row(InlineKeyboardButton(text=f"🏪 {loc.name}", callback_data=f"loc:{loc.id}"))

    if city and city.manager_tg_id:
        builder.row(
            InlineKeyboardButton(
                text=t("btn-contact-manager"),
                url=f"tg://user?id={city.manager_tg_id}",
            )
        )

    city_name = city.name if city else "?"
    await callback.message.edit_text(
        t("choose-location", city=city_name),
        reply_markup=builder.as_markup(),
        parse_mode="HTML",
    )
    await callback.answer()


# ─── Location info popup ───────────────────────────────────

@router.callback_query(F.data.startswith("loc:"))
async def cb_location(callback: CallbackQuery, session: AsyncSession) -> None:
    loc_id = int(callback.data.split(":")[1])
    user, locale = await _get_user_and_locale(callback.from_user.id, session)
    t = get_translator(locale)

    catalog = CatalogRepository(session)
    location = await catalog.get_location(loc_id)
    if not location:
        await callback.answer("Точка не найдена.")
        return

    summary = await catalog.get_location_stock_summary(loc_id)
    last_sold = fmt_date(summary["last_sold"]) if summary["last_sold"] else t("btn-never")

    text = t(
        "location-info",
        name=location.name,
        address=location.address,
        description=location.description or "",
        stock=summary["total_qty"],
        last_sold=last_sold,
    )

    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(
            text=t("btn-browse-products"),
            callback_data=f"loc_products:{loc_id}:0:0",
        )
    )
    if location.curator_tg_username:
        builder.row(
            InlineKeyboardButton(
                text=t("btn-contact-curator"),
                url=f"https://t.me/{location.curator_tg_username}",
            )
        )

    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="HTML")
    await callback.answer()


# ─── Product listing (location-based) ─────────────────────

@router.callback_query(F.data.startswith("loc_products:"))
async def cb_loc_products(callback: CallbackQuery, session: AsyncSession) -> None:
    # loc_products:{loc_id}:{cat_id}:{page}
    parts = callback.data.split(":")
    loc_id = int(parts[1])
    cat_id = int(parts[2]) or None
    page = int(parts[3])

    user, locale = await _get_user_and_locale(callback.from_user.id, session)
    t = get_translator(locale)

    catalog = CatalogRepository(session)
    products = await catalog.get_products(category_id=cat_id, page=page, page_size=PAGE_SIZE)
    total = await catalog.count_products(category_id=cat_id)
    total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)

    if not products:
        await callback.message.edit_text("Товары не найдены.")
        await callback.answer()
        return

    # Category filter row
    categories = await catalog.get_categories()
    builder = InlineKeyboardBuilder()

    builder.row(
        InlineKeyboardButton(text=t("btn-all-products"), callback_data=f"loc_products:{loc_id}:0:{page}")
    )
    for cat in categories:
        name = getattr(cat, f"name_{locale}", None) or cat.name_ru
        builder.row(InlineKeyboardButton(text=name, callback_data=f"loc_products:{loc_id}:{cat.id}:{page}"))

    # Product buttons
    for prod in products:
        name = getattr(prod, f"name_{locale}", None) or prod.name_ru
        builder.row(
            InlineKeyboardButton(
                text=f"{name} — {fmt_price(prod.base_price)} zł",
                callback_data=f"prod:{prod.id}:{loc_id}",
            )
        )

    # Pagination
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(text=t("btn-prev"), callback_data=f"loc_products:{loc_id}:{cat_id or 0}:{page - 1}"))
    if page + 1 < total_pages:
        nav.append(InlineKeyboardButton(text=t("btn-next"), callback_data=f"loc_products:{loc_id}:{cat_id or 0}:{page + 1}"))
    if nav:
        builder.row(*nav)

    await callback.message.edit_text(
        t("page-nav", page=page + 1, total=total_pages),
        reply_markup=builder.as_markup(),
    )
    await callback.answer()


# ─── Product listing (InPost / no location) ───────────────

@router.callback_query(F.data.startswith("cat:"))
async def cb_cat_products(callback: CallbackQuery, session: AsyncSession) -> None:
    # cat:{cat_id}:{page}:inpost
    parts = callback.data.split(":")
    cat_id = int(parts[1]) or None
    page = int(parts[2])

    user, locale = await _get_user_and_locale(callback.from_user.id, session)
    t = get_translator(locale)

    catalog = CatalogRepository(session)
    products = await catalog.get_products(category_id=cat_id, page=page, page_size=PAGE_SIZE)
    total = await catalog.count_products(category_id=cat_id)
    total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)

    if not products:
        await callback.message.edit_text("Товары не найдены.")
        await callback.answer()
        return

    categories = await catalog.get_categories()
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text=t("btn-all-products"), callback_data=f"cat:0:{page}:inpost"))
    for cat in categories:
        name = getattr(cat, f"name_{locale}", None) or cat.name_ru
        builder.row(InlineKeyboardButton(text=name, callback_data=f"cat:{cat.id}:{page}:inpost"))

    for prod in products:
        name = getattr(prod, f"name_{locale}", None) or prod.name_ru
        builder.row(
            InlineKeyboardButton(
                text=f"{name} — {fmt_price(prod.base_price)} zł",
                callback_data=f"prod:{prod.id}:inpost",
            )
        )

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(text=t("btn-prev"), callback_data=f"cat:{cat_id or 0}:{page - 1}:inpost"))
    if page + 1 < total_pages:
        nav.append(InlineKeyboardButton(text=t("btn-next"), callback_data=f"cat:{cat_id or 0}:{page + 1}:inpost"))
    if nav:
        builder.row(*nav)

    await callback.message.edit_text(
        t("page-nav", page=page + 1, total=total_pages),
        reply_markup=builder.as_markup(),
    )
    await callback.answer()


# ─── Product card ──────────────────────────────────────────

@router.callback_query(F.data.startswith("prod:"))
async def cb_product_card(callback: CallbackQuery, session: AsyncSession) -> None:
    # prod:{product_id}:{loc_id|inpost}
    parts = callback.data.split(":")
    product_id = int(parts[1])
    loc_context = parts[2]  # numeric loc_id or "inpost"

    user, locale = await _get_user_and_locale(callback.from_user.id, session)
    t = get_translator(locale)

    catalog = CatalogRepository(session)
    product = await catalog.get_product(product_id)
    if not product:
        await callback.answer("Товар не найден.")
        return

    name = getattr(product, f"name_{locale}", None) or product.name_ru
    desc = getattr(product, f"description_{locale}", None) or product.description_ru or ""

    text = t("product-card", name=name, description=desc, price=fmt_price(product.base_price))

    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text=t("choose-variant"), callback_data="noop"))
    for variant in product.variants:
        v_name = getattr(variant, f"name_{locale}", None) or variant.name_ru
        price = variant.price_override or product.base_price
        builder.row(
            InlineKeyboardButton(
                text=f"{v_name} — {fmt_price(price)} zł",
                callback_data=f"variant:{variant.id}:{loc_context}",
            )
        )

    if product.image_file_id:
        try:
            await callback.message.answer_photo(
                photo=product.image_file_id,
                caption=text,
                reply_markup=builder.as_markup(),
                parse_mode="HTML",
            )
            await callback.answer()
            return
        except Exception:
            pass

    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="HTML")
    await callback.answer()


# ─── Variant selected → Add to cart ───────────────────────

@router.callback_query(F.data.startswith("variant:"))
async def cb_variant_add(callback: CallbackQuery, session: AsyncSession) -> None:
    # variant:{variant_id}:{loc_context}
    parts = callback.data.split(":")
    variant_id = int(parts[1])
    loc_context = parts[2]

    user, locale = await _get_user_and_locale(callback.from_user.id, session)
    if not user:
        await callback.answer("Нажми /start")
        return

    t = get_translator(locale)
    catalog = CatalogRepository(session)
    variant = await catalog.get_variant(variant_id)
    if not variant:
        await callback.answer("Вариант не найден.")
        return

    location_id = int(loc_context) if loc_context != "inpost" else None

    cart_repo = CartRepository(session)
    cart = await cart_repo.get_or_create(user.id, location_id)

    # If switching from location to inpost or vice versa, update location
    if cart.location_id != location_id:
        await cart_repo.set_location(cart, location_id)

    await cart_repo.add_item(cart, variant_id, quantity=1)

    v_name = getattr(variant, f"name_{locale}", None) or variant.name_ru

    # Quantity adjust buttons
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="➖", callback_data=f"qty:{variant_id}:-1"),
        InlineKeyboardButton(text="1", callback_data="noop"),
        InlineKeyboardButton(text="➕", callback_data=f"qty:{variant_id}:+1"),
    )

    await callback.message.answer(
        t("added-to-cart", name=v_name),
        reply_markup=builder.as_markup(),
    )
    await callback.answer()


@router.callback_query(F.data == "noop")
async def cb_noop(callback: CallbackQuery) -> None:
    await callback.answer()

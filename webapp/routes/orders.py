"""Order creation and history routes."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models.location_stock import LocationStock
from db.repositories.cart import CartRepository
from db.repositories.catalog import CatalogRepository
from db.repositories.order import OrderRepository
from db.repositories.user import UserRepository
from sqlalchemy import select
from webapp.auth import verify_init_data
from webapp.deps import get_session
from webapp.schemas import CreateOrderRequest, OrderSchema

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _get_user(authorization: str, session: AsyncSession):
    init_data = authorization[4:] if authorization.startswith("tma ") else authorization
    user_data = verify_init_data(init_data)
    repo = UserRepository(session)
    return await repo.upsert(
        tg_id=user_data["id"],
        first_name=user_data.get("first_name", ""),
        last_name=user_data.get("last_name"),
        username=user_data.get("username"),
    )


@router.get("", response_model=list[OrderSchema])
async def get_orders(
    page: int = 0,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    repo = OrderRepository(session)
    orders = await repo.get_user_orders(user.id, page=page, page_size=10)
    return [OrderSchema.model_validate(o) for o in orders]


@router.post("", response_model=OrderSchema)
async def create_order(
    body: CreateOrderRequest,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)

    # Get cart
    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Calculate totals
    catalog = CatalogRepository(session)
    order_items = []
    products_total = Decimal("0")

    for item in cart.items:
        variant = item.variant
        product = await catalog.get_product(variant.product_id) if variant else None
        price = Decimal(str(variant.price_override or (product.base_price if product else 0))) if variant else Decimal("0")
        subtotal = price * item.quantity
        products_total += subtotal
        order_items.append({
            "variant_id": item.variant_id,
            "quantity": item.quantity,
            "price_at_order": price,
        })

    delivery_cost = Decimal(str(settings.INPOST_DELIVERY_COST)) if body.delivery_type == "inpost" else Decimal("0")
    total = products_total + delivery_cost

    # Parse scheduled datetime
    try:
        scheduled_at = datetime.strptime(
            f"{body.scheduled_date} {body.scheduled_time}", "%Y-%m-%d %H:%M"
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        scheduled_at = None

    # Create order
    order_repo = OrderRepository(session)
    order = await order_repo.create(
        user_id=user.id,
        delivery_type=body.delivery_type,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_email=body.customer_email,
        products_total=products_total,
        delivery_cost=delivery_cost,
        total=total,
        payment_method=body.payment_method,
        location_id=body.location_id or (cart.location_id if cart else None),
        delivery_address=body.delivery_address,
        scheduled_at=scheduled_at,
        comment=body.comment,
    )
    await order_repo.add_items(order.id, order_items)

    # Deduct stock for pickup orders
    if body.delivery_type == "pickup" and cart.location_id:
        for item in cart.items:
            if item.variant_id:
                result = await session.execute(
                    select(LocationStock).where(
                        LocationStock.location_id == cart.location_id,
                        LocationStock.variant_id == item.variant_id,
                    )
                )
                stock = result.scalar_one_or_none()
                if stock:
                    stock.quantity = max(0, stock.quantity - item.quantity)
                    stock.last_sold_at = datetime.now(tz=timezone.utc)
        await session.commit()

    # Clear cart
    await cart_repo.clear(cart.id)

    # Notify admins via bot
    await _notify_admins(order, order_items, body, catalog, session)

    # Reload full order
    full_order = await order_repo.get(order.id)
    return OrderSchema.model_validate(full_order)


async def _notify_admins(order, items, body: CreateOrderRequest, catalog, session):
    """Send new order notification to all admin IDs."""
    try:
        from aiogram import Bot
        from aiogram.client.default import DefaultBotProperties
        from aiogram.enums import ParseMode

        bot = Bot(
            token=settings.BOT_TOKEN,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML),
        )

        item_lines = []
        for item in items:
            variant = await catalog.get_variant(item["variant_id"]) if item["variant_id"] else None
            name = variant.name_ru if variant else "?"
            item_lines.append(f"• {name} × {item['quantity']} = {float(item['price_at_order'] * item['quantity']):.2f} zł")

        delivery_label = "InPost доставка" if body.delivery_type == "inpost" else "Самовывоз"
        comment = f"💬 {body.comment}" if body.comment else ""
        items_text = "\n".join(item_lines)

        text = (
            f"🆕 <b>Новый заказ #{order.id}</b> (Mini App)\n\n"
            f"👤 {body.customer_name} | {body.customer_phone}\n"
            f"📧 {body.customer_email}\n"
            f"🚚 {delivery_label}\n"
            f"📅 {body.scheduled_date} {body.scheduled_time}\n"
            f"💰 {float(order.total):.2f} zł | {body.payment_method}\n\n"
            f"{items_text}\n\n"
            f"{comment}"
        )

        for admin_id in settings.ADMIN_IDS:
            try:
                await bot.send_message(admin_id, text, parse_mode="HTML")
            except Exception:
                pass

        await bot.session.close()
    except Exception:
        pass  # Don't fail order creation if notification fails

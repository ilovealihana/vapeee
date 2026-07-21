"""Order creation and history routes."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models.location_stock import LocationStock
from db.models.user import User
from db.repositories.cart import CartRepository
from db.repositories.catalog import CatalogRepository
from db.repositories.order import OrderRepository
from sqlalchemy import select
from webapp.deps import get_current_user, get_session
from webapp.errors import ErrorCode, api_error
from webapp.schemas import CreateOrderRequest, OrderSchema
from webapp.services.notifications import TelegramNotificationSender

router = APIRouter(prefix="/api/orders", tags=["orders"])
logger = logging.getLogger(__name__)
ALLOWED_DELIVERY_TYPES = {"pickup", "door_delivery", "inpost"}
ALLOWED_PAYMENT_METHODS = {"cash", "blik", "monobank"}


def delivery_cost_for_type(delivery_type: str, fixed_delivery_cost: Decimal) -> Decimal:
    if delivery_type == "door_delivery":
        return fixed_delivery_cost
    return Decimal("0")


def should_deduct_stock(delivery_type: str) -> bool:
    return delivery_type in {"pickup", "door_delivery"}


def _parse_schedule(scheduled_date: str, scheduled_time: str) -> datetime:
    try:
        scheduled_at = datetime.strptime(
            f"{scheduled_date} {scheduled_time}", "%Y-%m-%d %H:%M"
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        raise api_error(422, ErrorCode.ORDER_INVALID_SCHEDULE, "Invalid schedule")
    if scheduled_at <= datetime.now(tz=timezone.utc):
        raise api_error(422, ErrorCode.ORDER_INVALID_SCHEDULE, "Invalid schedule")
    return scheduled_at


async def _validate_location_stock(
    cart_items,
    location_id: int,
    session: AsyncSession,
) -> None:
    for item in cart_items:
        if not item.variant_id:
            continue
        result = await session.execute(
            select(LocationStock).where(
                LocationStock.location_id == location_id,
                LocationStock.variant_id == item.variant_id,
            )
        )
        stock = result.scalar_one_or_none()
        if not stock or stock.quantity < item.quantity:
            raise api_error(
                400,
                ErrorCode.ORDER_INSUFFICIENT_STOCK,
                "Insufficient stock",
                {"available": stock.quantity if stock else 0, "requested": item.quantity},
            )


async def _validate_order_location_available(
    catalog: CatalogRepository,
    location_id: int,
) -> None:
    location = await catalog.get_location(location_id)
    city = getattr(location, "city", None) if location else None
    if (
        not location
        or not location.is_active
        or not city
        or not getattr(city, "is_active", False)
        or not await catalog.get_location_point_manager(location_id)
    ):
        raise api_error(400, ErrorCode.ORDER_INSUFFICIENT_STOCK, "Insufficient stock")


@router.get("", response_model=list[OrderSchema])
async def get_orders(
    page: int = 0,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = OrderRepository(session)
    orders = await repo.get_user_orders(user.id, page=page, page_size=10)
    return [OrderSchema.model_validate(o) for o in orders]


@router.post("", response_model=OrderSchema)
async def create_order(
    body: CreateOrderRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if body.delivery_type not in ALLOWED_DELIVERY_TYPES:
        raise api_error(422, ErrorCode.ORDER_INVALID_DELIVERY_TYPE, "Invalid delivery type")
    if body.payment_method not in ALLOWED_PAYMENT_METHODS:
        raise api_error(422, ErrorCode.ORDER_INVALID_PAYMENT_METHOD, "Invalid payment method")
    scheduled_at = _parse_schedule(body.scheduled_date, body.scheduled_time)

    # Get cart
    cart_repo = CartRepository(session)
    cart = await cart_repo.get_by_user_id(user.id)
    if not cart or not cart.items:
        raise api_error(400, ErrorCode.ORDER_CART_EMPTY, "Cart is empty")

    # Calculate totals
    catalog = CatalogRepository(session)
    order_items = []
    products_total = Decimal("0")

    for item in cart.items:
        variant = item.variant
        product = await catalog.get_product(variant.product_id) if variant else None
        if not variant or not product or not product.is_active:
            raise api_error(400, ErrorCode.ORDER_INSUFFICIENT_STOCK, "Insufficient stock")
        price = Decimal(str(variant.price_override or (product.base_price if product else 0))) if variant else Decimal("0")
        subtotal = price * item.quantity
        products_total += subtotal
        order_items.append({
            "variant_id": item.variant_id,
            "quantity": item.quantity,
            "price_at_order": price,
        })

    delivery_cost = delivery_cost_for_type(
        body.delivery_type,
        Decimal(str(settings.INPOST_DELIVERY_COST)),
    )
    total = products_total + delivery_cost
    order_location_id = body.location_id or (cart.location_id if cart else None)

    if should_deduct_stock(body.delivery_type) and not order_location_id:
        raise api_error(400, ErrorCode.ORDER_LOCATION_REQUIRED, "Location is required")

    if should_deduct_stock(body.delivery_type) and order_location_id:
        await _validate_order_location_available(catalog, order_location_id)
        await _validate_location_stock(cart.items, order_location_id, session)

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
        location_id=order_location_id,
        delivery_address=body.delivery_address,
        scheduled_at=scheduled_at,
        comment=body.comment,
    )
    await order_repo.add_items(order.id, order_items)

    # Deduct stock for orders fulfilled from a selected location.
    if should_deduct_stock(body.delivery_type) and order_location_id:
        for item in cart.items:
            if item.variant_id:
                result = await session.execute(
                    select(LocationStock).where(
                        LocationStock.location_id == order_location_id,
                        LocationStock.variant_id == item.variant_id,
                    )
                )
                stock = result.scalar_one_or_none()
                if stock:
                    stock.quantity -= item.quantity
                    stock.last_sold_at = datetime.now(tz=timezone.utc)
        await session.commit()

    # Clear cart
    await cart_repo.clear(cart.id)

    # Notify admins through the backend notification sender.
    await _notify_admins(order, order_items, body, catalog, session)

    # Reload full order
    full_order = await order_repo.get(order.id)
    return OrderSchema.model_validate(full_order)


async def _notify_admins(order, items, body: CreateOrderRequest, catalog, session):
    """Send new order notification to all admin IDs."""
    try:
        sender = TelegramNotificationSender(
            bot_token=settings.BOT_TOKEN,
            webapp_url=settings.WEBAPP_URL,
        )

        item_lines = []
        for item in items:
            variant = await catalog.get_variant(item["variant_id"]) if item["variant_id"] else None
            name = variant.name_ru if variant else "?"
            item_lines.append(f"• {name} × {item['quantity']} = {float(item['price_at_order'] * item['quantity']):.2f} zł")

        delivery_label = {
            "pickup": "Самовывоз",
            "door_delivery": "Доставка к двери",
        }.get(body.delivery_type, body.delivery_type)
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
            await sender.send_message(admin_id, text, parse_mode="HTML")
    except Exception:
        logger.exception("Failed to build or send order notification")

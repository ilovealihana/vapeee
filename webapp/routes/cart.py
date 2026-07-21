"""Cart routes."""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.location_stock import LocationStock
from db.repositories.cart import CartRepository
from db.repositories.catalog import CatalogRepository
from db.models.user import User
from webapp.deps import get_current_user, get_session
from webapp.errors import ErrorCode, api_error
from webapp.schemas import (
    AddCartItemRequest,
    CartItemSchema,
    CartSchema,
    UpdateCartItemRequest,
    VariantSchema,
    ProductSchema,
)

router = APIRouter(prefix="/api/cart", tags=["cart"])


async def _validate_add_item_available(
    body: AddCartItemRequest,
    requested_total_quantity: int,
    catalog: CatalogRepository,
    session: AsyncSession,
) -> None:
    variant = await catalog.get_variant(body.variant_id)
    if not variant:
        raise api_error(400, ErrorCode.CART_VARIANT_UNAVAILABLE, "Variant unavailable")

    product = await catalog.get_product(variant.product_id)
    if not product or not product.is_active:
        raise api_error(400, ErrorCode.CART_VARIANT_UNAVAILABLE, "Variant unavailable")

    if body.location_id is None:
        return

    location = await catalog.get_location(body.location_id)
    city = getattr(location, "city", None) if location else None
    if (
        not location
        or not location.is_active
        or not city
        or not getattr(city, "is_active", False)
    ):
        raise api_error(400, ErrorCode.CART_VARIANT_UNAVAILABLE, "Variant unavailable")

    result = await session.execute(
        select(LocationStock).where(
            LocationStock.location_id == body.location_id,
            LocationStock.variant_id == body.variant_id,
        )
    )
    stock = result.scalar_one_or_none()
    if not stock or stock.quantity < requested_total_quantity:
        raise api_error(
            400,
            ErrorCode.CART_INSUFFICIENT_STOCK,
            "Insufficient stock",
            {"available": stock.quantity if stock else 0, "requested": requested_total_quantity},
        )


async def _build_cart_schema(cart, session: AsyncSession) -> CartSchema:
    catalog = CatalogRepository(session)
    items = []
    total = Decimal("0")
    for item in cart.items:
        variant = item.variant
        product = await catalog.get_product(variant.product_id) if variant else None
        price = Decimal(str(variant.price_override or (product.base_price if product else 0))) if variant else Decimal("0")
        subtotal = price * item.quantity
        total += subtotal
        items.append(CartItemSchema(
            id=item.id,
            variant_id=item.variant_id,
            quantity=item.quantity,
            variant=VariantSchema.model_validate(variant) if variant else None,
            product=ProductSchema.model_validate(product) if product else None,
            price=price,
            subtotal=subtotal,
        ))
    return CartSchema(
        id=cart.id,
        user_id=cart.user_id,
        location_id=cart.location_id,
        items=items,
        total=total,
    )


@router.get("", response_model=CartSchema)
async def get_cart(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = CartRepository(session)
    cart = await repo.get_by_user_id(user.id)
    if not cart:
        # Return empty cart
        return CartSchema(id=0, user_id=user.id, location_id=None, items=[], total=Decimal("0"))
    return await _build_cart_schema(cart, session)


@router.post("/items", response_model=CartSchema)
async def add_item(
    body: AddCartItemRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user_id = user.id
    if body.quantity <= 0:
        raise api_error(422, ErrorCode.CART_INVALID_QUANTITY, "Invalid quantity")
    repo = CartRepository(session)
    existing_cart = await repo.get_by_user_id(user_id)
    existing_quantity = sum(
        item.quantity for item in existing_cart.items if item.variant_id == body.variant_id
    ) if existing_cart else 0
    catalog = CatalogRepository(session)
    await _validate_add_item_available(body, existing_quantity + body.quantity, catalog, session)
    cart = await repo.get_or_create(user_id, body.location_id)

    # Update location if switching
    if cart.location_id != body.location_id:
        await repo.set_location(cart, body.location_id)

    await repo.add_item(cart, body.variant_id, body.quantity)

    # Reload
    session.expire_all()
    cart = await repo.get_by_user_id(user_id)
    return await _build_cart_schema(cart, session)


@router.patch("/items/{item_id}", response_model=CartSchema)
async def update_item(
    item_id: int,
    body: UpdateCartItemRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user_id = user.id
    if body.quantity <= 0:
        raise api_error(422, ErrorCode.CART_INVALID_QUANTITY, "Invalid quantity")
    repo = CartRepository(session)
    cart = await repo.get_by_user_id(user_id)
    if not cart:
        raise api_error(404, ErrorCode.CART_ITEM_NOT_FOUND, "Cart item not found")
    item = await repo.get_item(cart.id, item_id)
    if not item:
        raise api_error(404, ErrorCode.CART_ITEM_NOT_FOUND, "Cart item not found")

    catalog = CatalogRepository(session)
    await _validate_add_item_available(
        AddCartItemRequest(
            variant_id=item.variant_id,
            quantity=body.quantity,
            location_id=cart.location_id,
        ),
        body.quantity,
        catalog,
        session,
    )

    await repo.set_item_quantity(cart.id, item_id, body.quantity)
    session.expire_all()
    cart = await repo.get_by_user_id(user_id)
    return await _build_cart_schema(cart, session)


@router.delete("/items/{item_id}", response_model=CartSchema)
async def remove_item(
    item_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user_id = user.id
    repo = CartRepository(session)
    cart = await repo.get_by_user_id(user_id)
    if not cart:
        raise api_error(404, ErrorCode.CART_ITEM_NOT_FOUND, "Cart item not found")
    item = await repo.get_item(cart.id, item_id)
    if not item:
        raise api_error(404, ErrorCode.CART_ITEM_NOT_FOUND, "Cart item not found")

    await repo.remove_item(cart.id, item_id)
    session.expire_all()
    cart = await repo.get_by_user_id(user_id)
    return await _build_cart_schema(cart, session)


@router.delete("", status_code=204)
async def clear_cart(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = CartRepository(session)
    cart = await repo.get_by_user_id(user.id)
    if cart:
        await repo.clear(cart.id)

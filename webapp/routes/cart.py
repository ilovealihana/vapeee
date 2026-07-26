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
    CartItemAvailabilitySchema,
    CartItemSchema,
    CartSourceSchema,
    CartSchema,
    UpdateCartItemRequest,
    VariantSchema,
    ProductSchema,
)

router = APIRouter(prefix="/api/cart", tags=["cart"])

SOURCE_LOCAL_POINT = "local_point"
SOURCE_INPOST = "inpost"


def _cart_source_type(cart) -> str | None:
    if cart is None:
        return None
    source_type = getattr(cart, "source_type", None)
    location_id = getattr(cart, "location_id", None)
    if source_type:
        return source_type
    if location_id is not None:
        return SOURCE_LOCAL_POINT
    return None


def _requested_source(body: AddCartItemRequest) -> tuple[str, int | None]:
    if body.source_type == SOURCE_INPOST:
        if body.location_id is not None:
            raise api_error(400, ErrorCode.CART_SOURCE_MISMATCH, "Cart source mismatch")
        return SOURCE_INPOST, None
    if body.source_type not in (None, SOURCE_LOCAL_POINT):
        raise api_error(400, ErrorCode.CART_SOURCE_MISMATCH, "Cart source mismatch")
    if body.location_id is not None:
        return SOURCE_LOCAL_POINT, body.location_id
    if body.source_type == SOURCE_LOCAL_POINT:
        raise api_error(400, ErrorCode.CART_SOURCE_MISMATCH, "Cart source mismatch")
    return SOURCE_INPOST, None


def _sources_match(
    current_source_type: str | None,
    current_location_id: int | None,
    next_source_type: str,
    next_location_id: int | None,
) -> bool:
    if current_source_type != next_source_type:
        return False
    if current_source_type == SOURCE_LOCAL_POINT:
        return current_location_id == next_location_id
    return True


async def _validate_add_item_available(
    body: AddCartItemRequest,
    requested_total_quantity: int,
    catalog: CatalogRepository,
    session: AsyncSession,
) -> None:
    source_type, location_id = _requested_source(body)
    variant = await catalog.get_variant(body.variant_id)
    if not variant:
        raise api_error(400, ErrorCode.CART_VARIANT_UNAVAILABLE, "Variant unavailable")

    product = await catalog.get_product(variant.product_id)
    if not product or not product.is_active:
        raise api_error(400, ErrorCode.CART_VARIANT_UNAVAILABLE, "Variant unavailable")

    if source_type == SOURCE_INPOST:
        available = await catalog.get_inpost_variant_quantity(body.variant_id)
        if available < requested_total_quantity:
            raise api_error(
                400,
                ErrorCode.CART_INSUFFICIENT_STOCK,
                "Insufficient stock",
                {"available": available, "requested": requested_total_quantity},
            )
        return

    location = await catalog.get_location(location_id)
    city = getattr(location, "city", None) if location else None
    if (
        not location
        or not location.is_active
        or not city
        or not getattr(city, "is_active", False)
        or not await catalog.get_location_point_manager(location_id)
    ):
        raise api_error(400, ErrorCode.CART_VARIANT_UNAVAILABLE, "Variant unavailable")

    result = await session.execute(
        select(LocationStock).where(
            LocationStock.location_id == location_id,
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


async def _cart_source_schema(cart, catalog: CatalogRepository) -> CartSourceSchema | None:
    source_type = _cart_source_type(cart)
    if source_type == SOURCE_LOCAL_POINT and cart.location_id is not None:
        location = await catalog.get_location(cart.location_id)
        city = getattr(location, "city", None) if location else None
        available = bool(
            location
            and location.is_active
            and city
            and getattr(city, "is_active", False)
            and await catalog.get_location_point_manager(cart.location_id)
        )
        status = "available" if available else "inactive"
        return CartSourceSchema(type=SOURCE_LOCAL_POINT, location_id=cart.location_id, status=status)
    if source_type == SOURCE_INPOST:
        return CartSourceSchema(type=SOURCE_INPOST, location_id=None, status="inactive")
    return None


async def _item_availability(cart, item, product, catalog: CatalogRepository, session: AsyncSession) -> CartItemAvailabilitySchema:
    if not item.variant:
        return CartItemAvailabilitySchema(active=False, reason="variant_unavailable", available_quantity=0)
    if not product or not product.is_active:
        return CartItemAvailabilitySchema(active=False, reason="product_unavailable", available_quantity=0)

    source_type = _cart_source_type(cart)
    if source_type == SOURCE_LOCAL_POINT and cart.location_id is not None:
        location = await catalog.get_location(cart.location_id)
        city = getattr(location, "city", None) if location else None
        if (
            not location
            or not location.is_active
            or not city
            or not getattr(city, "is_active", False)
            or not await catalog.get_location_point_manager(cart.location_id)
        ):
            return CartItemAvailabilitySchema(active=False, reason="source_unavailable", available_quantity=0)
        result = await session.execute(
            select(LocationStock).where(
                LocationStock.location_id == cart.location_id,
                LocationStock.variant_id == item.variant_id,
            )
        )
        stock = result.scalar_one_or_none()
        available_quantity = stock.quantity if stock else 0
    elif source_type == SOURCE_INPOST:
        available_quantity = await catalog.get_inpost_variant_quantity(item.variant_id)
    else:
        return CartItemAvailabilitySchema(active=False, reason="source_unavailable", available_quantity=0)

    if available_quantity < item.quantity:
        return CartItemAvailabilitySchema(
            active=False,
            reason="insufficient_stock",
            available_quantity=available_quantity,
        )
    return CartItemAvailabilitySchema(active=True, reason=None, available_quantity=available_quantity)


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
        availability = await _item_availability(cart, item, product, catalog, session)
        items.append(CartItemSchema(
            id=item.id,
            variant_id=item.variant_id,
            quantity=item.quantity,
            variant=VariantSchema.model_validate(variant) if variant else None,
            product=ProductSchema.model_validate(product) if product else None,
            price=price,
            subtotal=subtotal,
            availability=availability,
        ))
    return CartSchema(
        id=cart.id,
        user_id=cart.user_id,
        location_id=cart.location_id,
        source=await _cart_source_schema(cart, catalog),
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
        return CartSchema(id=0, user_id=user.id, location_id=None, source=None, items=[], total=Decimal("0"))
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
    requested_source_type, requested_location_id = _requested_source(body)
    if existing_cart and existing_cart.items:
        current_source_type = _cart_source_type(existing_cart)
        if not _sources_match(
            current_source_type,
            getattr(existing_cart, "location_id", None),
            requested_source_type,
            requested_location_id,
        ):
            raise api_error(409, ErrorCode.CART_SOURCE_MISMATCH, "Cart source mismatch")
    existing_quantity = sum(
        item.quantity for item in existing_cart.items if item.variant_id == body.variant_id
    ) if existing_cart else 0
    catalog = CatalogRepository(session)
    await _validate_add_item_available(body, existing_quantity + body.quantity, catalog, session)
    cart = await repo.get_or_create(user_id, requested_location_id, requested_source_type)

    if not cart.items and not _sources_match(
        _cart_source_type(cart),
        cart.location_id,
        requested_source_type,
        requested_location_id,
    ):
        await repo.set_source(cart, requested_source_type, requested_location_id)

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
    if body.quantity > item.quantity:
        source_type = _cart_source_type(cart)
        await _validate_add_item_available(
            AddCartItemRequest(
                variant_id=item.variant_id,
                quantity=body.quantity,
                location_id=cart.location_id if source_type == SOURCE_LOCAL_POINT else None,
                source_type=source_type,
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

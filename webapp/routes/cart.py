"""Cart routes."""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.cart import CartRepository
from db.repositories.catalog import CatalogRepository
from db.repositories.user import UserRepository
from webapp.auth import verify_init_data
from webapp.deps import get_session
from webapp.schemas import (
    AddCartItemRequest,
    CartItemSchema,
    CartSchema,
    UpdateCartItemRequest,
    VariantSchema,
    ProductSchema,
)

router = APIRouter(prefix="/api/cart", tags=["cart"])


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
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    repo = CartRepository(session)
    cart = await repo.get_by_user_id(user.id)
    if not cart:
        # Return empty cart
        return CartSchema(id=0, user_id=user.id, location_id=None, items=[], total=Decimal("0"))
    return await _build_cart_schema(cart, session)


@router.post("/items", response_model=CartSchema)
async def add_item(
    body: AddCartItemRequest,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    repo = CartRepository(session)
    cart = await repo.get_or_create(user.id, body.location_id)

    # Update location if switching
    if cart.location_id != body.location_id:
        await repo.set_location(cart, body.location_id)

    await repo.add_item(cart, body.variant_id, body.quantity)

    # Reload
    session.expire_all()
    cart = await repo.get_by_user_id(user.id)
    return await _build_cart_schema(cart, session)


@router.patch("/items/{item_id}", response_model=CartSchema)
async def update_item(
    item_id: int,
    body: UpdateCartItemRequest,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    repo = CartRepository(session)
    cart = await repo.get_by_user_id(user.id)
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    await repo.set_item_quantity(cart.id, item_id, body.quantity)
    session.expire_all()
    cart = await repo.get_by_user_id(user.id)
    return await _build_cart_schema(cart, session)


@router.delete("/items/{item_id}", response_model=CartSchema)
async def remove_item(
    item_id: int,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    repo = CartRepository(session)
    cart = await repo.get_by_user_id(user.id)
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    await repo.remove_item(cart.id, item_id)
    session.expire_all()
    cart = await repo.get_by_user_id(user.id)
    return await _build_cart_schema(cart, session)


@router.delete("", status_code=204)
async def clear_cart(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    repo = CartRepository(session)
    cart = await repo.get_by_user_id(user.id)
    if cart:
        await repo.clear(cart.id)

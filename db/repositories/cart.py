from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.cart import Cart
from db.models.cart_item import CartItem
from db.models.user import User


class CartRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_or_create(
        self,
        user_id: int,
        location_id: int | None = None,
        source_type: str | None = None,
    ) -> Cart:
        result = await self.session.execute(
            select(Cart)
            .where(Cart.user_id == user_id)
            .options(selectinload(Cart.items))
        )
        cart = result.scalar_one_or_none()
        if cart is None:
            cart = Cart(user_id=user_id, location_id=location_id, source_type=source_type)
            self.session.add(cart)
            await self.session.commit()
            await self.session.refresh(cart)
        return cart

    async def get_by_user_id(self, user_id: int) -> Cart | None:
        result = await self.session.execute(
            select(Cart)
            .where(Cart.user_id == user_id)
            .options(selectinload(Cart.items).selectinload(CartItem.variant))
        )
        return result.scalar_one_or_none()

    async def add_item(self, cart: Cart, variant_id: int, quantity: int = 1) -> CartItem:
        result = await self.session.execute(
            select(CartItem).where(
                CartItem.cart_id == cart.id,
                CartItem.variant_id == variant_id,
            )
        )
        item = result.scalar_one_or_none()
        if item is None:
            item = CartItem(cart_id=cart.id, variant_id=variant_id, quantity=quantity)
            self.session.add(item)
        else:
            item.quantity += quantity
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def get_item(self, cart_id: int, item_id: int) -> CartItem | None:
        result = await self.session.execute(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart_id)
        )
        return result.scalar_one_or_none()

    async def remove_item(self, cart_id: int, item_id: int) -> None:
        result = await self.session.execute(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart_id)
        )
        item = result.scalar_one_or_none()
        if item:
            await self.session.delete(item)
            await self.session.commit()

    async def set_item_quantity(self, cart_id: int, item_id: int, quantity: int) -> None:
        result = await self.session.execute(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart_id)
        )
        item = result.scalar_one_or_none()
        if item:
            if quantity <= 0:
                await self.session.delete(item)
            else:
                item.quantity = quantity
            await self.session.commit()

    async def clear(self, cart_id: int) -> None:
        cart_result = await self.session.execute(select(Cart).where(Cart.id == cart_id))
        cart = cart_result.scalar_one_or_none()
        result = await self.session.execute(
            select(CartItem).where(CartItem.cart_id == cart_id)
        )
        for item in result.scalars().all():
            await self.session.delete(item)
        if cart is not None:
            cart.location_id = None
            cart.source_type = None
        await self.session.commit()

    async def set_location(self, cart: Cart, location_id: int | None) -> None:
        cart.location_id = location_id
        cart.source_type = "local_point" if location_id is not None else None
        await self.session.commit()

    async def set_source(
        self,
        cart: Cart,
        source_type: str | None,
        location_id: int | None = None,
    ) -> None:
        cart.source_type = source_type
        cart.location_id = location_id
        await self.session.commit()

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.order import Order
from db.models.order_item import OrderItem


class OrderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        user_id: int,
        delivery_type: str,
        customer_name: str,
        customer_phone: str,
        customer_email: str,
        products_total: Decimal,
        delivery_cost: Decimal,
        total: Decimal,
        payment_method: str,
        source_type: str | None = None,
        location_id: int | None = None,
        delivery_address: str | None = None,
        scheduled_at: datetime | None = None,
        inpost_delivery_method: str | None = None,
        inpost_point_id: str | None = None,
        inpost_point_label: str | None = None,
        inpost_courier_address_json: str | None = None,
        comment: str | None = None,
    ) -> Order:
        order = Order(
            user_id=user_id,
            source_type=source_type,
            location_id=location_id,
            delivery_type=delivery_type,
            customer_name=customer_name,
            customer_phone=customer_phone,
            customer_email=customer_email,
            delivery_address=delivery_address,
            scheduled_at=scheduled_at,
            products_total=products_total,
            delivery_cost=delivery_cost,
            total=total,
            payment_method=payment_method,
            inpost_delivery_method=inpost_delivery_method,
            inpost_point_id=inpost_point_id,
            inpost_point_label=inpost_point_label,
            inpost_courier_address_json=inpost_courier_address_json,
            comment=comment,
        )
        self.session.add(order)
        await self.session.flush()  # get order.id
        return order

    async def add_items(self, order_id: int, items: list[dict]) -> None:
        """items: [{"variant_id": int, "quantity": int, "price_at_order": Decimal}]"""
        for item_data in items:
            item = OrderItem(
                order_id=order_id,
                variant_id=item_data["variant_id"],
                quantity=item_data["quantity"],
                price_at_order=item_data["price_at_order"],
            )
            self.session.add(item)
        await self.session.commit()

    async def get(self, order_id: int) -> Order | None:
        result = await self.session.execute(
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.items).selectinload(OrderItem.variant))
        )
        return result.scalar_one_or_none()

    async def get_user_orders(
        self, user_id: int, page: int = 0, page_size: int = 5
    ) -> list[Order]:
        result = await self.session.execute(
            select(Order)
            .where(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
            .offset(page * page_size)
            .limit(page_size)
            .options(selectinload(Order.items))
        )
        return list(result.scalars().all())

    async def get_first_order_at(self, user_id: int) -> datetime | None:
        result = await self.session.execute(
            select(func.min(Order.created_at)).where(Order.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_new_orders(self, page: int = 0, page_size: int = 10) -> list[Order]:
        result = await self.session.execute(
            select(Order)
            .where(Order.status == "new")
            .order_by(Order.created_at)
            .offset(page * page_size)
            .limit(page_size)
            .options(selectinload(Order.items), selectinload(Order.location))
        )
        return list(result.scalars().all())

    async def set_status(self, order_id: int, status: str) -> Order | None:
        order = await self.get(order_id)
        if order:
            order.status = status
            await self.session.commit()
        return order

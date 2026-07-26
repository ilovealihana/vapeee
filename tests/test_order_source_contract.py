import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import db.models  # noqa: F401
from db.models.city import City
from db.models.cart import Cart
from db.models.cart_item import CartItem
from db.models.inpost_stock import InpostStock
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.product import Product
from db.models.product_variant import ProductVariant
from db.models.staff import ROLE_POINT_MANAGER, StaffAssignment, StaffMember
from db.models.user import User
from db.session import Base
from webapp.errors import ApiError, ErrorCode
from webapp.routes import cart as cart_routes
from webapp.routes import orders as order_routes
from webapp.schemas import AddCartItemRequest, CreateOrderRequest


class OrderSourceContractTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _seed(self, session):
        user = User(tg_id=7001, first_name="User", language="ru")
        city = City(name="Wroclaw", slug="wroclaw", is_active=True)
        session.add_all([user, city])
        await session.flush()

        location = Location(city_id=city.id, name="Center", address="Main 1", is_active=True)
        session.add(location)
        await session.flush()

        manager = StaffMember(
            tg_id=8001,
            username="manager8001",
            role=ROLE_POINT_MANAGER,
            is_active=True,
        )
        session.add(manager)
        await session.flush()
        session.add(StaffAssignment(staff_member_id=manager.id, location_id=location.id))

        product = Product(
            name_ru="Product",
            name_pl="Product",
            name_uk="Product",
            base_price=Decimal("10.00"),
            is_active=True,
        )
        session.add(product)
        await session.flush()

        local_variant = ProductVariant(
            product_id=product.id,
            name_ru="Local",
            name_pl="Local",
            name_uk="Local",
        )
        inpost_variant = ProductVariant(
            product_id=product.id,
            name_ru="Warehouse",
            name_pl="Warehouse",
            name_uk="Warehouse",
        )
        session.add_all([local_variant, inpost_variant])
        await session.flush()
        session.add_all([
            LocationStock(location_id=location.id, variant_id=local_variant.id, quantity=3),
            InpostStock(variant_id=inpost_variant.id, quantity=3),
        ])
        await session.commit()
        return {
            "user": SimpleNamespace(id=user.id),
            "location_id": location.id,
            "product_id": product.id,
            "local_variant_id": local_variant.id,
            "inpost_variant_id": inpost_variant.id,
        }

    def _order_body(self, **overrides):
        scheduled = datetime.now(tz=timezone.utc) + timedelta(days=1)
        data = {
            "delivery_type": "pickup",
            "customer_name": "Customer",
            "customer_phone": "+48500111222",
            "customer_email": "customer@example.com",
            "location_id": None,
            "scheduled_date": scheduled.strftime("%Y-%m-%d"),
            "scheduled_time": scheduled.strftime("%H:%M"),
            "payment_method": "cash",
            "comment": None,
        }
        data.update(overrides)
        return CreateOrderRequest(**data)

    async def test_local_point_checkout_uses_cart_source_and_decrements_stock(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)
            await cart_routes.add_item(
                AddCartItemRequest(
                    variant_id=seeded["local_variant_id"],
                    quantity=2,
                    location_id=seeded["location_id"],
                ),
                user=seeded["user"],
                session=session,
            )

            order = await order_routes.create_order(
                self._order_body(location_id=None),
                user=seeded["user"],
                session=session,
            )
            stock = (
                await session.execute(
                    select(LocationStock).where(
                        LocationStock.location_id == seeded["location_id"],
                        LocationStock.variant_id == seeded["local_variant_id"],
                    )
                )
            ).scalar_one()

        self.assertEqual(order.source_type, "local_point")
        self.assertEqual(order.location_id, seeded["location_id"])
        self.assertEqual(stock.quantity, 1)

    async def test_checkout_rejects_inactive_cart_item(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)
            await cart_routes.add_item(
                AddCartItemRequest(
                    variant_id=seeded["local_variant_id"],
                    quantity=1,
                    location_id=seeded["location_id"],
                ),
                user=seeded["user"],
                session=session,
            )
            product = await session.get(Product, seeded["product_id"])
            product.is_active = False
            await session.commit()

            with self.assertRaises(ApiError) as raised:
                await order_routes.create_order(
                    self._order_body(),
                    user=seeded["user"],
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.code, ErrorCode.ORDER_INSUFFICIENT_STOCK)

    async def test_inpost_checkout_is_blocked_until_validation_is_ready(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)
            await cart_routes.add_item(
                AddCartItemRequest(
                    variant_id=seeded["inpost_variant_id"],
                    quantity=1,
                    source_type="inpost",
                ),
                user=seeded["user"],
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await order_routes.create_order(
                    self._order_body(delivery_type="inpost", source_type="inpost"),
                    user=seeded["user"],
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 501)
        self.assertEqual(raised.exception.code, ErrorCode.ORDER_INPOST_UNAVAILABLE)

    async def test_checkout_rejects_legacy_cart_without_source_or_location(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)
            cart = Cart(user_id=seeded["user"].id, source_type=None, location_id=None)
            session.add(cart)
            await session.flush()
            session.add(CartItem(cart_id=cart.id, variant_id=seeded["local_variant_id"], quantity=1))
            await session.commit()

            with self.assertRaises(ApiError) as raised:
                await order_routes.create_order(
                    self._order_body(),
                    user=seeded["user"],
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.code, ErrorCode.ORDER_LOCATION_REQUIRED)

    async def test_checkout_rejects_unknown_source_type(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)
            cart = Cart(user_id=seeded["user"].id, source_type=None, location_id=None)
            session.add(cart)
            await session.flush()
            session.add(CartItem(cart_id=cart.id, variant_id=seeded["local_variant_id"], quantity=1))
            await session.commit()

            with self.assertRaises(ApiError) as raised:
                await order_routes.create_order(
                    self._order_body(source_type="bogus"),
                    user=seeded["user"],
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.code, ErrorCode.CATALOG_SOURCE_INVALID)


if __name__ == "__main__":
    unittest.main()

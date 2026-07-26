import unittest
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import db.models  # noqa: F401
from db.models.city import City
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
from webapp.schemas import AddCartItemRequest, UpdateCartItemRequest


class CartSourceContractTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _seed(self, session):
        user = User(tg_id=5001, first_name="User", language="ru")
        city = City(name="Wroclaw", slug="wroclaw", is_active=True)
        session.add_all([user, city])
        await session.flush()

        location = Location(
            city_id=city.id,
            name="Center",
            address="Main 1",
            is_active=True,
        )
        other_location = Location(
            city_id=city.id,
            name="North",
            address="North 1",
            is_active=True,
        )
        session.add_all([location, other_location])
        await session.flush()

        manager = StaffMember(
            tg_id=6001,
            username="manager6001",
            role=ROLE_POINT_MANAGER,
            is_active=True,
        )
        session.add(manager)
        await session.flush()
        session.add_all([
            StaffAssignment(staff_member_id=manager.id, location_id=location.id),
            StaffAssignment(staff_member_id=manager.id, location_id=other_location.id),
        ])

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
            LocationStock(location_id=location.id, variant_id=local_variant.id, quantity=4),
            LocationStock(location_id=other_location.id, variant_id=local_variant.id, quantity=4),
            InpostStock(variant_id=inpost_variant.id, quantity=5),
        ])
        await session.commit()
        return {
            "user": SimpleNamespace(id=user.id),
            "location_id": location.id,
            "other_location_id": other_location.id,
            "product_id": product.id,
            "local_variant_id": local_variant.id,
            "inpost_variant_id": inpost_variant.id,
        }

    async def test_empty_cart_returns_null_source(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)

            cart = await cart_routes.get_cart(user=seeded["user"], session=session)

        self.assertIsNone(cart.source)
        self.assertEqual(cart.items, [])

    async def test_add_local_point_item_sets_local_source(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)

            cart = await cart_routes.add_item(
                AddCartItemRequest(
                    variant_id=seeded["local_variant_id"],
                    quantity=1,
                    location_id=seeded["location_id"],
                ),
                user=seeded["user"],
                session=session,
            )

        self.assertEqual(cart.source.type, "local_point")
        self.assertEqual(cart.source.location_id, seeded["location_id"])
        self.assertEqual(cart.items[0].availability.active, True)

    async def test_add_inpost_item_sets_inpost_source(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)

            cart = await cart_routes.add_item(
                AddCartItemRequest(
                    variant_id=seeded["inpost_variant_id"],
                    quantity=1,
                    source_type="inpost",
                ),
                user=seeded["user"],
                session=session,
            )

        self.assertEqual(cart.source.type, "inpost")
        self.assertIsNone(cart.source.location_id)
        self.assertEqual(cart.items[0].availability.active, True)

    async def test_cart_rejects_mixed_sources(self):
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

            with self.assertRaises(ApiError) as raised:
                await cart_routes.add_item(
                    AddCartItemRequest(
                        variant_id=seeded["inpost_variant_id"],
                        quantity=1,
                        source_type="inpost",
                    ),
                    user=seeded["user"],
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.CART_SOURCE_MISMATCH)

    async def test_cart_rejects_second_local_point(self):
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

            with self.assertRaises(ApiError) as raised:
                await cart_routes.add_item(
                    AddCartItemRequest(
                        variant_id=seeded["local_variant_id"],
                        quantity=1,
                        location_id=seeded["other_location_id"],
                    ),
                    user=seeded["user"],
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.CART_SOURCE_MISMATCH)

    async def test_inactive_item_stays_visible_but_cannot_increase(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)
            cart = await cart_routes.add_item(
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

            inactive_cart = await cart_routes.get_cart(user=seeded["user"], session=session)
            with self.assertRaises(ApiError) as raised:
                await cart_routes.update_item(
                    inactive_cart.items[0].id,
                    UpdateCartItemRequest(quantity=2),
                    user=seeded["user"],
                    session=session,
                )

        self.assertEqual(inactive_cart.items[0].availability.active, False)
        self.assertEqual(inactive_cart.items[0].availability.reason, "product_unavailable")
        self.assertEqual(raised.exception.code, ErrorCode.CART_VARIANT_UNAVAILABLE)
        self.assertEqual(cart.items[0].quantity, 1)

    async def test_inactive_item_can_be_removed(self):
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
            inactive_cart = await cart_routes.get_cart(user=seeded["user"], session=session)

            cart = await cart_routes.remove_item(
                inactive_cart.items[0].id,
                user=seeded["user"],
                session=session,
            )

        self.assertEqual(cart.items, [])


if __name__ == "__main__":
    unittest.main()

import unittest
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import db.models  # noqa: F401
from db.models.city import City
from db.models.inpost_stock import InpostStock
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.product import Product
from db.models.product_variant import ProductVariant
from db.models.staff import ROLE_POINT_MANAGER, StaffAssignment, StaffMember
from db.session import Base
from webapp.errors import ApiError, ErrorCode
from webapp.routes import catalog as catalog_routes


class CatalogSourcesContractTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _seed_catalog(self, session):
        city = City(name="Wroclaw", slug="wroclaw", is_active=True)
        session.add(city)
        await session.flush()

        available_location = Location(
            city_id=city.id,
            name="Center",
            address="Main 1",
            latitude=Decimal("51.110000"),
            longitude=Decimal("17.030000"),
            is_active=True,
        )
        coming_soon_location = Location(
            city_id=city.id,
            name="North",
            address="North 1",
            latitude=Decimal("51.120000"),
            longitude=Decimal("17.040000"),
            is_active=True,
        )
        session.add_all([available_location, coming_soon_location])
        await session.flush()

        manager = StaffMember(
            tg_id=1001,
            username="manager1001",
            role=ROLE_POINT_MANAGER,
            is_active=True,
        )
        session.add(manager)
        await session.flush()
        session.add(StaffAssignment(staff_member_id=manager.id, location_id=available_location.id))

        active_product = Product(
            name_ru="Active",
            name_pl="Active",
            name_uk="Active",
            base_price=Decimal("10.00"),
            is_active=True,
        )
        deleted_product = Product(
            name_ru="Deleted",
            name_pl="Deleted",
            name_uk="Deleted",
            base_price=Decimal("20.00"),
            is_active=False,
        )
        session.add_all([active_product, deleted_product])
        await session.flush()

        local_variant = ProductVariant(
            product_id=active_product.id,
            name_ru="Local",
            name_pl="Local",
            name_uk="Local",
        )
        inpost_variant = ProductVariant(
            product_id=active_product.id,
            name_ru="Warehouse",
            name_pl="Warehouse",
            name_uk="Warehouse",
        )
        deleted_variant = ProductVariant(
            product_id=deleted_product.id,
            name_ru="Deleted variant",
            name_pl="Deleted variant",
            name_uk="Deleted variant",
        )
        session.add_all([local_variant, inpost_variant, deleted_variant])
        await session.flush()

        session.add_all([
            LocationStock(
                location_id=available_location.id,
                variant_id=local_variant.id,
                quantity=3,
            ),
            LocationStock(
                location_id=available_location.id,
                variant_id=deleted_variant.id,
                quantity=9,
            ),
            InpostStock(variant_id=inpost_variant.id, quantity=5),
        ])
        await session.commit()
        return {
            "available_location": available_location,
            "coming_soon_location": coming_soon_location,
            "active_product": active_product,
        }

    async def test_catalog_sources_return_inpost_and_grouped_local_points(self):
        async with self.session_maker() as session:
            seeded = await self._seed_catalog(session)

            response = await catalog_routes.get_catalog_sources(session=session)

        self.assertEqual(response.inpost.type, "inpost")
        self.assertEqual(response.inpost.stock_count, 5)
        self.assertEqual([city.name for city in response.cities], ["Wroclaw"])

        locations = {location.name: location for location in response.cities[0].locations}
        self.assertEqual(locations["Center"].status, "available")
        self.assertTrue(locations["Center"].catalog_available)
        self.assertEqual(locations["Center"].stock_count, 3)
        self.assertEqual(locations["Center"].latitude, seeded["available_location"].latitude)
        self.assertEqual(locations["Center"].longitude, seeded["available_location"].longitude)
        self.assertEqual(locations["Center"].manager_tg_username, "manager1001")
        self.assertEqual(locations["North"].status, "coming_soon")
        self.assertFalse(locations["North"].catalog_available)

    async def test_local_point_products_keep_location_stock_filter(self):
        async with self.session_maker() as session:
            seeded = await self._seed_catalog(session)

            products = await catalog_routes.get_products(
                category_id=None,
                location_id=seeded["available_location"].id,
                session=session,
            )

        self.assertEqual([product.name_ru for product in products], ["Active"])
        self.assertEqual([variant.name_ru for variant in products[0].variants], ["Local"])

    async def test_inpost_products_use_warehouse_stock_filter(self):
        async with self.session_maker() as session:
            await self._seed_catalog(session)

            products = await catalog_routes.get_products(category_id=None, source="inpost", session=session)

        self.assertEqual([product.name_ru for product in products], ["Active"])
        self.assertEqual([variant.name_ru for variant in products[0].variants], ["Warehouse"])

    async def test_source_and_location_id_are_mutually_exclusive(self):
        async with self.session_maker() as session:
            seeded = await self._seed_catalog(session)

            with self.assertRaises(ApiError) as raised:
                await catalog_routes.get_products(
                    category_id=None,
                    source="inpost",
                    location_id=seeded["available_location"].id,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.code, ErrorCode.CATALOG_SOURCE_INVALID)

    async def test_inpost_product_detail_requires_warehouse_stock(self):
        async with self.session_maker() as session:
            seeded = await self._seed_catalog(session)
            result = await session.execute(select(InpostStock))
            for stock in result.scalars().all():
                stock.quantity = 0
            await session.commit()

            with self.assertRaises(ApiError) as raised:
                await catalog_routes.get_product(
                    seeded["active_product"].id,
                    source="inpost",
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(raised.exception.code, ErrorCode.CATALOG_PRODUCT_UNAVAILABLE)


if __name__ == "__main__":
    unittest.main()

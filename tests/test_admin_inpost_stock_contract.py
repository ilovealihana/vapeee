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
from db.session import Base
from webapp.routes.admin import admin_get_stock, admin_update_stock
from webapp.routes.catalog import get_catalog_sources
from webapp.schemas import UpdateStockRequest


class AdminInpostStockContractTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _seed(self, session):
        city = City(name="Wroclaw", slug="wroclaw", is_active=True)
        session.add(city)
        await session.flush()

        location = Location(city_id=city.id, name="Center", address="Main 1", is_active=True)
        session.add(location)
        await session.flush()

        product = Product(
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
            base_price=Decimal("10.00"),
            is_active=False,
        )
        session.add_all([product, deleted_product])
        await session.flush()

        variant = ProductVariant(product_id=product.id, name_ru="Base", name_pl="Base", name_uk="Base")
        deleted_variant = ProductVariant(
            product_id=deleted_product.id,
            name_ru="Deleted variant",
            name_pl="Deleted variant",
            name_uk="Deleted variant",
        )
        session.add_all([variant, deleted_variant])
        await session.flush()

        session.add_all([
            LocationStock(location_id=location.id, variant_id=variant.id, quantity=3),
            InpostStock(variant_id=variant.id, quantity=7),
            InpostStock(variant_id=deleted_variant.id, quantity=9),
        ])
        await session.commit()
        return {"location": location, "variant": variant}

    async def test_admin_stock_returns_local_point_and_inpost_rows_separately(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)

            rows = await admin_get_stock(_=object(), session=session)

        by_source = {row.source_type: row for row in rows if row.variant_id == seeded["variant"].id}
        self.assertEqual(by_source["local_point"].location_id, seeded["location"].id)
        self.assertEqual(by_source["local_point"].quantity, 3)
        self.assertEqual(by_source["inpost"].location_id, None)
        self.assertEqual(by_source["inpost"].location_name, "InPost")
        self.assertEqual(by_source["inpost"].quantity, 7)
        self.assertNotIn("Deleted variant", [row.variant_name for row in rows])

    async def test_admin_stock_update_upserts_inpost_stock_without_location(self):
        async with self.session_maker() as session:
            seeded = await self._seed(session)

            await admin_update_stock(
                UpdateStockRequest(items=[
                    {
                        "source_type": "inpost",
                        "location_id": None,
                        "variant_id": seeded["variant"].id,
                        "quantity": 12,
                    }
                ]),
                _=object(),
                session=session,
            )

            result = await session.execute(
                select(InpostStock).where(InpostStock.variant_id == seeded["variant"].id)
            )
            stock = result.scalar_one()

        self.assertEqual(stock.quantity, 12)

    async def test_catalog_sources_keep_inpost_inactive_even_with_managed_stock(self):
        async with self.session_maker() as session:
            await self._seed(session)

            response = await get_catalog_sources(session=session)

        self.assertEqual(response.inpost.stock_count, 7)
        self.assertEqual(response.inpost.status, "inactive")


if __name__ == "__main__":
    unittest.main()

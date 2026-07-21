import unittest
from decimal import Decimal

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import db.models  # noqa: F401 - register model metadata
from db.models.city import City
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.product import Product
from db.models.product_variant import ProductVariant
from db.repositories.catalog import CatalogRepository
from db.session import Base
from webapp.routes.admin import admin_get_stock, admin_list_products


class AdminInventoryContractTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_admin_products_list_excludes_soft_deleted_products(self):
        async with self.session_maker() as session:
            active = Product(
                name_ru="Active",
                name_pl="Active",
                name_uk="Active",
                base_price=Decimal("10.00"),
                is_active=True,
            )
            hidden = Product(
                name_ru="ELFLIQ",
                name_pl="ELFLIQ",
                name_uk="ELFLIQ",
                base_price=Decimal("11.00"),
                is_active=False,
            )
            session.add_all([active, hidden])
            await session.commit()

            products = await admin_list_products(_=object(), session=session)

        self.assertEqual([product.name_ru for product in products], ["Active"])

    async def test_admin_stock_returns_zero_rows_for_new_active_variants_at_active_locations(self):
        async with self.session_maker() as session:
            active_city = City(name="Wroclaw", slug="wroclaw", is_active=True)
            hidden_city = City(name="Hidden city", slug="hidden-city", is_active=False)
            session.add_all([active_city, hidden_city])
            await session.flush()

            active_location = Location(
                city_id=active_city.id,
                name="Center",
                address="Main 1",
                is_active=True,
            )
            inactive_location = Location(
                city_id=active_city.id,
                name="Closed",
                address="Closed 1",
                is_active=False,
            )
            hidden_city_location = Location(
                city_id=hidden_city.id,
                name="Hidden",
                address="Hidden 1",
                is_active=True,
            )
            session.add_all([active_location, inactive_location, hidden_city_location])
            await session.flush()

            product = Product(
                name_ru="New product",
                name_pl="New product",
                name_uk="New product",
                base_price=Decimal("20.00"),
                is_active=True,
            )
            hidden_product = Product(
                name_ru="Hidden product",
                name_pl="Hidden product",
                name_uk="Hidden product",
                base_price=Decimal("30.00"),
                is_active=False,
            )
            session.add_all([product, hidden_product])
            await session.flush()

            variant = ProductVariant(
                product_id=product.id,
                name_ru="Base",
                name_pl="Base",
                name_uk="Base",
            )
            stocked_variant = ProductVariant(
                product_id=product.id,
                name_ru="Stocked",
                name_pl="Stocked",
                name_uk="Stocked",
            )
            hidden_variant = ProductVariant(
                product_id=hidden_product.id,
                name_ru="Hidden variant",
                name_pl="Hidden variant",
                name_uk="Hidden variant",
            )
            session.add_all([variant, stocked_variant, hidden_variant])
            await session.flush()

            session.add(
                LocationStock(
                    location_id=active_location.id,
                    variant_id=stocked_variant.id,
                    quantity=7,
                )
            )
            await session.commit()

            rows = await admin_get_stock(_=object(), session=session)

        by_variant = {row.variant_name: row for row in rows}
        self.assertEqual(len(rows), 2)
        self.assertEqual(by_variant["Base"].location_name, "Center")
        self.assertEqual(by_variant["Base"].city_name, "Wroclaw")
        self.assertEqual(by_variant["Base"].product_name, "New product")
        self.assertEqual(by_variant["Base"].quantity, 0)
        self.assertEqual(by_variant["Stocked"].quantity, 7)
        self.assertNotIn("Hidden variant", by_variant)

    async def test_location_stock_summary_ignores_soft_deleted_products(self):
        async with self.session_maker() as session:
            city = City(name="Wroclaw", slug="wroclaw", is_active=True)
            session.add(city)
            await session.flush()

            location = Location(
                city_id=city.id,
                name="Center",
                address="Main 1",
                is_active=True,
            )
            session.add(location)
            await session.flush()

            active_product = Product(
                name_ru="Active",
                name_pl="Active",
                name_uk="Active",
                base_price=Decimal("10.00"),
                is_active=True,
            )
            deleted_product = Product(
                name_ru="ELFLIQ",
                name_pl="ELFLIQ",
                name_uk="ELFLIQ",
                base_price=Decimal("11.00"),
                is_active=False,
            )
            session.add_all([active_product, deleted_product])
            await session.flush()

            active_variant = ProductVariant(
                product_id=active_product.id,
                name_ru="Active variant",
                name_pl="Active variant",
                name_uk="Active variant",
            )
            deleted_variant = ProductVariant(
                product_id=deleted_product.id,
                name_ru="Deleted variant",
                name_pl="Deleted variant",
                name_uk="Deleted variant",
            )
            session.add_all([active_variant, deleted_variant])
            await session.flush()

            session.add_all([
                LocationStock(
                    location_id=location.id,
                    variant_id=active_variant.id,
                    quantity=2,
                ),
                LocationStock(
                    location_id=location.id,
                    variant_id=deleted_variant.id,
                    quantity=5,
                ),
            ])
            await session.commit()

            summary = await CatalogRepository(session).get_location_stock_summary(location.id)

        self.assertEqual(summary["total_qty"], 2)


if __name__ == "__main__":
    unittest.main()

import unittest
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import db.models  # noqa: F401 - register model metadata
from db.models.city import City
from db.models.location import Location
from db.models.product import Product
from db.models.product_request import ProductRequest
from db.models.product_variant import ProductVariant
from db.session import Base
from webapp.routes.admin import admin_delete_city, admin_delete_location


class AdminDeleteContractTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _city_with_requested_location(self, session):
        city = City(name="Wroclaw", slug="wroclaw", is_active=True)
        product = Product(
            name_ru="ELFLIQ",
            name_pl="ELFLIQ",
            name_uk="ELFLIQ",
            base_price=Decimal("20.00"),
            is_active=True,
        )
        session.add_all([city, product])
        await session.flush()

        location = Location(
            city_id=city.id,
            name="Center",
            address="Main 1",
            is_active=True,
        )
        variant = ProductVariant(
            product_id=product.id,
            name_ru="Base",
            name_pl="Base",
            name_uk="Base",
        )
        session.add_all([location, variant])
        await session.flush()

        request = ProductRequest(
            request_type="ADD_STOCK",
            status="pending_review",
            requester_tg_id=10001,
            city_id=city.id,
            location_id=location.id,
            product_id=product.id,
            variant_id=variant.id,
            quantity=3,
        )
        session.add(request)
        await session.commit()
        return city.id, location.id, request.id

    async def test_delete_city_removes_locations_and_product_requests_for_clean_admin_reset(self):
        async with self.session_maker() as session:
            city_id, location_id, request_id = await self._city_with_requested_location(session)

            await admin_delete_city(city_id, _=object(), session=session)

            city = await session.get(City, city_id)
            location = await session.get(Location, location_id)
            request = await session.get(ProductRequest, request_id)

        self.assertIsNone(city)
        self.assertIsNone(location)
        self.assertIsNone(request)

    async def test_delete_location_removes_product_requests_for_clean_admin_reset(self):
        async with self.session_maker() as session:
            city_id, location_id, request_id = await self._city_with_requested_location(session)

            await admin_delete_location(location_id, _=object(), session=session)

            city = await session.get(City, city_id)
            location = await session.get(Location, location_id)
            requests = (
                await session.execute(select(ProductRequest).where(ProductRequest.id == request_id))
            ).scalars().all()

        self.assertIsNotNone(city)
        self.assertIsNone(location)
        self.assertEqual(requests, [])


if __name__ == "__main__":
    unittest.main()

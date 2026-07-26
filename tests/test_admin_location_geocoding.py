import unittest
from decimal import Decimal
from unittest.mock import patch

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import db.models  # noqa: F401
from db.models.city import City
from db.session import Base
from webapp.errors import ApiError, ErrorCode
from webapp.routes import admin as admin_routes
from webapp.schemas import CreateLocationRequest, UpdateLocationRequest
from webapp.services.geocoding import GeocodingAddressNotFound, GeocodingConfigError, GoogleGeocoder


class FakeGeocoder:
    calls: list[str] = []

    async def geocode(self, address: str):
        self.calls.append(address)
        if address == "Missing address":
            raise GeocodingAddressNotFound(address)
        return Decimal("51.110000"), Decimal("17.030000")


class AdminLocationGeocodingTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        FakeGeocoder.calls = []
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _city(self, session):
        city = City(name="Wroclaw", slug="wroclaw", is_active=True)
        session.add(city)
        await session.commit()
        return city

    async def test_create_location_stores_coordinates_from_geocoder(self):
        async with self.session_maker() as session:
            city = await self._city(session)

            with (
                patch("config.settings.GOOGLE_GEOCODING_API_KEY", "key"),
                patch("webapp.routes.admin.GoogleGeocoder", FakeGeocoder),
            ):
                location = await admin_routes.admin_create_location(
                    city.id,
                    CreateLocationRequest(name="Center", address="Main 1"),
                    _=object(),
                    session=session,
                )

        self.assertEqual(location.latitude, Decimal("51.110000"))
        self.assertEqual(location.longitude, Decimal("17.030000"))
        self.assertEqual(FakeGeocoder.calls, ["Main 1"])

    async def test_update_location_geocodes_only_when_address_changes(self):
        async with self.session_maker() as session:
            city = await self._city(session)

            with (
                patch("config.settings.GOOGLE_GEOCODING_API_KEY", "key"),
                patch("webapp.routes.admin.GoogleGeocoder", FakeGeocoder),
            ):
                location = await admin_routes.admin_create_location(
                    city.id,
                    CreateLocationRequest(name="Center", address="Main 1"),
                    _=object(),
                    session=session,
                )
                await admin_routes.admin_update_location(
                    location.id,
                    UpdateLocationRequest(name="Center renamed"),
                    _=object(),
                    session=session,
                )
                updated = await admin_routes.admin_update_location(
                    location.id,
                    UpdateLocationRequest(address="Main 2"),
                    _=object(),
                    session=session,
                )

        self.assertEqual(FakeGeocoder.calls, ["Main 1", "Main 2"])
        self.assertEqual(updated.latitude, Decimal("51.110000"))

    async def test_invalid_address_blocks_location_create_when_geocoding_is_configured(self):
        async with self.session_maker() as session:
            city = await self._city(session)

            with (
                patch("config.settings.GOOGLE_GEOCODING_API_KEY", "key"),
                patch("webapp.routes.admin.GoogleGeocoder", FakeGeocoder),
                self.assertRaises(ApiError) as raised,
            ):
                await admin_routes.admin_create_location(
                    city.id,
                    CreateLocationRequest(name="Missing", address="Missing address"),
                    _=object(),
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.code, ErrorCode.VALIDATION_FAILED)

    async def test_google_geocoder_missing_key_raises_config_error(self):
        with patch("config.settings.GOOGLE_GEOCODING_API_KEY", None):
            with self.assertRaises(GeocodingConfigError):
                await GoogleGeocoder().geocode("Main 1")


if __name__ == "__main__":
    unittest.main()

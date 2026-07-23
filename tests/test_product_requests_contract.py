import unittest
import inspect
from decimal import Decimal
from unittest.mock import patch

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import db.models  # noqa: F401 - register model metadata
from db.models.city import City
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.product import Product
from db.models.product_variant import ProductVariant
from db.models.user import User
from db.session import Base
from webapp.errors import ApiError, ErrorCode
from webapp.routes.admin import (
    admin_approve_product_request,
    admin_create_product_request,
    admin_create_staff_member,
    admin_reject_product_request,
)
from webapp.schemas import (
    CreateProductRequestRequest,
    CreateStaffMemberRequest,
    RejectProductRequestRequest,
)


class ProductRequestsContractTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)
        self.admin_tg_id = 50001
        self.admin_actor = User(tg_id=self.admin_tg_id, first_name="Admin")
        self.admin_ids_patch = patch("config.settings.ADMIN_IDS", [self.admin_tg_id])
        self.admin_ids_patch.start()

    async def asyncTearDown(self):
        self.admin_ids_patch.stop()
        await self.engine.dispose()

    async def _user(self, session, tg_id: int, first_name: str) -> User:
        user = User(tg_id=tg_id, first_name=first_name)
        session.add(user)
        await session.flush()
        return user

    async def _city_location(self, session, city_name="Wroclaw") -> tuple[City, Location]:
        city = City(name=city_name, slug=city_name.lower(), is_active=True)
        session.add(city)
        await session.flush()
        location = Location(city_id=city.id, name=f"{city_name} Center", address="Main 1", is_active=True)
        session.add(location)
        await session.flush()
        return city, location

    async def _product(self, session) -> Product:
        product = Product(
            name_ru="ELFBAR",
            name_pl="ELFBAR",
            name_uk="ELFBAR",
            base_price=Decimal("20.00"),
            is_active=True,
        )
        session.add(product)
        await session.flush()
        return product

    async def _variant(self, session, product: Product, name="Base") -> ProductVariant:
        variant = ProductVariant(
            product_id=product.id,
            name_ru=name,
            name_pl=name,
            name_uk=name,
        )
        session.add(variant)
        await session.flush()
        return variant

    async def _point_manager(self, session, user: User, location: Location):
        await admin_create_staff_member(
            CreateStaffMemberRequest(
                tg_id=user.tg_id,
                role="point_manager",
                city_ids=[],
                location_ids=[location.id],
            ),
            actor=self.admin_actor,
            session=session,
        )

    async def _city_curator(self, session, user: User, city: City):
        await admin_create_staff_member(
            CreateStaffMemberRequest(
                tg_id=user.tg_id,
                role="city_curator",
                city_ids=[city.id],
                location_ids=[],
            ),
            actor=self.admin_actor,
            session=session,
        )

    def _add_variant_body(self, location: Location, product: Product, quantity=3) -> CreateProductRequestRequest:
        return CreateProductRequestRequest(
            request_type="ADD_VARIANT",
            location_id=location.id,
            product_id=product.id,
            variant_name_ru="Blueberry",
            variant_name_pl="Blueberry",
            variant_name_uk="Blueberry",
            price_override=Decimal("21.50"),
            quantity=quantity,
        )

    async def test_point_manager_creates_add_variant_request_for_own_location(self):
        async with self.session_maker() as session:
            _, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 10001, "Manager")
            await self._point_manager(session, manager, location)

            created = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

        self.assertEqual(created.request_type, "ADD_VARIANT")
        self.assertEqual(created.status, "pending_review")
        self.assertEqual(created.location_id, location.id)
        self.assertEqual(created.product_id, product.id)
        self.assertEqual(created.requester_tg_id, manager.tg_id)

    async def test_point_manager_cannot_create_request_for_unassigned_location(self):
        async with self.session_maker() as session:
            _, own_location = await self._city_location(session, "Wroclaw")
            _, other_location = await self._city_location(session, "Warsaw")
            product = await self._product(session)
            manager = await self._user(session, 10002, "Manager")
            await self._point_manager(session, manager, own_location)

            with self.assertRaises(ApiError) as raised:
                await admin_create_product_request(
                    self._add_variant_body(other_location, product),
                    actor=manager,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCATION_FORBIDDEN)

    async def test_city_curator_approves_add_variant_in_assigned_city(self):
        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 10003, "Manager")
            curator = await self._user(session, 10004, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product, quantity=4),
                actor=manager,
                session=session,
            )

            approved = await admin_approve_product_request(request.id, actor=curator, session=session)
            stock_result = await session.execute(
                select(LocationStock).where(
                    LocationStock.location_id == location.id,
                    LocationStock.variant_id == approved.published_variant_id,
                )
            )
            stock = stock_result.scalar_one_or_none()
            variant = await session.get(ProductVariant, approved.published_variant_id)

        self.assertEqual(approved.status, "approved")
        self.assertEqual(approved.reviewer_tg_id, curator.tg_id)
        self.assertIsNotNone(variant)
        self.assertEqual(variant.name_ru, "Blueberry")
        self.assertIsNotNone(stock)
        self.assertEqual(stock.quantity, 4)

    async def test_project_admin_approves_request_in_any_city(self):
        async with self.session_maker() as session:
            _, location = await self._city_location(session, "Warsaw")
            product = await self._product(session)
            manager = await self._user(session, 10005, "Manager")
            await self._point_manager(session, manager, location)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            approved = await admin_approve_product_request(request.id, actor=self.admin_actor, session=session)

        self.assertEqual(approved.status, "approved")
        self.assertEqual(approved.reviewer_tg_id, self.admin_tg_id)

    async def test_city_curator_cannot_approve_request_in_unassigned_city(self):
        async with self.session_maker() as session:
            _, location = await self._city_location(session, "Warsaw")
            other_city, _ = await self._city_location(session, "Krakow")
            product = await self._product(session)
            manager = await self._user(session, 10012, "Manager")
            curator = await self._user(session, 10013, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, other_city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await admin_approve_product_request(request.id, actor=curator, session=session)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_REVIEW_PERMISSION_DENIED)

    async def test_reject_requires_reason(self):
        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 10006, "Manager")
            curator = await self._user(session, 10007, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await admin_reject_product_request(
                    request.id,
                    RejectProductRequestRequest(reason="  "),
                    actor=curator,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.code, ErrorCode.VALIDATION_REQUIRED)

    async def test_approve_add_stock_increments_existing_location_stock(self):
        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            variant = await self._variant(session, product)
            session.add(LocationStock(location_id=location.id, variant_id=variant.id, quantity=5))
            manager = await self._user(session, 10008, "Manager")
            curator = await self._user(session, 10009, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                CreateProductRequestRequest(
                    request_type="ADD_STOCK",
                    location_id=location.id,
                    product_id=product.id,
                    variant_id=variant.id,
                    quantity=6,
                ),
                actor=manager,
                session=session,
            )

            approved = await admin_approve_product_request(request.id, actor=curator, session=session)
            stock_result = await session.execute(
                select(LocationStock).where(
                    LocationStock.location_id == location.id,
                    LocationStock.variant_id == variant.id,
                )
            )
            stock = stock_result.scalar_one()

        self.assertEqual(approved.status, "approved")
        self.assertEqual(stock.quantity, 11)

    async def test_approved_request_cannot_be_approved_again(self):
        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            variant = await self._variant(session, product)
            session.add(LocationStock(location_id=location.id, variant_id=variant.id, quantity=5))
            manager = await self._user(session, 10010, "Manager")
            curator = await self._user(session, 10011, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                CreateProductRequestRequest(
                    request_type="ADD_STOCK",
                    location_id=location.id,
                    product_id=product.id,
                    variant_id=variant.id,
                    quantity=6,
                ),
                actor=manager,
                session=session,
            )

            await admin_approve_product_request(request.id, actor=curator, session=session)
            with self.assertRaises(ApiError) as raised:
                await admin_approve_product_request(request.id, actor=curator, session=session)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_TRANSITION_INVALID)

    def test_create_product_request_rejects_negative_price_override(self):
        with self.assertRaises(ValidationError):
            CreateProductRequestRequest(
                request_type="ADD_VARIANT",
                location_id=1,
                product_id=1,
                variant_name_ru="Blueberry",
                price_override=Decimal("-1.00"),
                quantity=1,
            )

    def test_approve_uses_row_lock_for_pending_request_transition(self):
        source = inspect.getsource(admin_approve_product_request)
        self.assertIn("with_for_update", source)


if __name__ == "__main__":
    unittest.main()

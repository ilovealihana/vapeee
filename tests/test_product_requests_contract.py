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
from db.models.product_request import ProductRequest
from db.models.product_variant import ProductVariant
from db.models.user import User
from db.session import Base
from webapp.errors import ApiError, ErrorCode
from webapp.routes.admin import (
    admin_approve_product_request,
    admin_create_product_request,
    admin_create_staff_member,
    admin_edit_product_request,
    admin_request_product_request_changes,
    admin_reject_product_request,
)
from webapp.schemas import (
    CreateProductRequestRequest,
    CreateStaffMemberRequest,
    RejectProductRequestRequest,
    UpdateProductRequestReviewRequest,
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

    async def _move_request_to_need_changes(self, session, request_id: int, curator: User, comment="Fix request"):
        from webapp.services.product_request_lifecycle import lock_product_request

        await lock_product_request(request_id, actor=curator, session=session)
        return await admin_request_product_request_changes(
            request_id,
            RejectProductRequestRequest(comment=comment),
            actor=curator,
            session=session,
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

    async def test_city_curator_can_lock_assigned_city_request(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11001, "Manager")
            curator = await self._user(session, 11002, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            locked = await lock_product_request(request.id, actor=curator, session=session)

        self.assertEqual(locked.locked_by_tg_id, curator.tg_id)
        self.assertIsNotNone(locked.locked_at)

    async def test_city_curator_cannot_lock_unassigned_city_request(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            _, location = await self._city_location(session, "Warsaw")
            other_city, _ = await self._city_location(session, "Krakow")
            product = await self._product(session)
            manager = await self._user(session, 11003, "Manager")
            curator = await self._user(session, 11004, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, other_city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await lock_product_request(request.id, actor=curator, session=session)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_REVIEW_PERMISSION_DENIED)

    async def test_point_manager_cannot_lock_product_request(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            _, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11005, "Manager")
            await self._point_manager(session, manager, location)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await lock_product_request(request.id, actor=manager, session=session)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_REVIEW_PERMISSION_DENIED)

    async def test_non_owner_curator_cannot_release_another_reviewer_lock(self):
        from webapp.services.product_request_lifecycle import lock_product_request, release_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11006, "Manager")
            owner = await self._user(session, 11007, "Owner")
            other = await self._user(session, 11008, "Other")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, owner, city)
            await self._city_curator(session, other, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=owner, session=session)

            with self.assertRaises(ApiError) as raised:
                await release_product_request(request.id, actor=other, session=session)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCK_NOT_OWNER)

    async def test_project_admin_can_release_another_reviewer_lock(self):
        from webapp.services.product_request_lifecycle import lock_product_request, release_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11009, "Manager")
            curator = await self._user(session, 11010, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            released = await release_product_request(request.id, actor=self.admin_actor, session=session)

        self.assertIsNone(released.locked_by_tg_id)
        self.assertIsNone(released.locked_at)

    async def test_project_admin_can_explicitly_take_over_lock(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11011, "Manager")
            curator = await self._user(session, 11012, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            locked = await lock_product_request(request.id, actor=self.admin_actor, session=session)

        self.assertEqual(locked.locked_by_tg_id, self.admin_tg_id)

    async def test_city_curator_cannot_lock_request_owned_by_another_reviewer(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11018, "Manager")
            owner = await self._user(session, 11019, "Owner")
            other = await self._user(session, 11020, "Other")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, owner, city)
            await self._city_curator(session, other, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=owner, session=session)

            with self.assertRaises(ApiError) as raised:
                await lock_product_request(request.id, actor=other, session=session)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCK_EXISTS)

    async def test_lock_by_same_reviewer_is_idempotent(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11021, "Manager")
            curator = await self._user(session, 11022, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            first_lock = await lock_product_request(request.id, actor=curator, session=session)
            first_locked_at = first_lock.locked_at

            second_lock = await lock_product_request(request.id, actor=curator, session=session)

        self.assertEqual(second_lock.locked_by_tg_id, curator.tg_id)
        self.assertEqual(second_lock.locked_at, first_locked_at)

    async def test_lock_emits_product_request_locked_event(self):
        from webapp.services import product_request_events
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11013, "Manager")
            curator = await self._user(session, 11014, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            with patch("webapp.services.product_request_events.emit_product_request_event") as emit:
                await lock_product_request(request.id, actor=curator, session=session)

        emit.assert_called_once()
        event_type, context = emit.call_args.args
        self.assertEqual(event_type, product_request_events.PRODUCT_REQUEST_LOCKED)
        self.assertEqual(context.request_id, request.id)
        self.assertEqual(context.actor_tg_id, curator.tg_id)

    async def test_release_emits_product_request_released_event(self):
        from webapp.services import product_request_events
        from webapp.services.product_request_lifecycle import lock_product_request, release_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11015, "Manager")
            curator = await self._user(session, 11016, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            with patch("webapp.services.product_request_events.emit_product_request_event") as emit:
                await release_product_request(request.id, actor=curator, session=session)

        emit.assert_called_once()
        event_type, context = emit.call_args.args
        self.assertEqual(event_type, product_request_events.PRODUCT_REQUEST_RELEASED)
        self.assertEqual(context.request_id, request.id)
        self.assertEqual(context.actor_tg_id, curator.tg_id)

    async def test_create_emits_product_request_created_event(self):
        from webapp.services import product_request_events

        async with self.session_maker() as session:
            _, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 11017, "Manager")
            await self._point_manager(session, manager, location)

            with patch("webapp.services.product_request_events.emit_product_request_event") as emit:
                created = await admin_create_product_request(
                    self._add_variant_body(location, product),
                    actor=manager,
                    session=session,
                )

        emit.assert_called_once()
        event_type, context = emit.call_args.args
        self.assertEqual(event_type, product_request_events.PRODUCT_REQUEST_CREATED)
        self.assertEqual(context.request_id, created.id)
        self.assertEqual(context.actor_tg_id, manager.tg_id)

    def test_product_request_event_hook_does_not_import_or_call_telegram_sender(self):
        source_path = "webapp/services/product_request_events.py"
        with open(source_path, "r", encoding="utf-8") as source_file:
            source = source_file.read()

        self.assertNotIn("TelegramNotificationSender", source)
        self.assertNotIn("api.telegram.org", source)

    async def test_city_curator_approves_add_variant_in_assigned_city(self):
        from webapp.services.product_request_lifecycle import lock_product_request

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
            await lock_product_request(request.id, actor=curator, session=session)

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
        from webapp.services.product_request_lifecycle import lock_product_request

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
            await lock_product_request(request.id, actor=self.admin_actor, session=session)

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

    async def test_approve_without_lock_returns_lock_required(self):
        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12001, "Manager")
            curator = await self._user(session, 12002, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await admin_approve_product_request(request.id, actor=curator, session=session)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCK_REQUIRED)

    async def test_reject_without_lock_returns_lock_required(self):
        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12003, "Manager")
            curator = await self._user(session, 12004, "Curator")
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
                    RejectProductRequestRequest(reason="No stock card"),
                    actor=curator,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCK_REQUIRED)

    async def test_request_changes_without_lock_returns_lock_required(self):
        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12005, "Manager")
            curator = await self._user(session, 12006, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await admin_request_product_request_changes(
                    request.id,
                    RejectProductRequestRequest(reason="Add SKU photo"),
                    actor=curator,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCK_REQUIRED)

    async def test_lock_owner_approves_and_verdict_clears_lock(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12007, "Manager")
            curator = await self._user(session, 12008, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            approved = await admin_approve_product_request(request.id, actor=curator, session=session)

        self.assertEqual(approved.status, "approved")
        self.assertIsNone(approved.locked_by_tg_id)
        self.assertIsNone(approved.locked_at)

    async def test_lock_owner_rejects_and_verdict_clears_lock(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12009, "Manager")
            curator = await self._user(session, 12010, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            rejected = await admin_reject_product_request(
                request.id,
                RejectProductRequestRequest(reason="Duplicate"),
                actor=curator,
                session=session,
            )

        self.assertEqual(rejected.status, "rejected")
        self.assertEqual(rejected.reject_reason, "Duplicate")
        self.assertEqual(rejected.review_comment, "Duplicate")
        self.assertIsNone(rejected.locked_by_tg_id)
        self.assertIsNone(rejected.locked_at)

    async def test_reject_accepts_comment_payload(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12011, "Manager")
            curator = await self._user(session, 12012, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            rejected = await admin_reject_product_request(
                request.id,
                RejectProductRequestRequest(comment="Need product proof"),
                actor=curator,
                session=session,
            )

        self.assertEqual(rejected.status, "rejected")
        self.assertEqual(rejected.review_comment, "Need product proof")

    async def test_reject_empty_comment_returns_comment_required(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12013, "Manager")
            curator = await self._user(session, 12014, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            with self.assertRaises(ApiError) as raised:
                await admin_reject_product_request(
                    request.id,
                    RejectProductRequestRequest(comment="  "),
                    actor=curator,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_COMMENT_REQUIRED)

    async def test_request_changes_requires_comment_sets_need_changes_and_clears_lock(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12015, "Manager")
            curator = await self._user(session, 12016, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            changed = await admin_request_product_request_changes(
                request.id,
                RejectProductRequestRequest(comment="Fix quantity"),
                actor=curator,
                session=session,
            )

        self.assertEqual(changed.status, "need_changes")
        self.assertEqual(changed.review_comment, "Fix quantity")
        self.assertIsNone(changed.reject_reason)
        self.assertIsNone(changed.locked_by_tg_id)
        self.assertIsNone(changed.locked_at)

    async def test_request_changes_empty_comment_returns_comment_required(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12017, "Manager")
            curator = await self._user(session, 12018, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            with self.assertRaises(ApiError) as raised:
                await admin_request_product_request_changes(
                    request.id,
                    RejectProductRequestRequest(comment=" "),
                    actor=curator,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_COMMENT_REQUIRED)

    async def test_project_admin_cannot_verdict_another_reviewer_lock_without_takeover(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12019, "Manager")
            curator = await self._user(session, 12020, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            with self.assertRaises(ApiError) as raised:
                await admin_approve_product_request(request.id, actor=self.admin_actor, session=session)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCK_REQUIRED)

    async def test_project_admin_cannot_reject_another_reviewer_lock_without_takeover(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12023, "Manager")
            curator = await self._user(session, 12024, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            with self.assertRaises(ApiError) as raised:
                await admin_reject_product_request(
                    request.id,
                    RejectProductRequestRequest(reason="No"),
                    actor=self.admin_actor,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCK_REQUIRED)

    async def test_project_admin_cannot_request_changes_on_another_reviewer_lock_without_takeover(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12025, "Manager")
            curator = await self._user(session, 12026, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)

            with self.assertRaises(ApiError) as raised:
                await admin_request_product_request_changes(
                    request.id,
                    RejectProductRequestRequest(comment="Fix"),
                    actor=self.admin_actor,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_LOCK_REQUIRED)

    async def test_reject_requires_reason(self):
        from webapp.services.product_request_lifecycle import lock_product_request

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
            await lock_product_request(request.id, actor=curator, session=session)

            with self.assertRaises(ApiError) as raised:
                await admin_reject_product_request(
                    request.id,
                    RejectProductRequestRequest(reason="  "),
                    actor=curator,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_COMMENT_REQUIRED)

    async def test_approve_add_stock_increments_existing_location_stock(self):
        from webapp.services.product_request_lifecycle import lock_product_request

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
            await lock_product_request(request.id, actor=curator, session=session)

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
        from webapp.services.product_request_lifecycle import lock_product_request

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

            await lock_product_request(request.id, actor=curator, session=session)
            await admin_approve_product_request(request.id, actor=curator, session=session)
            with self.assertRaises(ApiError) as raised:
                await admin_approve_product_request(request.id, actor=curator, session=session)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_TRANSITION_INVALID)

    async def test_rejected_request_rejects_request_changes(self):
        from webapp.services.product_request_lifecycle import lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 12021, "Manager")
            curator = await self._user(session, 12022, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(request.id, actor=curator, session=session)
            await admin_reject_product_request(
                request.id,
                RejectProductRequestRequest(reason="No"),
                actor=curator,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await admin_request_product_request_changes(
                    request.id,
                    RejectProductRequestRequest(comment="Again"),
                    actor=curator,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_TRANSITION_INVALID)

    async def test_original_point_manager_can_edit_own_need_changes_request(self):
        from webapp.services.product_request_lifecycle import edit_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 13001, "Manager")
            curator = await self._user(session, 13002, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator, "Fix names")

            edited = await edit_product_request(
                request.id,
                UpdateProductRequestReviewRequest(variant_name_ru="Mint", quantity=8),
                actor=manager,
                session=session,
            )

        self.assertEqual(edited.status, "pending_review")
        self.assertEqual(edited.variant_name_ru, "Mint")
        self.assertEqual(edited.quantity, 8)
        self.assertEqual(edited.review_comment, "Fix names")
        self.assertIsNone(edited.locked_by_tg_id)

    async def test_patch_route_delegates_need_changes_edit(self):
        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 13020, "Manager")
            curator = await self._user(session, 13021, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator)

            edited = await admin_edit_product_request(
                request.id,
                UpdateProductRequestReviewRequest(quantity=6),
                actor=manager,
                session=session,
            )

        self.assertEqual(edited.status, "pending_review")
        self.assertEqual(edited.quantity, 6)

    async def test_city_curator_can_edit_need_changes_request_in_assigned_city(self):
        from webapp.services.product_request_lifecycle import edit_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 13003, "Manager")
            curator = await self._user(session, 13004, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator)

            edited = await edit_product_request(
                request.id,
                UpdateProductRequestReviewRequest(quantity=5),
                actor=curator,
                session=session,
            )

        self.assertEqual(edited.status, "pending_review")
        self.assertEqual(edited.quantity, 5)

    async def test_project_admin_can_edit_need_changes_request(self):
        from webapp.services.product_request_lifecycle import edit_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 13005, "Manager")
            curator = await self._user(session, 13006, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator)

            edited = await edit_product_request(
                request.id,
                UpdateProductRequestReviewRequest(quantity=9),
                actor=self.admin_actor,
                session=session,
            )

        self.assertEqual(edited.status, "pending_review")
        self.assertEqual(edited.quantity, 9)

    async def test_another_point_manager_cannot_edit_need_changes_request(self):
        from webapp.services.product_request_lifecycle import edit_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            _, other_location = await self._city_location(session, "Warsaw")
            product = await self._product(session)
            manager = await self._user(session, 13007, "Manager")
            other_manager = await self._user(session, 13008, "Other")
            curator = await self._user(session, 13009, "Curator")
            await self._point_manager(session, manager, location)
            await self._point_manager(session, other_manager, other_location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator)

            with self.assertRaises(ApiError) as raised:
                await edit_product_request(
                    request.id,
                    UpdateProductRequestReviewRequest(quantity=2),
                    actor=other_manager,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED)

    async def test_edit_is_blocked_when_need_changes_request_is_locked(self):
        from webapp.services.product_request_lifecycle import edit_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 13010, "Manager")
            curator = await self._user(session, 13011, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator)
            db_request = await session.get(ProductRequest, request.id)
            db_request.locked_by_tg_id = curator.tg_id
            await session.commit()

            with self.assertRaises(ApiError) as raised:
                await edit_product_request(
                    request.id,
                    UpdateProductRequestReviewRequest(quantity=2),
                    actor=manager,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_EDIT_LOCKED)

    async def test_edit_add_stock_changes_only_quantity(self):
        from webapp.services.product_request_lifecycle import edit_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            variant = await self._variant(session, product)
            manager = await self._user(session, 13012, "Manager")
            curator = await self._user(session, 13013, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                CreateProductRequestRequest(
                    request_type="ADD_STOCK",
                    location_id=location.id,
                    product_id=product.id,
                    variant_id=variant.id,
                    quantity=3,
                ),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator)

            edited = await edit_product_request(
                request.id,
                UpdateProductRequestReviewRequest(variant_name_ru="Ignored", price_override=Decimal("1.00"), quantity=7),
                actor=manager,
                session=session,
            )

        self.assertEqual(edited.status, "pending_review")
        self.assertEqual(edited.quantity, 7)
        self.assertIsNone(edited.variant_name_ru)
        self.assertIsNone(edited.price_override)

    def test_update_product_request_review_rejects_forbidden_fields(self):
        for field_name, value in {
            "product_id": 1,
            "location_id": 1,
            "request_type": "ADD_STOCK",
            "variant_id": 1,
        }.items():
            with self.subTest(field_name=field_name):
                with self.assertRaises(ValidationError):
                    UpdateProductRequestReviewRequest(**{field_name: value})

    async def test_edit_add_variant_rejects_explicit_null_variant_names(self):
        from webapp.services.product_request_lifecycle import edit_product_request

        for index, field_name in enumerate(("variant_name_ru", "variant_name_pl", "variant_name_uk"), start=1):
            async with self.session_maker() as session:
                city, location = await self._city_location(session, f"NullName{index}")
                product = await self._product(session)
                manager = await self._user(session, 13020 + index * 2, "Manager")
                curator = await self._user(session, 13021 + index * 2, "Curator")
                await self._point_manager(session, manager, location)
                await self._city_curator(session, curator, city)
                request = await admin_create_product_request(
                    self._add_variant_body(location, product),
                    actor=manager,
                    session=session,
                )
                await self._move_request_to_need_changes(session, request.id, curator)

                with self.assertRaises(ApiError) as raised:
                    await edit_product_request(
                        request.id,
                        UpdateProductRequestReviewRequest(**{field_name: None}),
                        actor=manager,
                        session=session,
                    )

            self.assertEqual(raised.exception.status_code, 422)
            self.assertEqual(raised.exception.code, ErrorCode.PRODUCT_REQUEST_VARIANT_NAME_REQUIRED)

    async def test_edit_price_override_null_clears_override_and_omitted_preserves(self):
        from webapp.services.product_request_lifecycle import edit_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 13014, "Manager")
            curator = await self._user(session, 13015, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator)
            edited = await edit_product_request(
                request.id,
                UpdateProductRequestReviewRequest(quantity=4),
                actor=manager,
                session=session,
            )
            self.assertEqual(edited.price_override, Decimal("21.50"))
            await self._move_request_to_need_changes(session, request.id, curator)

            cleared = await edit_product_request(
                request.id,
                UpdateProductRequestReviewRequest(price_override=None),
                actor=manager,
                session=session,
            )

        self.assertIsNone(cleared.price_override)

    async def test_successful_edit_emits_product_request_updated(self):
        from webapp.services import product_request_events
        from webapp.services.product_request_lifecycle import edit_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 13016, "Manager")
            curator = await self._user(session, 13017, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await self._move_request_to_need_changes(session, request.id, curator)

            with patch("webapp.services.product_request_events.emit_product_request_event") as emit:
                await edit_product_request(
                    request.id,
                    UpdateProductRequestReviewRequest(quantity=4),
                    actor=manager,
                    session=session,
                )

        emit.assert_called_once()
        event_type, context = emit.call_args.args
        self.assertEqual(event_type, product_request_events.PRODUCT_REQUEST_UPDATED)
        self.assertEqual(context.request_id, request.id)

    async def test_edit_pending_or_final_request_returns_transition_invalid(self):
        from webapp.services.product_request_lifecycle import edit_product_request, lock_product_request

        async with self.session_maker() as session:
            city, location = await self._city_location(session)
            product = await self._product(session)
            manager = await self._user(session, 13018, "Manager")
            curator = await self._user(session, 13019, "Curator")
            await self._point_manager(session, manager, location)
            await self._city_curator(session, curator, city)
            pending = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            approved_request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(approved_request.id, actor=curator, session=session)
            await admin_approve_product_request(approved_request.id, actor=curator, session=session)
            rejected_request = await admin_create_product_request(
                self._add_variant_body(location, product),
                actor=manager,
                session=session,
            )
            await lock_product_request(rejected_request.id, actor=curator, session=session)
            await admin_reject_product_request(
                rejected_request.id,
                RejectProductRequestRequest(reason="No"),
                actor=curator,
                session=session,
            )

            for request in (pending, approved_request, rejected_request):
                with self.assertRaises(ApiError) as raised:
                    await edit_product_request(
                        request.id,
                        UpdateProductRequestReviewRequest(quantity=4),
                        actor=manager,
                        session=session,
                    )
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
        from webapp.services import product_request_lifecycle

        approve_source = inspect.getsource(product_request_lifecycle.approve_product_request)
        source = inspect.getsource(product_request_lifecycle._load_product_request_for_update)
        self.assertIn("_load_product_request_for_update", approve_source)
        self.assertIn("with_for_update", source)


if __name__ == "__main__":
    unittest.main()

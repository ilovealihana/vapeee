import unittest
from unittest.mock import patch

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import db.models  # noqa: F401
from db.models.city import City
from db.models.location import Location
from db.models.user import User
from db.session import Base
from webapp.errors import ApiError, ErrorCode
from webapp.routes.admin import (
    admin_create_staff_member,
    admin_delete_staff_member,
    admin_get_access,
    admin_list_staff_members,
    admin_update_staff_member,
)
from webapp.schemas import CreateStaffMemberRequest, UpdateStaffMemberRequest


class AdminStaffContractTest(unittest.IsolatedAsyncioTestCase):
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

    async def test_create_city_curator_with_multiple_cities(self):
        async with self.session_maker() as session:
            city_a = City(name="Wroclaw", slug="wroclaw", is_active=True)
            city_b = City(name="Warsaw", slug="warsaw", is_active=True)
            session.add_all([city_a, city_b])
            await session.flush()

            created = await admin_create_staff_member(
                CreateStaffMemberRequest(
                    tg_id=10001,
                    role="city_curator",
                    city_ids=[city_a.id, city_b.id],
                    location_ids=[],
                ),
                actor=self.admin_actor,
                session=session,
            )

        self.assertEqual(created.tg_id, 10001)
        self.assertEqual(created.role, "city_curator")
        self.assertEqual([item.city_id for item in created.assignments], [city_a.id, city_b.id])
        self.assertEqual([item.location_id for item in created.assignments], [None, None])

    async def test_create_point_manager_requires_locations(self):
        async with self.session_maker() as session:
            with self.assertRaises(ApiError) as raised:
                await admin_create_staff_member(
                    CreateStaffMemberRequest(tg_id=10002, role="point_manager", city_ids=[], location_ids=[]),
                    actor=self.admin_actor,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.code, ErrorCode.STAFF_LOCATION_REQUIRED)

    async def test_duplicate_assignment_is_rejected(self):
        async with self.session_maker() as session:
            city = City(name="Wroclaw", slug="wroclaw", is_active=True)
            session.add(city)
            await session.flush()

            with self.assertRaises(ApiError) as raised:
                await admin_create_staff_member(
                    CreateStaffMemberRequest(
                        tg_id=10003,
                        role="city_curator",
                        city_ids=[city.id, city.id],
                        location_ids=[],
                    ),
                    actor=self.admin_actor,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.STAFF_ASSIGNMENT_DUPLICATE)

    async def test_update_replaces_single_role_and_assignments(self):
        async with self.session_maker() as session:
            city = City(name="Wroclaw", slug="wroclaw", is_active=True)
            session.add(city)
            await session.flush()
            location = Location(city_id=city.id, name="Center", address="Main 1", is_active=True)
            session.add(location)
            await session.flush()

            created = await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10004, role="city_curator", city_ids=[city.id], location_ids=[]),
                actor=self.admin_actor,
                session=session,
            )

            updated = await admin_update_staff_member(
                created.id,
                UpdateStaffMemberRequest(role="point_manager", is_active=True, city_ids=[], location_ids=[location.id]),
                actor=self.admin_actor,
                session=session,
            )

        self.assertEqual(updated.role, "point_manager")
        self.assertEqual(len(updated.assignments), 1)
        self.assertEqual(updated.assignments[0].location_id, location.id)
        self.assertIsNone(updated.assignments[0].city_id)

    async def test_update_replaces_assignments_without_repeating_role(self):
        async with self.session_maker() as session:
            city_a = City(name="Wroclaw", slug="wroclaw", is_active=True)
            city_b = City(name="Warsaw", slug="warsaw", is_active=True)
            session.add_all([city_a, city_b])
            await session.flush()

            created = await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10012, role="city_curator", city_ids=[city_a.id], location_ids=[]),
                actor=self.admin_actor,
                session=session,
            )

            updated = await admin_update_staff_member(
                created.id,
                UpdateStaffMemberRequest(city_ids=[city_b.id]),
                actor=self.admin_actor,
                session=session,
            )

        self.assertEqual(updated.role, "city_curator")
        self.assertEqual([assignment.city_id for assignment in updated.assignments], [city_b.id])

    async def test_bootstrap_admin_cannot_be_deactivated(self):
        async with self.session_maker() as session:
            created = await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=self.admin_tg_id, role="project_admin", city_ids=[], location_ids=[]),
                actor=self.admin_actor,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await admin_delete_staff_member(created.id, actor=self.admin_actor, session=session)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.code, ErrorCode.STAFF_CANNOT_DELETE_PROTECTED_ADMIN)

    async def test_bootstrap_admin_cannot_be_created_below_project_admin(self):
        async with self.session_maker() as session:
            city = City(name="Wroclaw", slug="wroclaw", is_active=True)
            session.add(city)
            await session.flush()

            with self.assertRaises(ApiError) as raised:
                await admin_create_staff_member(
                    CreateStaffMemberRequest(
                        tg_id=self.admin_tg_id,
                        role="city_curator",
                        city_ids=[city.id],
                        location_ids=[],
                    ),
                    actor=self.admin_actor,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.code, ErrorCode.STAFF_CANNOT_DELETE_PROTECTED_ADMIN)

    async def test_non_project_admin_actor_cannot_manage_staff(self):
        async with self.session_maker() as session:
            actor = User(tg_id=20001, first_name="Curator")

            with self.assertRaises(ApiError) as raised:
                await admin_create_staff_member(
                    CreateStaffMemberRequest(tg_id=10006, role="inpost_curator", city_ids=[], location_ids=[]),
                    actor=actor,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.code, ErrorCode.STAFF_PROJECT_ADMIN_REQUIRED)

    async def test_staff_project_admin_access_is_reported_from_database(self):
        async with self.session_maker() as session:
            member = await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10013, role="project_admin", city_ids=[], location_ids=[]),
                actor=self.admin_actor,
                session=session,
            )
            with patch("config.settings.ADMIN_IDS", []):
                actor = User(tg_id=member.tg_id, first_name="DbAdmin")

                access = await admin_get_access(actor=actor, session=session)

        self.assertTrue(access.has_access)
        self.assertEqual(access.role, "project_admin")

    async def test_active_duplicate_tg_id_is_rejected(self):
        async with self.session_maker() as session:
            await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10007, role="inpost_curator", city_ids=[], location_ids=[]),
                actor=self.admin_actor,
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await admin_create_staff_member(
                    CreateStaffMemberRequest(tg_id=10007, role="project_admin", city_ids=[], location_ids=[]),
                    actor=self.admin_actor,
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.STAFF_ASSIGNMENT_DUPLICATE)

    async def test_inactive_tg_id_is_reactivated_with_replaced_role(self):
        async with self.session_maker() as session:
            created = await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10008, role="inpost_curator", city_ids=[], location_ids=[]),
                actor=self.admin_actor,
                session=session,
            )
            await admin_update_staff_member(
                created.id,
                UpdateStaffMemberRequest(is_active=False),
                actor=self.admin_actor,
                session=session,
            )

            reactivated = await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10008, role="project_admin", city_ids=[], location_ids=[]),
                actor=self.admin_actor,
                session=session,
            )

        self.assertEqual(reactivated.id, created.id)
        self.assertEqual(reactivated.role, "project_admin")
        self.assertTrue(reactivated.is_active)

    async def test_invalid_tg_id_role_and_missing_assignment_targets_are_rejected(self):
        async with self.session_maker() as session:
            cases = [
                (
                    CreateStaffMemberRequest(tg_id=0, role="project_admin", city_ids=[], location_ids=[]),
                    ErrorCode.STAFF_TG_ID_REQUIRED,
                ),
                (
                    CreateStaffMemberRequest(tg_id=-1, role="project_admin", city_ids=[], location_ids=[]),
                    ErrorCode.STAFF_INVALID_TG_ID,
                ),
                (
                    CreateStaffMemberRequest(tg_id=10009, role="unknown", city_ids=[], location_ids=[]),
                    ErrorCode.STAFF_ROLE_INVALID,
                ),
                (
                    CreateStaffMemberRequest(tg_id=10010, role="city_curator", city_ids=[999], location_ids=[]),
                    ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND,
                ),
                (
                    CreateStaffMemberRequest(tg_id=10011, role="point_manager", city_ids=[], location_ids=[999]),
                    ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND,
                ),
            ]

            for body, code in cases:
                with self.assertRaises(ApiError) as raised:
                    await admin_create_staff_member(body, actor=self.admin_actor, session=session)
                self.assertEqual(raised.exception.code, code)

    async def test_list_staff_members_returns_assignment_summary(self):
        async with self.session_maker() as session:
            await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10005, role="inpost_curator", city_ids=[], location_ids=[]),
                actor=self.admin_actor,
                session=session,
            )

            rows = await admin_list_staff_members(actor=self.admin_actor, session=session)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].role, "inpost_curator")
        self.assertEqual(rows[0].assignments, [])


if __name__ == "__main__":
    unittest.main()

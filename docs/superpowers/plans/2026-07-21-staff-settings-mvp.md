# Staff/settings MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent staff management so project admins can assign Telegram users one role and the correct city/location scope.

**Architecture:** Add new staff tables and models beside the legacy `admins` table, expose `/api/admin/staff` CRUD routes under the existing admin router, and wire a new Staff page into the current admin CMS frontend. Staff CRUD uses a project-admin dependency that accepts either bootstrap `ADMIN_IDS` or an active `project_admin` staff row.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, Pydantic, unittest, React, TypeScript, static Node tests.

---

## File Structure

- Create `db/models/staff.py`: SQLAlchemy models and role constants for `StaffMember` and `StaffAssignment`.
- Modify `db/models/__init__.py`: register staff models for metadata and Alembic.
- Create `alembic/versions/0002_staff_assignments.py`: migration for staff tables and constraints.
- Modify `webapp/schemas.py`: add staff request/response schemas.
- Modify `webapp/deps.py`: add project-admin dependency for staff management.
- Modify `webapp/routes/admin.py`: add staff API route handlers and validation helpers.
- Create `tests/test_admin_staff_contract.py`: backend contract tests.
- Create `tests/test_staff_migration.py`: Alembic upgrade/downgrade contract tests.
- Modify `frontend/src/api/admin.ts`: add staff types and methods.
- Create `frontend/src/pages/admin/AdminStaff.tsx`: staff management screen.
- Modify `frontend/src/pages/admin/AdminLayout.tsx`: add Staff tab.
- Modify `frontend/src/App.tsx`: add `/admin/staff` route.
- Modify `frontend/src/i18n/locales/ru.ts`: add Russian staff UI keys.
- Modify `frontend/tests/adminCms.test.mjs`: add static wiring tests for Staff UI.

---

### Task 1: Backend Staff Contract Tests

**Files:**
- Create: `tests/test_admin_staff_contract.py`

- [ ] **Step 1: Write failing backend tests**

Create `tests/test_admin_staff_contract.py` with tests that call route functions directly, matching existing admin tests:

```python
import unittest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from unittest.mock import patch

import db.models  # noqa: F401
from db.models.city import City
from db.models.location import Location
from db.models.user import User
from db.session import Base
from webapp.errors import ApiError, ErrorCode
from webapp.routes.admin import (
    admin_create_staff_member,
    admin_delete_staff_member,
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

    async def asyncTearDown(self):
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
                actor=object(),
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
                    actor=object(),
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
                    actor=object(),
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
                actor=object(),
                session=session,
            )

            updated = await admin_update_staff_member(
                created.id,
                UpdateStaffMemberRequest(role="point_manager", is_active=True, city_ids=[], location_ids=[location.id]),
                actor=object(),
                session=session,
            )

            self.assertEqual(updated.role, "point_manager")
            self.assertEqual(len(updated.assignments), 1)
            self.assertEqual(updated.assignments[0].location_id, location.id)
            self.assertIsNone(updated.assignments[0].city_id)

    async def test_bootstrap_admin_cannot_be_deactivated(self):
        async with self.session_maker() as session:
            protected_tg_id = 123456789
            actor = User(tg_id=protected_tg_id, first_name="Admin")

            with patch("config.settings.ADMIN_IDS", [protected_tg_id]):
                created = await admin_create_staff_member(
                    CreateStaffMemberRequest(tg_id=protected_tg_id, role="project_admin", city_ids=[], location_ids=[]),
                    actor=actor,
                    session=session,
                )

                with self.assertRaises(ApiError) as raised:
                    await admin_delete_staff_member(created.id, actor=actor, session=session)

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

    async def test_active_duplicate_tg_id_is_rejected(self):
        async with self.session_maker() as session:
            await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10007, role="inpost_curator", city_ids=[], location_ids=[]),
                actor=object(),
                session=session,
            )

            with self.assertRaises(ApiError) as raised:
                await admin_create_staff_member(
                    CreateStaffMemberRequest(tg_id=10007, role="project_admin", city_ids=[], location_ids=[]),
                    actor=object(),
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, ErrorCode.STAFF_ASSIGNMENT_DUPLICATE)

    async def test_inactive_tg_id_is_reactivated_with_replaced_role(self):
        async with self.session_maker() as session:
            created = await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10008, role="inpost_curator", city_ids=[], location_ids=[]),
                actor=object(),
                session=session,
            )
            await admin_update_staff_member(
                created.id,
                UpdateStaffMemberRequest(is_active=False),
                actor=object(),
                session=session,
            )

            reactivated = await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10008, role="project_admin", city_ids=[], location_ids=[]),
                actor=object(),
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
                    await admin_create_staff_member(body, actor=object(), session=session)
                self.assertEqual(raised.exception.code, code)

    async def test_list_staff_members_returns_assignment_summary(self):
        async with self.session_maker() as session:
            await admin_create_staff_member(
                CreateStaffMemberRequest(tg_id=10005, role="inpost_curator", city_ids=[], location_ids=[]),
                actor=object(),
                session=session,
            )

            rows = await admin_list_staff_members(actor=object(), session=session)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].role, "inpost_curator")
        self.assertEqual(rows[0].assignments, [])
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
python -m unittest tests.test_admin_staff_contract -v
```

Expected: FAIL because `admin_create_staff_member`, staff schemas and models do not exist yet.

---

### Task 1B: Staff Alembic Migration Contract Test

**Files:**
- Create: `tests/test_staff_migration.py`

- [ ] **Step 1: Write failing migration test**

Create `tests/test_staff_migration.py`:

```python
import os
import tempfile
import unittest

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


class StaffMigrationTest(unittest.TestCase):
    def test_staff_migration_upgrade_and_downgrade(self):
        db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        db_file.close()
        url = f"sqlite:///{db_file.name}"
        engine = None
        try:
            cfg = Config("alembic.ini")
            cfg.set_main_option("sqlalchemy.url", url)

            command.upgrade(cfg, "head")
            engine = create_engine(url)
            inspector = inspect(engine)
            self.assertIn("staff_members", inspector.get_table_names())
            self.assertIn("staff_assignments", inspector.get_table_names())

            with engine.begin() as conn:
                conn.execute(text("PRAGMA foreign_keys=ON"))
                with self.assertRaises(Exception):
                    conn.execute(
                        text(
                            "INSERT INTO staff_assignments "
                            "(staff_member_id, city_id, location_id) VALUES (1, NULL, NULL)"
                        )
                    )

            engine.dispose()
            engine = None
            command.downgrade(cfg, "0001")
            engine = create_engine(url)
            inspector = inspect(engine)
            self.assertNotIn("staff_members", inspector.get_table_names())
            self.assertNotIn("staff_assignments", inspector.get_table_names())
        finally:
            if engine is not None:
                engine.dispose()
            os.unlink(db_file.name)
```

- [ ] **Step 2: Run migration test and verify RED**

Run:

```powershell
python -m unittest tests.test_staff_migration -v
```

Expected: FAIL because migration `0002_staff_assignments.py` does not exist yet.

---

### Task 2: Backend Staff Models, Schemas and API

**Files:**
- Create: `db/models/staff.py`
- Create: `alembic/versions/0002_staff_assignments.py`
- Modify: `db/models/__init__.py`
- Modify: `webapp/schemas.py`
- Modify: `webapp/deps.py`
- Modify: `webapp/routes/admin.py`

- [ ] **Step 1: Add SQLAlchemy models**

Create models with one role on `StaffMember` and assignment rows on `StaffAssignment`. Use string role constants:

```python
STAFF_ROLES = {"project_admin", "city_curator", "point_manager", "inpost_curator"}
```

Relationships should use `cascade="all, delete-orphan"` so replacing assignment rows is straightforward.

- [ ] **Step 2: Add Alembic migration**

Create `0002_staff_assignments.py` with `staff_members` and `staff_assignments`, indexes on `tg_id`, `staff_member_id`, `city_id`, `location_id`, and unique constraints for `(staff_member_id, city_id)` and `(staff_member_id, location_id)`.

Migration requirements:

- `revision = "0002"` and `down_revision = "0001"`;
- `staff_members.tg_id` is unique and indexed;
- `staff_members.is_active` has a true server default;
- `staff_members.created_at` and `staff_members.updated_at` have server defaults;
- `staff_assignments` has foreign keys to `staff_members`, `cities` and `locations`;
- `staff_assignments` has a check constraint requiring exactly one non-null target: either `city_id` or `location_id`;
- `downgrade()` drops `staff_assignments` before `staff_members`.

- [ ] **Step 3: Register models**

Import `StaffMember` and `StaffAssignment` in `db/models/__init__.py` and add them to `__all__`.

- [ ] **Step 4: Add Pydantic schemas**

Add:

```python
class StaffAssignmentSchema(BaseModel): ...
class StaffMemberSchema(BaseModel): ...
class CreateStaffMemberRequest(BaseModel): ...
class UpdateStaffMemberRequest(BaseModel): ...
```

Requests contain `tg_id`, `role`, `city_ids`, `location_ids`, `is_active` for update.

- [ ] **Step 5: Add project-admin dependency and admin route handlers**

Add `get_project_admin_user` in `webapp/deps.py`. It validates the current Telegram user, accepts `settings.ADMIN_IDS`, accepts active staff rows with role `project_admin`, and raises `ErrorCode.STAFF_PROJECT_ADMIN_REQUIRED` for all other users.

Add route functions to `webapp/routes/admin.py`:

```python
@router.get("/staff", response_model=list[StaffMemberSchema])
async def admin_list_staff_members(actor=Depends(get_project_admin_user), session: AsyncSession = Depends(get_session)): ...

@router.post("/staff", response_model=StaffMemberSchema)
async def admin_create_staff_member(body: CreateStaffMemberRequest, actor=Depends(get_project_admin_user), session: AsyncSession = Depends(get_session)): ...

@router.put("/staff/{staff_id}", response_model=StaffMemberSchema)
async def admin_update_staff_member(staff_id: int, body: UpdateStaffMemberRequest, actor=Depends(get_project_admin_user), session: AsyncSession = Depends(get_session)): ...

@router.delete("/staff/{staff_id}", status_code=204)
async def admin_delete_staff_member(staff_id: int, actor=Depends(get_project_admin_user), session: AsyncSession = Depends(get_session)): ...
```

Validation rules:

- empty or non-positive `tg_id` raises `STAFF_TG_ID_REQUIRED` or `STAFF_INVALID_TG_ID`;
- unsupported role raises `STAFF_ROLE_INVALID`;
- city curator requires unique `city_ids`;
- point manager requires unique `location_ids`;
- project admin and inpost curator ignore assignment IDs and store no rows;
- missing target city/location raises `STAFF_ASSIGNMENT_NOT_FOUND`;
- duplicate assignment input raises `STAFF_ASSIGNMENT_DUPLICATE`;
- creating an already active `tg_id` raises `STAFF_ASSIGNMENT_DUPLICATE`;
- creating an inactive `tg_id` reactivates the existing row and replaces role/assignments;
- deleting or demoting a `settings.ADMIN_IDS` Telegram ID raises `STAFF_CANNOT_DELETE_PROTECTED_ADMIN`.

- [ ] **Step 6: Run backend staff tests and verify GREEN**

Run:

```powershell
python -m unittest tests.test_admin_staff_contract -v
python -m unittest tests.test_staff_migration -v
```

Expected: PASS.

---

### Task 3: Frontend Staff Wiring Tests

**Files:**
- Modify: `frontend/tests/adminCms.test.mjs`

- [ ] **Step 1: Write failing static tests**

Extend `frontend/tests/adminCms.test.mjs` to read `AdminStaff.tsx` and assert:

```js
const staffSource = readFileSync(new URL('pages/admin/AdminStaff.tsx', root), 'utf8');
const adminApiSource = readFileSync(new URL('api/admin.ts', root), 'utf8');
const appSource = readFileSync(new URL('App.tsx', root), 'utf8');

test('admin staff page is routed and uses cms/i18n patterns', () => {
  assert.match(layoutSource, /labelKey: 'admin\.layout\.tabs\.staff'/);
  assert.match(appSource, /path="staff" element=\{<AdminStaff \/>\}/);
  assert.match(staffSource, /AdminPageHeader/);
  assert.match(staffSource, /AdminConfirmDialog/);
  assert.match(staffSource, /useI18n\(activeLocale\)/);
  assert.match(staffSource, /t\('admin\.staff\.title'\)/);
  assert.match(staffSource, /adminApi\.getStaff/);
  assert.match(staffSource, /adminApi\.createStaff/);
  assert.match(staffSource, /adminApi\.updateStaff/);
  assert.match(staffSource, /adminApi\.deleteStaff/);
  assert.match(staffSource, /adminApi\.getCities/);
  assert.match(staffSource, /adminApi\.getLocations/);
  assert.match(staffSource, /role === 'city_curator'/);
  assert.match(staffSource, /role === 'point_manager'/);
  assert.match(staffSource, /city_ids/);
  assert.match(staffSource, /location_ids/);
  assert.doesNotMatch(staffSource, /<input[^>]+type="(?:number|tel|email)"/);
});

test('admin api exposes staff methods and types', () => {
  assert.match(adminApiSource, /export interface AdminStaffMember/);
  assert.match(adminApiSource, /getStaff: \(\) => req<AdminStaffMember\[\]>\('\/api\/admin\/staff'\)/);
  assert.match(adminApiSource, /createStaff:/);
  assert.match(adminApiSource, /updateStaff:/);
  assert.match(adminApiSource, /deleteStaff:/);
});
```

- [ ] **Step 2: Run frontend test and verify RED**

Run:

```powershell
cd frontend
node --test tests/adminCms.test.mjs
```

Expected: FAIL because `AdminStaff.tsx` and staff API methods do not exist.

---

### Task 4: Frontend Staff Page

**Files:**
- Modify: `frontend/src/api/admin.ts`
- Create: `frontend/src/pages/admin/AdminStaff.tsx`
- Modify: `frontend/src/pages/admin/AdminLayout.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/i18n/locales/ru.ts`

- [ ] **Step 1: Add admin API types and methods**

Add `AdminStaffRole`, `AdminStaffAssignment`, `AdminStaffMember`, `AdminStaffPayload` and `getStaff/createStaff/updateStaff/deleteStaff` methods.

- [ ] **Step 2: Add Staff admin page**

Create `AdminStaff.tsx` using the current admin CMS components:

- table columns: Telegram ID, role, assignments, status, actions;
- modal fields: Telegram ID, role, cities multi-select, locations multi-select;
- show city selector only for `city_curator`;
- show location selector only for `point_manager`;
- show no assignment selector for `project_admin` and `inpost_curator`;
- confirmation dialog for deactivate.

- [ ] **Step 3: Wire route and tab**

Import `AdminStaff` in `App.tsx`, add `/admin/staff`, and add a Staff tab in `AdminLayout.tsx`.

- [ ] **Step 4: Add Russian i18n keys**

Add `admin.staff.*`, role labels and field labels to `frontend/src/i18n/locales/ru.ts`.

- [ ] **Step 5: Run frontend staff tests and verify GREEN**

Run:

```powershell
cd frontend
node --test tests/adminCms.test.mjs
```

Expected: PASS.

---

### Task 5: Full Verification and Commit

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run backend tests**

Run:

```powershell
python -m unittest discover tests -v
alembic upgrade head
alembic downgrade 0001
alembic upgrade head
```

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run:

```powershell
cd frontend
npm test
npm run check:ui-strings
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: no output.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/specs/2026-07-21-staff-settings-mvp-design.md docs/superpowers/plans/2026-07-21-staff-settings-mvp.md db webapp tests frontend
git commit -m "Add staff management MVP"
```

Expected: commit succeeds.

---

## Release Checklist After Explicit Approval

**Files:**
- No source edits.

- [ ] **Step 1: Push main**

Run:

```powershell
git push origin main
```

Expected: push succeeds.

- [ ] **Step 2: Deploy frontend production**

Run:

```powershell
cd frontend
vercel deploy --prod --scope team_JYm3nRKRyxalcSjDepIQDMgy --yes
```

Expected: Vercel returns a production deployment URL.

- [ ] **Step 3: Alias stable Mini App URL**

Run with the returned deployment hostname:

```powershell
vercel alias set <deployment>.vercel.app frontend-vapebot.vercel.app --scope team_JYm3nRKRyxalcSjDepIQDMgy
```

Expected: stable Mini App URL points at the latest deployment.

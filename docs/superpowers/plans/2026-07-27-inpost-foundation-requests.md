# InPost Foundation Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make InPost a first-class request/catalog source without enabling InPost checkout.

**Architecture:** Add `source_type` to product requests and make `city_id`/`location_id` nullable only for InPost requests. Keep Local Point request behavior unchanged, route InPost approvals into `inpost_stock`, and expose InPost availability from active `inpost_curator` presence. Frontend adds source-aware request creation/listing while preserving the existing modal review flow.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, Pydantic v2, Python unittest, React, TypeScript, Zustand, Vite, node:test.

---

## Scope

In scope:

- Product request `source_type`: `local_point` or `inpost`.
- InPost requests with no city/location.
- `inpost_curator` and `project_admin` can create InPost requests.
- Only `project_admin` can review InPost requests.
- Approved InPost requests update `inpost_stock`.
- Product request source filter: all, InPost, Local Points.
- InPost customer source status uses active `inpost_curator`.
- Customer selector keeps InPost block above Local Points.

Out of scope:

- InPost checkout.
- Paczkomat/courier validation.
- InPost official API.
- Telegram notifications.
- Media upload.
- New InPost manager role.

## File Map

Create:

- `alembic/versions/0007_inpost_product_requests.py` - request source migration.

Modify:

- `db/models/product_request.py` - source constants, nullable city/location, source constraint.
- `webapp/schemas.py` - source fields and request options.
- `webapp/routes/admin.py` - source-aware list/create/options schemas.
- `webapp/services/product_request_lifecycle.py` - source-aware review/edit/publish.
- `webapp/services/product_request_events.py` - include source context if needed by existing event hook.
- `db/repositories/catalog.py` - active InPost curator lookup.
- `webapp/routes/catalog.py` - InPost source availability.
- `frontend/src/api/admin.ts` - source-aware request types/API params.
- `frontend/src/pages/admin/AdminProductRequests.tsx` - source filter, labels, source-aware create modal.
- `frontend/src/pages/admin/productRequestActions.ts` - source-aware action visibility if needed.
- `frontend/src/i18n/locales/ru.ts` - labels/errors.
- `frontend/tests/adminCms.test.mjs` - static UI/API contract tests.
- `frontend/tests/productRequestActions.test.mjs` - role/action tests if action logic changes.
- `tests/test_product_requests_contract.py` - backend source/permission/publish tests.
- `tests/test_staff_migration.py` or new migration assertions - schema/migration coverage.
- `tests/test_catalog_sources_contract.py` - InPost availability from active curator.

---

### Task 1: Backend Schema And Migration

**Files:**

- Create: `alembic/versions/0007_inpost_product_requests.py`
- Modify: `db/models/product_request.py`
- Test: `tests/test_staff_migration.py`
- Test: `tests/test_product_requests_contract.py`

- [ ] **Step 1: Add failing schema assertions**

Add tests that assert `product_requests.source_type` exists and `city_id`/`location_id` can be nullable at metadata level.

Recommended additions to `tests/test_staff_migration.py`:

```python
def test_product_requests_support_source_type_and_nullable_inpost_target(self):
    import db.models  # noqa: F401
    from db.session import Base

    columns = Base.metadata.tables["product_requests"].c

    self.assertIn("source_type", columns)
    self.assertTrue(columns["city_id"].nullable)
    self.assertTrue(columns["location_id"].nullable)
```

- [ ] **Step 2: Run the failing schema test**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_staff_migration -v
```

Expected before implementation: FAIL because `source_type` is missing and city/location are not nullable.

- [ ] **Step 3: Update `db/models/product_request.py`**

Add source constants near existing request constants:

```python
PRODUCT_REQUEST_SOURCE_LOCAL_POINT = "local_point"
PRODUCT_REQUEST_SOURCE_INPOST = "inpost"
PRODUCT_REQUEST_SOURCES = {PRODUCT_REQUEST_SOURCE_LOCAL_POINT, PRODUCT_REQUEST_SOURCE_INPOST}
```

Update table constraints:

```python
CheckConstraint(
    "source_type IN ('local_point', 'inpost')",
    name="ck_product_requests_source_type",
),
CheckConstraint(
    "(source_type = 'local_point' AND city_id IS NOT NULL AND location_id IS NOT NULL) OR "
    "(source_type = 'inpost' AND city_id IS NULL AND location_id IS NULL)",
    name="ck_product_requests_source_target",
),
```

Add column and change target columns:

```python
source_type: Mapped[str] = mapped_column(
    String(32),
    nullable=False,
    default=PRODUCT_REQUEST_SOURCE_LOCAL_POINT,
    server_default=PRODUCT_REQUEST_SOURCE_LOCAL_POINT,
    index=True,
)
city_id: Mapped[int | None] = mapped_column(
    Integer, ForeignKey("cities.id", ondelete="RESTRICT"), nullable=True, index=True
)
location_id: Mapped[int | None] = mapped_column(
    Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True, index=True
)
```

- [ ] **Step 4: Add Alembic migration**

Create `alembic/versions/0007_inpost_product_requests.py`:

```python
"""inpost product request source

Revision ID: 0007_inpost_product_requests
Revises: 0006_global_catalog_sources
Create Date: 2026-07-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0007_inpost_product_requests"
down_revision = "0006_global_catalog_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_requests",
        sa.Column("source_type", sa.String(length=32), server_default="local_point", nullable=False),
    )
    op.create_index(op.f("ix_product_requests_source_type"), "product_requests", ["source_type"], unique=False)
    op.alter_column("product_requests", "city_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("product_requests", "location_id", existing_type=sa.Integer(), nullable=True)
    op.create_check_constraint(
        "ck_product_requests_source_type",
        "product_requests",
        "source_type IN ('local_point', 'inpost')",
    )
    op.create_check_constraint(
        "ck_product_requests_source_target",
        "product_requests",
        "(source_type = 'local_point' AND city_id IS NOT NULL AND location_id IS NOT NULL) OR "
        "(source_type = 'inpost' AND city_id IS NULL AND location_id IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_product_requests_source_target", "product_requests", type_="check")
    op.drop_constraint("ck_product_requests_source_type", "product_requests", type_="check")
    op.alter_column("product_requests", "location_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("product_requests", "city_id", existing_type=sa.Integer(), nullable=False)
    op.drop_index(op.f("ix_product_requests_source_type"), table_name="product_requests")
    op.drop_column("product_requests", "source_type")
```

If local migration tests use SQLite and fail on `alter_column` or check constraints, use `op.batch_alter_table("product_requests")` only in the migration test path. Do not drop existing data.

- [ ] **Step 5: Run schema tests**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_staff_migration -v
```

Expected: PASS.

- [ ] **Step 6: Commit schema foundation**

```powershell
git add db/models/product_request.py alembic/versions/0007_inpost_product_requests.py tests/test_staff_migration.py
git commit -m "Add InPost product request source schema"
```

---

### Task 2: Backend Request API Contracts

**Files:**

- Modify: `tests/test_product_requests_contract.py`
- Modify: `webapp/schemas.py`
- Modify: `webapp/routes/admin.py`
- Modify: `webapp/errors.py` only if a missing code is discovered.

- [ ] **Step 1: Add failing create/list tests**

Add tests to `tests/test_product_requests_contract.py`:

```python
async def test_inpost_curator_can_create_inpost_add_variant_request(self):
    async with self.sessionmaker() as session:
        seeded = await self._seed_request_basics(session)
        curator = await self._create_staff_actor(session, tg_id=82001, role="inpost_curator")

        request = await admin_create_product_request(
            CreateProductRequestRequest(
                source_type="inpost",
                request_type="ADD_VARIANT",
                location_id=None,
                product_id=seeded["product"].id,
                variant_name_ru="Mint",
                variant_name_pl="Mint",
                variant_name_uk="Mint",
                quantity=5,
            ),
            actor=curator,
            session=session,
        )

        self.assertEqual(request.source_type, "inpost")
        self.assertIsNone(request.city_id)
        self.assertIsNone(request.location_id)
        self.assertEqual(request.status, "pending_review")
```

Add equivalent tests:

- `test_project_admin_can_create_inpost_request`
- `test_point_manager_cannot_create_inpost_request`
- `test_city_curator_cannot_create_inpost_request`
- `test_inpost_curator_does_not_receive_local_point_requests`
- `test_source_filter_limits_product_request_list`

Use existing helpers in the file where possible. If helper names differ, adapt them without changing business intent.

- [ ] **Step 2: Run failing backend contract tests**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v
```

Expected before implementation: FAIL on missing `source_type` schema/API behavior.

- [ ] **Step 3: Extend schemas**

In `webapp/schemas.py`, change create payload:

```python
class CreateProductRequestRequest(BaseModel):
    source_type: str = "local_point"
    request_type: str
    location_id: Optional[int] = None
    product_id: int
    variant_id: Optional[int] = None
    variant_name_ru: Optional[str] = None
    variant_name_pl: Optional[str] = None
    variant_name_uk: Optional[str] = None
    price_override: Optional[Decimal] = Field(default=None, ge=0)
    quantity: int = Field(ge=1)
```

Change response schema:

```python
class ProductRequestSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_type: str = "local_point"
    request_type: str
    status: str
    requester_user_id: Optional[int]
    requester_tg_id: int
    city_id: Optional[int] = None
    city_name: Optional[str] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    ...
```

Add source option if frontend needs explicit create choices:

```python
class ProductRequestSourceOption(BaseModel):
    source_type: str
    label: str
    available: bool = True


class ProductRequestOptions(BaseModel):
    sources: List[ProductRequestSourceOption] = []
    locations: List[ProductRequestLocationOption]
    products: List[ProductSchema]
```

- [ ] **Step 4: Add source-aware helpers in `webapp/routes/admin.py`**

Import constants:

```python
from db.models.product_request import (
    PRODUCT_REQUEST_SOURCE_INPOST,
    PRODUCT_REQUEST_SOURCE_LOCAL_POINT,
    PRODUCT_REQUEST_SOURCES,
)
from db.models.staff import ROLE_INPOST_CURATOR
```

Add helpers near product request helpers:

```python
def _is_inpost_request_source(source_type: str | None) -> bool:
    return (source_type or PRODUCT_REQUEST_SOURCE_LOCAL_POINT) == PRODUCT_REQUEST_SOURCE_INPOST


async def _ensure_inpost_curator_can_create(actor, session: AsyncSession) -> None:
    if await is_project_admin_user(actor, session):
        return
    member = await _active_staff_for_actor(actor, session)
    if member and member.role == ROLE_INPOST_CURATOR:
        return
    raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "InPost request access denied")
```

- [ ] **Step 5: Update schema conversion**

In `_product_request_schema`, include:

```python
source_type=request.source_type,
city_id=request.city_id,
city_name=request.city.name if request.city else None,
location_id=request.location_id,
location_name=request.location.name if request.location else None,
```

- [ ] **Step 6: Update list endpoint**

Add query param:

```python
source: str | None = None,
```

Validation:

```python
if source is not None and source not in {"all", PRODUCT_REQUEST_SOURCE_LOCAL_POINT, PRODUCT_REQUEST_SOURCE_INPOST}:
    raise api_error(422, ErrorCode.PRODUCT_REQUEST_SOURCE_INVALID, "Product request source is invalid")
if source and source != "all":
    q = q.where(ProductRequest.source_type == source)
```

Role filtering:

```python
if not await is_project_admin_user(actor, session):
    member = await _active_staff_for_actor(actor, session)
    if member is None:
        raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "Product request access denied")
    if member.role == ROLE_INPOST_CURATOR:
        q = q.where(ProductRequest.source_type == PRODUCT_REQUEST_SOURCE_INPOST)
    elif member.role == ROLE_CITY_CURATOR:
        q = q.where(
            ProductRequest.source_type == PRODUCT_REQUEST_SOURCE_LOCAL_POINT,
            ProductRequest.city_id.in_(_staff_city_ids(member) or {-1}),
        )
    elif member.role == ROLE_POINT_MANAGER:
        q = q.where(
            ProductRequest.source_type == PRODUCT_REQUEST_SOURCE_LOCAL_POINT,
            ProductRequest.location_id.in_(_staff_location_ids(member) or {-1}),
        )
    else:
        raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "Product request access denied")
```

- [ ] **Step 7: Update options endpoint**

Build sources:

```python
sources = []
is_project_admin = await is_project_admin_user(actor, session)
member = None if is_project_admin else await _active_staff_for_actor(actor, session)

if is_project_admin or (member and member.role == ROLE_INPOST_CURATOR):
    sources.append(ProductRequestSourceOption(source_type="inpost", label="InPost"))
if is_project_admin or (member and member.role in {ROLE_POINT_MANAGER, ROLE_CITY_CURATOR}):
    sources.append(ProductRequestSourceOption(source_type="local_point", label="Локальные точки"))
```

Return:

```python
return ProductRequestOptions(sources=sources, locations=locations, products=products)
```

- [ ] **Step 8: Update create endpoint**

Validation:

```python
source_type = body.source_type or PRODUCT_REQUEST_SOURCE_LOCAL_POINT
if source_type not in PRODUCT_REQUEST_SOURCES:
    raise api_error(422, ErrorCode.PRODUCT_REQUEST_SOURCE_INVALID, "Product request source is invalid")
```

Branch target:

```python
if source_type == PRODUCT_REQUEST_SOURCE_INPOST:
    if body.location_id is not None:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_LOCATION_FORBIDDEN, "InPost request must not target a Local Point")
    await _ensure_inpost_curator_can_create(actor, session)
    city = location = None
else:
    if body.location_id is None:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_LOCATION_REQUIRED, "Local Point is required")
    city, location = await _ensure_request_location(session, body.location_id)
    await _ensure_point_manager_can_create(actor, session, location.id)
```

When creating `ProductRequest`:

```python
source_type=source_type,
city_id=city.id if city else None,
location_id=location.id if location else None,
```

- [ ] **Step 9: Run focused tests**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v
```

Expected: newly added API contract tests pass.

- [ ] **Step 10: Commit API contracts**

```powershell
git add webapp/schemas.py webapp/routes/admin.py tests/test_product_requests_contract.py
git commit -m "Add InPost product request API contracts"
```

---

### Task 3: Backend Lifecycle, Review, And Publishing

**Files:**

- Modify: `webapp/services/product_request_lifecycle.py`
- Modify: `webapp/services/product_request_events.py` if event context needs source.
- Modify: `tests/test_product_requests_contract.py`

- [ ] **Step 1: Add failing lifecycle tests**

Add tests:

```python
async def test_project_admin_approval_of_inpost_add_stock_updates_inpost_stock_only(self):
    async with self.sessionmaker() as session:
        seeded = await self._seed_request_basics(session)
        curator = await self._create_staff_actor(session, tg_id=83001, role="inpost_curator")
        request = await admin_create_product_request(
            CreateProductRequestRequest(
                source_type="inpost",
                request_type="ADD_STOCK",
                product_id=seeded["product"].id,
                variant_id=seeded["variant"].id,
                quantity=4,
            ),
            actor=curator,
            session=session,
        )
        locked = await admin_lock_product_request(request.id, actor=self.admin_actor, session=session)
        approved = await admin_approve_product_request(locked.id, actor=self.admin_actor, session=session)

        stock = await session.scalar(select(InpostStock).where(InpostStock.variant_id == seeded["variant"].id))
        local_stock = await session.scalar(select(LocationStock).where(LocationStock.variant_id == seeded["variant"].id))

        self.assertEqual(approved.source_type, "inpost")
        self.assertEqual(stock.quantity, 4)
        self.assertIsNone(local_stock)
```

Add equivalent tests:

- `test_city_curator_cannot_lock_inpost_request`
- `test_inpost_curator_cannot_lock_inpost_request`
- `test_project_admin_can_need_changes_inpost_request`
- `test_inpost_curator_can_edit_unlocked_need_changes_inpost_request`
- `test_project_admin_approval_of_inpost_add_variant_creates_variant_and_inpost_stock`

- [ ] **Step 2: Run failing lifecycle tests**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v
```

Expected before implementation: FAIL because lifecycle assumes `city_id`/`location_id` and always writes `LocationStock`.

- [ ] **Step 3: Import InPost model and role**

In `webapp/services/product_request_lifecycle.py`:

```python
from db.models.inpost_stock import InpostStock
from db.models.product_request import (
    PRODUCT_REQUEST_SOURCE_INPOST,
    PRODUCT_REQUEST_SOURCE_LOCAL_POINT,
)
from db.models.staff import ROLE_INPOST_CURATOR
```

- [ ] **Step 4: Replace city-id reviewer helper**

Add:

```python
def _request_is_inpost(request: ProductRequest) -> bool:
    return request.source_type == PRODUCT_REQUEST_SOURCE_INPOST


async def _ensure_reviewer_can_review_request(actor, session: AsyncSession, request: ProductRequest) -> None:
    if await is_project_admin_user(actor, session):
        return
    if _request_is_inpost(request):
        raise api_error(403, ErrorCode.PRODUCT_REQUEST_REVIEW_PERMISSION_DENIED, "InPost review requires project admin")
    member = await _active_staff_for_actor(actor, session)
    if member and member.role == ROLE_CITY_CURATOR and request.city_id in _staff_city_ids(member):
        return
    raise api_error(403, ErrorCode.PRODUCT_REQUEST_REVIEW_PERMISSION_DENIED, "Review access denied")
```

Update `lock_product_request`, `release_product_request`, and `ensure_request_lock_owner` to call `_ensure_reviewer_can_review_request(actor, session, request)`.

- [ ] **Step 5: Update edit permission helper**

Change `_ensure_actor_can_edit_request`:

```python
async def _ensure_actor_can_edit_request(actor, session: AsyncSession, request: ProductRequest) -> None:
    if await is_project_admin_user(actor, session):
        return
    member = await _active_staff_for_actor(actor, session)
    if request.source_type == PRODUCT_REQUEST_SOURCE_INPOST:
        if member and member.role == ROLE_INPOST_CURATOR:
            return
        raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "InPost request edit access denied")
    if member and member.role == ROLE_CITY_CURATOR and request.city_id in _staff_city_ids(member):
        return
    if (
        member
        and member.role == ROLE_POINT_MANAGER
        and request.requester_tg_id == getattr(actor, "tg_id", None)
        and request.location_id in _staff_location_ids(member)
    ):
        return
    raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "Product request edit access denied")
```

- [ ] **Step 6: Add stock publisher helpers**

Add:

```python
async def _upsert_inpost_stock(session: AsyncSession, variant_id: int, quantity: int, request_type: str) -> None:
    result = await session.execute(select(InpostStock).where(InpostStock.variant_id == variant_id))
    stock = result.scalar_one_or_none()
    if stock is None:
        stock = InpostStock(variant_id=variant_id, quantity=quantity)
        session.add(stock)
        return
    if request_type == PRODUCT_REQUEST_ADD_STOCK:
        stock.quantity += quantity
    else:
        stock.quantity = quantity
```

Keep existing Local Point stock behavior in a separate branch.

- [ ] **Step 7: Update `approve_product_request`**

After resolving `stock_variant_id`, branch:

```python
if request.source_type == PRODUCT_REQUEST_SOURCE_INPOST:
    await _upsert_inpost_stock(session, stock_variant_id, request.quantity, request.request_type)
else:
    await _ensure_request_location(session, request.location_id)
    # existing LocationStock upsert/increment logic
```

Do not call `_ensure_request_location` for InPost requests.

- [ ] **Step 8: Make event context nullable-safe**

Ensure `_event_context` accepts nullable city/location:

```python
city_id=request.city_id,
location_id=request.location_id,
```

If `ProductRequestEventContext` type currently requires `int`, change to `int | None` and keep no-op behavior.

- [ ] **Step 9: Run lifecycle tests**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v
```

Expected: PASS.

- [ ] **Step 10: Commit lifecycle changes**

```powershell
git add webapp/services/product_request_lifecycle.py webapp/services/product_request_events.py tests/test_product_requests_contract.py
git commit -m "Publish approved InPost requests to warehouse stock"
```

---

### Task 4: Catalog Source Availability

**Files:**

- Modify: `db/repositories/catalog.py`
- Modify: `webapp/routes/catalog.py`
- Test: `tests/test_catalog_sources_contract.py`

- [ ] **Step 1: Add failing catalog availability tests**

Add tests:

```python
async def test_inpost_source_available_when_active_inpost_curator_exists(self):
    async with self.sessionmaker() as session:
        await self._create_staff_member(session, tg_id=84001, role="inpost_curator", is_active=True)
        sources = await get_catalog_sources(session=session)

        self.assertEqual(sources.inpost.status, "available")
```

And:

```python
async def test_inpost_source_inactive_without_active_inpost_curator(self):
    async with self.sessionmaker() as session:
        await self._create_staff_member(session, tg_id=84002, role="inpost_curator", is_active=False)
        sources = await get_catalog_sources(session=session)

        self.assertEqual(sources.inpost.status, "inactive")
```

Adapt helper names to the existing test file.

- [ ] **Step 2: Run failing catalog tests**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_catalog_sources_contract -v
```

Expected before implementation: FAIL because `/catalog-sources` always returns InPost `inactive`.

- [ ] **Step 3: Add repository method**

In `db/repositories/catalog.py`:

```python
from db.models.staff import ROLE_INPOST_CURATOR, StaffMember
```

Add:

```python
async def has_active_inpost_curator(self) -> bool:
    result = await self.session.execute(
        select(StaffMember.id).where(
            StaffMember.role == ROLE_INPOST_CURATOR,
            StaffMember.is_active == True,
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None
```

- [ ] **Step 4: Update catalog route**

In `webapp/routes/catalog.py`, inside `get_catalog_sources`:

```python
inpost_available = await repo.has_active_inpost_curator()
...
inpost=CatalogSourceInpostSchema(
    status="available" if inpost_available else "inactive",
    stock_count=inpost_summary["total_qty"],
),
```

- [ ] **Step 5: Run catalog tests**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_catalog_sources_contract -v
```

Expected: PASS.

- [ ] **Step 6: Commit catalog availability**

```powershell
git add db/repositories/catalog.py webapp/routes/catalog.py tests/test_catalog_sources_contract.py
git commit -m "Activate InPost source from curator presence"
```

---

### Task 5: Frontend API Types And Request Source Filter

**Files:**

- Modify: `frontend/src/api/admin.ts`
- Modify: `frontend/src/pages/admin/AdminProductRequests.tsx`
- Modify: `frontend/src/i18n/locales/ru.ts`
- Modify: `frontend/tests/adminCms.test.mjs`

- [ ] **Step 1: Add failing frontend static tests**

In `frontend/tests/adminCms.test.mjs`, add assertions to the product request test:

```js
assert.match(adminApiSource, /source_type:\s*'local_point' \| 'inpost'/);
assert.match(adminApiSource, /source\?:\s*'all' \| 'local_point' \| 'inpost'/);
assert.match(productRequestsSource, /type SourceFilter = 'all' \| 'local_point' \| 'inpost'/);
assert.match(productRequestsSource, /admin\.productRequests\.sourceFilters\.inpost/);
assert.match(productRequestsSource, /admin\.productRequests\.sourceLabels\.inpost/);
assert.match(productRequestsSource, /form\.source_type === 'inpost'/);
```

- [ ] **Step 2: Run failing frontend tests**

Run:

```powershell
cd frontend
npm test -- adminCms
```

Expected before implementation: FAIL on missing source-aware API/UI.

- [ ] **Step 3: Update `frontend/src/api/admin.ts`**

Add:

```ts
export type ProductRequestSourceType = 'local_point' | 'inpost';
export type ProductRequestSourceFilter = 'all' | ProductRequestSourceType;
```

Update `AdminProductRequest`:

```ts
source_type: ProductRequestSourceType;
city_id: number | null;
location_id: number | null;
```

Update options:

```ts
export interface ProductRequestSourceOption {
  source_type: ProductRequestSourceType;
  label: string;
  available: boolean;
}

export interface ProductRequestOptions {
  sources: ProductRequestSourceOption[];
  locations: ProductRequestLocationOption[];
  products: ProductSchema[];
}
```

Update payload:

```ts
export interface ProductRequestPayload {
  source_type: ProductRequestSourceType;
  request_type: ProductRequestType;
  location_id?: number | null;
  ...
}
```

Update list method:

```ts
getProductRequests: (params?: { mode?: 'active' | 'archive'; status?: ProductRequestStatus; source?: ProductRequestSourceFilter }) => {
  const query = new URLSearchParams();
  if (params?.mode) query.set('mode', params.mode);
  if (params?.status) query.set('status', params.status);
  if (params?.source && params.source !== 'all') query.set('source', params.source);
  return req<AdminProductRequest[]>(`/api/admin/product-requests${query.toString() ? `?${query}` : ''}`);
},
```

- [ ] **Step 4: Update `AdminProductRequests.tsx` state**

Extend `FormState`:

```ts
source_type: ProductRequestSourceType;
```

Add:

```ts
type SourceFilter = 'all' | 'local_point' | 'inpost';
const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
```

Update load:

```ts
adminApi.getProductRequests({ mode, status: selectedStatus, source: sourceFilter }),
```

Update `useEffect` dependency:

```ts
useEffect(() => { load(); }, [mode, selectedStatus, sourceFilter]);
```

- [ ] **Step 5: Source-aware create modal**

Initialize:

```ts
const initialForm: FormState = {
  source_type: 'local_point',
  request_type: 'ADD_VARIANT',
  location_id: '',
  product_id: '',
  variant_id: '',
  variant_name: '',
  price_override: '',
  quantity: '1',
};
```

After options load:

```ts
const firstSource = nextOptions.sources[0]?.source_type ?? 'local_point';
setForm((current) => ({
  ...current,
  source_type: current.source_type || firstSource,
  location_id: firstSource === 'inpost' ? '' : current.location_id || String(nextOptions.locations[0]?.id ?? ''),
  product_id: current.product_id || String(nextOptions.products[0]?.id ?? ''),
}));
```

When source changes:

```ts
const setField = (key: keyof FormState, value: string) => {
  setForm((current) => ({
    ...current,
    [key]: value,
    ...(key === 'source_type' && value === 'inpost' ? { location_id: '' } : {}),
    ...(key === 'source_type' && value === 'local_point' ? { location_id: String(options.locations[0]?.id ?? '') } : {}),
    ...(key === 'product_id' ? { variant_id: '' } : {}),
  }));
};
```

Payload:

```ts
const payload: ProductRequestPayload = {
  source_type: form.source_type,
  request_type: form.request_type,
  location_id: form.source_type === 'inpost' ? null : Number(form.location_id),
  product_id: Number(form.product_id),
  quantity: Math.max(1, Number(form.quantity) || 1),
};
```

Submit guard:

```ts
const canSubmit = (form.source_type === 'inpost' || form.location_id) && form.product_id && form.quantity && (
  form.request_type === 'ADD_VARIANT' ? form.variant_name.trim() : form.variant_id
);
```

- [ ] **Step 6: Add source filter and row labels**

Add filter bar options:

```ts
const sourceFilters: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: t('admin.productRequests.sourceFilters.all') },
  { value: 'inpost', label: t('admin.productRequests.sourceFilters.inpost') },
  { value: 'local_point', label: t('admin.productRequests.sourceFilters.localPoint') },
];
```

Add label helpers:

```ts
const sourceLabel = (request: AdminProductRequest) => request.source_type === 'inpost'
  ? t('admin.productRequests.sourceLabels.inpost')
  : t('admin.productRequests.sourceLabels.localPoint');

const targetLabel = (request: AdminProductRequest) => request.source_type === 'inpost'
  ? t('admin.productRequests.sourceLabels.inpost')
  : `${request.city_name || t('admin.productRequests.cityFallback')} - ${request.location_name || t('admin.productRequests.locationFallback')}`;
```

Use row copy:

```tsx
<span>{sourceLabel(request)} - {targetLabel(request)}</span>
```

In review details, show source and target separately.

- [ ] **Step 7: Add i18n keys**

In `frontend/src/i18n/locales/ru.ts` under `admin.productRequests`:

```ts
sourceFilters: {
  all: 'Все источники',
  inpost: 'InPost',
  localPoint: 'Локальные точки',
},
sourceLabels: {
  inpost: 'InPost',
  localPoint: 'Локальная точка',
},
fields: {
  source: 'Источник',
  ...
},
cityFallback: 'Город не указан',
```

Add error translations for existing backend codes if missing:

```ts
product_request: {
  source_invalid: 'Источник заявки должен быть Local Point или InPost.',
  inpost_inactive: 'InPost недоступен: нет активного куратора.',
  ...
}
```

- [ ] **Step 8: Run frontend tests**

Run:

```powershell
cd frontend
npm test -- adminCms
npm run check:ui-strings
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit frontend request UI**

```powershell
git add frontend/src/api/admin.ts frontend/src/pages/admin/AdminProductRequests.tsx frontend/src/i18n/locales/ru.ts frontend/tests/adminCms.test.mjs
git commit -m "Add InPost source controls to product requests UI"
```

---

### Task 6: Action Rules And Customer Selector Guardrails

**Files:**

- Modify: `frontend/src/pages/admin/productRequestActions.ts`
- Modify: `frontend/tests/productRequestActions.test.mjs`
- Modify: `frontend/src/pages/CatalogSelector.tsx` only if status copy or disabled handling needs adjustment.
- Modify: `frontend/tests/adminCms.test.mjs` if selector contract needs a stricter assertion.

- [ ] **Step 1: Add action tests if needed**

If `productRequestActions.ts` currently lets `city_curator` act on InPost because it only sees role/status/lock, add a request source case:

```js
test('city curator cannot review inpost requests', () => {
  const actions = getProductRequestActions({
    role: 'city_curator',
    currentTgId: 100,
    request: {
      ...baseRequest,
      source_type: 'inpost',
      status: 'pending_review',
      locked_by_tg_id: null,
    },
    isOwnEditableRequest: false,
  });

  assert.equal(actions.canLock, false);
  assert.equal(actions.canTakeover, false);
});
```

Add:

```js
test('project admin can review inpost requests', () => {
  const actions = getProductRequestActions({
    role: 'project_admin',
    currentTgId: 100,
    request: { ...baseRequest, source_type: 'inpost', status: 'pending_review', locked_by_tg_id: null },
    isOwnEditableRequest: true,
  });

  assert.equal(actions.canLock, true);
});
```

- [ ] **Step 2: Run failing action tests**

Run:

```powershell
cd frontend
npm test -- productRequestActions
```

Expected before implementation: FAIL if action logic is not source-aware. If it already passes because backend controls visibility elsewhere, keep tests as regression coverage.

- [ ] **Step 3: Update action helper**

In `productRequestActions.ts`, keep backend authoritative but prevent obvious wrong buttons:

```ts
const isInpost = request.source_type === 'inpost';
const canReviewSource = role === 'project_admin' || (!isInpost && role === 'city_curator');
```

Use `canReviewSource` for lock/takeover/review actions.

Allow edit for `need_changes` when `isOwnEditableRequest` is true and either:

- role is `project_admin`;
- role is `inpost_curator` and source is InPost;
- source is Local Point and existing Local edit rules apply.

- [ ] **Step 4: Confirm customer selector disabled behavior**

`CatalogSelector.tsx` already renders InPost above Local Points and disables it when status is not `available`. Keep that behavior.

Only add a test if missing:

```js
assert.match(catalogSelectorSource, /source-selector-inpost/);
assert.match(catalogSelectorSource, /disabled=\{sources\.inpost\.status !== 'available'/);
```

- [ ] **Step 5: Run focused frontend tests**

Run:

```powershell
cd frontend
npm test -- productRequestActions adminCms
```

Expected: PASS.

- [ ] **Step 6: Commit action guardrails**

```powershell
git add frontend/src/pages/admin/productRequestActions.ts frontend/tests/productRequestActions.test.mjs frontend/tests/adminCms.test.mjs
git commit -m "Guard product request actions by source"
```

---

### Task 7: Full Verification And Review

**Files:**

- Modify: only files required by review findings.

- [ ] **Step 1: Run backend tests**

Run:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v
.venv\Scripts\python.exe -m unittest tests.test_catalog_sources_contract -v
.venv\Scripts\python.exe -m unittest tests.test_staff_migration -v
.venv\Scripts\python.exe -m unittest discover tests
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

- [ ] **Step 3: Run repository hygiene checks**

Run from repo root:

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors; branch has only intended changes.

- [ ] **Step 4: Request two read-only reviews**

Reviewer A focus:

- migration safety;
- source constraints;
- Local Point behavior unchanged;
- InPost approval writes `inpost_stock`, not `location_stock`.

Reviewer B focus:

- frontend role/source visibility;
- request create modal source selection;
- source filters and labels;
- customer selector disabled InPost behavior.

- [ ] **Step 5: Apply review fixes**

For every accepted finding:

1. write or update a failing test;
2. implement minimal fix;
3. rerun the focused test;
4. rerun full checks if the finding touches shared behavior.

- [ ] **Step 6: Final commit if review fixes exist**

```powershell
git add db webapp tests frontend docs/superpowers/plans/2026-07-27-inpost-foundation-requests.md
git commit -m "Address InPost request review findings"
```

---

### Task 8: Push And Deploy After User Approval

**Files:**

- No source edits unless deployment smoke reveals a bug.

- [ ] **Step 1: Ask for explicit approval**

Before production deployment, ask the user:

```text
Подтверждаешь push main + Railway backend deploy + Vercel frontend deploy?
```

Do not deploy before the user confirms.

- [ ] **Step 2: Push**

Run:

```powershell
git push origin main
```

Expected: push succeeds.

- [ ] **Step 3: Deploy backend**

Run:

```powershell
npx --yes @railway/cli up --detach --message "Deploy InPost product request foundation"
```

Expected: Railway accepts deployment.

- [ ] **Step 4: Check backend health**

Run:

```powershell
Invoke-RestMethod -Uri 'https://vapebot-production.up.railway.app/health' -TimeoutSec 20 | ConvertTo-Json -Compress
```

Expected: health response is OK.

- [ ] **Step 5: Deploy frontend**

Run:

```powershell
cd frontend
npx --yes vercel deploy --prod --scope team_JYm3nRKRyxalcSjDepIQDMgy --yes
```

Expected: command prints a production deployment host. Copy the host ending in `.vercel.app`.

- [ ] **Step 6: Alias frontend**

Run:

```powershell
$deploymentHost = Read-Host "Enter production deployment host from previous command"
npx --yes vercel alias set $deploymentHost frontend-vapebot.vercel.app --scope team_JYm3nRKRyxalcSjDepIQDMgy
```

Expected: stable alias points to new deployment.

- [ ] **Step 7: Smoke checks**

Run:

```powershell
Invoke-WebRequest -Uri 'https://frontend-vapebot.vercel.app' -Method Head -UseBasicParsing -TimeoutSec 30
Invoke-RestMethod -Uri 'https://vapebot-production.up.railway.app/api/catalog-sources' -TimeoutSec 20 | ConvertTo-Json -Compress
```

Expected:

- frontend returns HTTP 200;
- catalog sources response contains `inpost.status`;
- Mini App opens;
- admin product requests tab opens.

## Acceptance Criteria

- Existing Local Point request tests still pass.
- Product request rows have `source_type`.
- Existing requests are treated as `local_point`.
- `inpost_curator` can create InPost `ADD_VARIANT` and `ADD_STOCK` requests.
- `project_admin` can create InPost requests.
- `point_manager` cannot create InPost requests.
- `city_curator` cannot create, see, or review InPost requests.
- Only `project_admin` can lock and review InPost requests.
- Approved InPost `ADD_VARIANT` creates a variant and updates `inpost_stock`.
- Approved InPost `ADD_STOCK` increments `inpost_stock`.
- Approved InPost requests do not write `location_stock`.
- `/api/catalog-sources` returns InPost `available` when active `inpost_curator` exists.
- `/api/catalog-sources` returns disabled/inactive InPost when no active `inpost_curator` exists.
- Admin request list has source filters: all, InPost, Local Points.
- Admin request rows show InPost or Local Point source labels.
- InPost create modal has no city/location picker for `inpost_curator`.
- Customer selector still shows InPost above Local Points.
- InPost checkout remains blocked.

## Risks And Rollback

Risks:

- Migration can break old Local Point requests if nullable target constraints are wrong.
- Review permissions can accidentally let `city_curator` review InPost.
- Approval can accidentally update `location_stock` for InPost.
- Frontend can show Local Point fields for InPost requests.
- Backend/frontend deployment order can temporarily mismatch API payloads.

Mitigations:

- Default missing `source_type` to `local_point`.
- Keep Local Point tests unchanged and green.
- Add explicit InPost permission and publishing tests.
- Deploy backend before frontend.

Rollback:

- Revert frontend source-filter/create UI commits.
- If migration is already applied, keep `source_type` column but disable InPost creation in backend guards.
- Revert lifecycle InPost publishing branch while preserving Local Point behavior.
- If database rollback is required before data exists, downgrade Alembic from `0007` to `0006`; if InPost request rows already exist, archive/export them before downgrade.

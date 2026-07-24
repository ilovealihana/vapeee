# Product Request Review Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Local-only product request workflow with review locks, `need_changes`, editable correction loops, active/archive filtering, and no-op notification hook points.

**Architecture:** Keep `ProductRequest` as the persistent request aggregate and preserve the existing Local-only `ADD_VARIANT` / `ADD_STOCK` MVP. Move lock, verdict, edit, permission, and event emission rules into a focused backend lifecycle service so `webapp/routes/admin.py` only validates HTTP input and returns schemas. Frontend stays on `/admin/product-requests` and adds mode/filter/action state around the existing dense admin page.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, Pydantic v2, React, Vite, TypeScript, node:test, Python unittest.

## Global Constraints

- Documentation is the source of truth; if code and docs conflict, report the conflict before changing business behavior.
- Backend remains authoritative for permissions, status transitions, locks, prices, inventory, and edits.
- Scope is Local-only product requests; do not add InPost requests, media upload, new product creation, drafts, or Telegram delivery.
- Supported request types remain `ADD_VARIANT` and `ADD_STOCK`.
- Supported statuses after this slice are `pending_review`, `need_changes`, `approved`, and `rejected`.
- Final statuses are `approved` and `rejected`; final requests cannot be edited, approved, rejected, restored, or moved back to active.
- Verdicts (`approve`, `reject`, `need_changes`) require a lock owned by the reviewer, except project admin takeover rules described below.
- `need_changes` and `reject` require non-empty reviewer comments.
- Successful edit of a `need_changes` request returns it to `pending_review`, clears lock fields, and preserves the latest reviewer comment for visibility.
- No Telegram messages are sent in this slice; event hooks are no-op and internal only.
- All visible frontend text uses `frontend/src/i18n/locales/ru.ts` keys.
- Existing frontend design and admin CMS patterns must be preserved.
- Project admin takeover is explicit only: when another reviewer owns a lock, project admin must call `POST /api/admin/product-requests/{request_id}/lock` before approve, reject, or need_changes.
- `PATCH /api/admin/product-requests/{request_id}` rejects forbidden fields such as `product_id`, `location_id`, `request_type`, and `variant_id`; forbidden fields are not silently ignored.
- `PATCH` with `price_override: null` on `ADD_VARIANT` clears the price override.
- Incompatible list filters such as `mode=active&status=approved` or `mode=archive&status=need_changes` return an empty list.
- Every plan revision and every major verification checkpoint must be reviewed by two independent read-only reviewer subagents before the work is considered ready to proceed.
- Before every task commit, run `git status --short` and include only the files listed in that task unless the user explicitly approves additional files.

---

## Files

Create:
- `webapp/services/product_request_events.py` - no-op lifecycle event hook and event payload type.
- `webapp/services/product_request_lifecycle.py` - lock, release, verdict, edit, permission, and publication helpers.
- `alembic/versions/0005_product_request_review_loop.py` - migration for `need_changes`, review locks, and neutral comments.

Modify:
- `db/models/product_request.py` - add `need_changes`, lock fields, and `review_comment`.
- `webapp/schemas.py` - add lock/comment fields and request bodies for lock, release, need-changes, edit, and list filters.
- `webapp/routes/admin.py` - delegate product request lifecycle endpoints to the service.
- `webapp/errors.py` - add `PRODUCT_REQUEST_COMMENT_REQUIRED = "product_request.comment_required"` and document it.
- `tests/test_product_requests_contract.py` - extend backend contract coverage for lock, release, need_changes, edit, finality, and hooks.
- `frontend/src/api/admin.ts` - extend product request types and API methods.
- `frontend/src/pages/admin/AdminProductRequests.tsx` - add active/archive modes, filters, lock-aware actions, edit and request-changes modals.
- `frontend/src/pages/admin/productRequestActions.ts` - role/status/lock action-state helper for table-driven tests.
- `frontend/src/i18n/locales/ru.ts` - add UI strings and error labels.
- `frontend/tests/adminCms.test.mjs` - add static frontend coverage for API, route, i18n, filters, lock-aware actions, and edit modal.
- `frontend/tests/productRequestActions.test.mjs` - table tests for role/status/lock action visibility.
- `docs/admin/product-requests.md` - align current Local-only request behavior with this approved slice or clearly link to the slice spec for current behavior.
- `docs/products/moderation.md` - document lock-required moderation and `need_changes` as current behavior for Local requests.
- `docs/backend/error-handling.md` - ensure new lock/edit/comment error codes are listed.
- `docs/AGENT_HANDOFF.md` - replace "next approved slice" language with the implemented review-loop state after deploy.

---

### Task 0: Local Backend Tooling

**Files:**
- No repository files changed.

**Interfaces:**
- Produces local executable `.venv\Scripts\python.exe` used by every backend test command in later tasks.

- [ ] Confirm an installed Python version greater than 3.11 is available.

Run from repo root:

```powershell
py -0p
```

Expected on this machine: Python 3.13 or newer is listed.

- [ ] Create a local virtual environment with Python 3.13.

Run from repo root:

```powershell
py -3.13 -m venv .venv
```

Expected: `.venv\Scripts\python.exe` exists.

- [ ] Install backend dependencies.

Run from repo root:

```powershell
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Expected: dependencies install without resolver errors.

- [ ] Verify backend import baseline.

Run from repo root:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_backend_import -v
```

Expected: PASS.

- [ ] Verify frontend dependencies are already available.

Run from `frontend/`:

```powershell
npm test
```

Expected: current baseline tests PASS before feature work starts.

---

### Task 1: Backend Persistence and Schema Surface

**Files:**
- Create: `alembic/versions/0005_product_request_review_loop.py`
- Modify: `db/models/product_request.py`
- Modify: `webapp/schemas.py`
- Test: `tests/test_staff_migration.py`

**Interfaces:**
- Produces model constants:
  - `PRODUCT_REQUEST_NEED_CHANGES = "need_changes"`
  - `PRODUCT_REQUEST_ACTIVE_STATUSES = {"pending_review", "need_changes"}`
  - `PRODUCT_REQUEST_FINAL_STATUSES = {"approved", "rejected"}`
- Produces `ProductRequest` fields:
  - `locked_by_tg_id: int | None`
  - `locked_at: datetime | None`
  - `review_comment: str | None`
- Produces schema fields on `ProductRequestSchema`:
  - `review_comment: Optional[str]`
  - `locked_by_tg_id: Optional[int]`
  - `locked_at: Optional[datetime]`
- Produces request schemas:
  - `ProductRequestCommentRequest(comment: str)`
  - `UpdateProductRequestReviewRequest(variant_name_ru?: str, variant_name_pl?: str, variant_name_uk?: str, price_override?: Decimal, quantity?: int)`
  - `RejectProductRequestRequest(reason?: str, comment?: str)` for backward compatibility with the current frontend payload.

- [ ] Extend the existing synchronous migration tests in `tests/test_staff_migration.py`.

Use the current temp SQLite/Alembic pattern in that file. Keep `test_staff_migration_upgrade_and_downgrade` as the clean upgrade/downgrade path. After `command.upgrade(cfg, "head")`, add only column assertions:

```python
request_columns = {column["name"] for column in inspector.get_columns("product_requests")}
self.assertIn("locked_by_tg_id", request_columns)
self.assertIn("locked_at", request_columns)
self.assertIn("review_comment", request_columns)
```

Add a separate synchronous test `test_product_request_need_changes_status_survives_upgrade` that upgrades to head, inserts a `need_changes` request, and does not attempt downgrade:

```python
with engine.begin() as conn:
    conn.execute(
        text(
            "INSERT INTO users (tg_id, first_name, created_at) "
            "VALUES (9001, 'Manager', CURRENT_TIMESTAMP)"
        )
    )
    conn.execute(
        text("INSERT INTO cities (name, slug, is_active) VALUES ('Wroclaw', 'wroclaw', 1)")
    )
    conn.execute(
        text(
            "INSERT INTO locations (city_id, name, address, is_active) "
            "VALUES (1, 'Center', 'Main 1', 1)"
        )
    )
    conn.execute(
        text(
            "INSERT INTO products (name_ru, name_pl, name_uk, base_price, is_active) "
            "VALUES ('Product', 'Product', 'Product', 10, 1)"
        )
    )
    conn.execute(
        text(
            "INSERT INTO product_requests "
            "(request_type, status, requester_tg_id, city_id, location_id, product_id, quantity) "
            "VALUES ('ADD_VARIANT', 'need_changes', 9001, 1, 1, 1, 1)"
        )
    )
```

Add a separate synchronous test `test_product_request_need_changes_blocks_downgrade_to_0004` that upgrades to head, inserts a `need_changes` request, and asserts downgrade to `0004` raises:

```python
with self.assertRaises(Exception):
    with patch("config.settings.DATABASE_URL", async_url):
        command.downgrade(cfg, "0004")
```

The existing clean downgrade test must not insert a live `need_changes` row. A separate clean downgrade check without `need_changes` rows should downgrade to `0004` and assert `locked_by_tg_id`, `locked_at`, and `review_comment` are removed while `product_requests` still exists.

- [ ] Run the focused migration test and confirm it fails before implementation.

Run: `.venv\Scripts\python.exe -m unittest tests.test_staff_migration -v`

Expected before implementation: FAIL because the new columns do not exist and the old check constraint rejects `need_changes`.

- [ ] Update `db/models/product_request.py`.

Implementation details:
- Add `PRODUCT_REQUEST_NEED_CHANGES`.
- Add `need_changes` to `PRODUCT_REQUEST_STATUSES`.
- Add `PRODUCT_REQUEST_ACTIVE_STATUSES` and `PRODUCT_REQUEST_FINAL_STATUSES`.
- Change the status check constraint to include `need_changes`.
- Add nullable `locked_by_tg_id`, `locked_at`, and `review_comment`.
- Keep `reject_reason` for backward compatibility; it should mirror `review_comment` on `rejected` rows during this slice.

- [ ] Add Alembic migration `0005_product_request_review_loop.py`.

Migration details:
- Add nullable columns `locked_by_tg_id`, `locked_at`, and `review_comment`.
- Copy existing `reject_reason` values into `review_comment`.
- Use `op.batch_alter_table("product_requests")` so SQLite can rebuild the table while PostgreSQL can apply compatible constraint changes.
- Drop and recreate `ck_product_requests_status` so it allows `need_changes`.
- Add index `ix_product_requests_locked_by_tg_id`.
- Downgrade must fail clearly if live rows still use `need_changes`; otherwise drop the new index/columns and restore the old status constraint.
- In `tests/test_staff_migration.py`, keep guard and clean downgrade as separate tests: guard test inserts `need_changes` and stops after asserting downgrade failure; clean downgrade test has no `need_changes` rows and proves the new columns are removed on downgrade to `0004`.

- [ ] Extend `webapp/schemas.py`.

Add:

```python
from pydantic import ConfigDict

class ProductRequestCommentRequest(BaseModel):
    comment: str

class UpdateProductRequestReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    variant_name_ru: Optional[str] = None
    variant_name_pl: Optional[str] = None
    variant_name_uk: Optional[str] = None
    price_override: Optional[Decimal] = Field(default=None, ge=0)
    quantity: Optional[int] = Field(default=None, ge=1)
```

Update `ProductRequestSchema` with `review_comment`, `locked_by_tg_id`, and `locked_at`. Update `RejectProductRequestRequest` so it accepts old `{ "reason": "..." }` and new `{ "comment": "..." }`, with a helper/property that returns the stripped effective comment.
For edit behavior, implementations must use `body.model_fields_set` or `body.model_dump(exclude_unset=True)` so omitted `price_override` preserves the old value while explicit `price_override: null` clears it.

- [ ] Run the focused migration test again.

Run: `.venv\Scripts\python.exe -m unittest tests.test_staff_migration -v`

Expected after implementation: PASS.

- [ ] Commit this task.

```powershell
git add db/models/product_request.py webapp/schemas.py alembic/versions/0005_product_request_review_loop.py tests/test_staff_migration.py
git commit -m "Add product request review loop persistence"
```

---

### Task 2: Lifecycle Events and Lock Service

**Files:**
- Create: `webapp/services/product_request_events.py`
- Create: `webapp/services/product_request_lifecycle.py`
- Modify: `tests/test_product_requests_contract.py`

**Interfaces:**
- Consumes `ProductRequest`, staff roles, `ErrorCode`, and existing active staff helpers moved or reused from `webapp/routes/admin.py`.
- Produces event API:
  - `ProductRequestEventContext`
  - `emit_product_request_event(event_type: str, context: ProductRequestEventContext) -> None`
  - event constants `PRODUCT_REQUEST_CREATED`, `PRODUCT_REQUEST_LOCKED`, `PRODUCT_REQUEST_RELEASED`, `PRODUCT_REQUEST_NEED_CHANGES`, `PRODUCT_REQUEST_UPDATED`, `PRODUCT_REQUEST_APPROVED`, `PRODUCT_REQUEST_REJECTED`
- Produces lifecycle functions:
  - `lock_product_request(request_id: int, *, actor, session: AsyncSession) -> ProductRequest`
  - `release_product_request(request_id: int, *, actor, session: AsyncSession) -> ProductRequest`
  - `ensure_request_lock_owner(request: ProductRequest, *, actor, session: AsyncSession) -> None`

- [ ] Add failing backend tests for lock permissions.

Add tests to `tests/test_product_requests_contract.py`:
- city curator can lock only assigned city requests;
- point manager cannot lock;
- non-owner curator cannot release another curator lock;
- project admin can release another reviewer lock;
- lock emits `product_request.locked`;
- release emits `product_request.released`.
- created emits `product_request.created` when `admin_create_product_request()` succeeds.
- no lifecycle event hook imports or calls `TelegramNotificationSender`.

Implementation must import `webapp.services.product_request_events as product_request_events` and call `product_request_events.emit_product_request_event(...)`; tests patch `webapp.services.product_request_events.emit_product_request_event` to assert hook calls.

- [ ] Run focused backend tests and confirm new tests fail.

Run: `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`

Expected before implementation: FAIL because lifecycle functions do not exist.

- [ ] Implement `webapp/services/product_request_events.py`.

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProductRequestEventContext:
    request_id: int
    event_type: str
    actor_tg_id: int
    requester_tg_id: int
    city_id: int
    location_id: int
    current_status: str
    comment: str | None = None


def emit_product_request_event(event_type: str, context: ProductRequestEventContext) -> None:
    return None
```

Do not import `TelegramNotificationSender` in this module. Add a source-level test that `webapp/services/product_request_events.py` does not contain `TelegramNotificationSender` or Telegram Bot API calls.

- [ ] Wire `product_request.created` into `admin_create_product_request()`.

Implementation details:
- after the request is flushed and before or immediately after commit, build `ProductRequestEventContext`;
- call `product_request_events.emit_product_request_event(product_request_events.PRODUCT_REQUEST_CREATED, context)`;
- do not call `TelegramNotificationSender` from this hook layer.

- [ ] Implement lock helpers in `webapp/services/product_request_lifecycle.py`.

Rules:
- load request with `with_for_update()`;
- return `PRODUCT_REQUEST_NOT_FOUND` for missing rows;
- lock only `pending_review`; otherwise `PRODUCT_REQUEST_LOCK_NOT_ALLOWED_FOR_STATUS`;
- reviewer permission uses current rules: `project_admin` any city, `city_curator` assigned city;
- `point_manager` cannot lock;
- existing lock by same actor is idempotent and refreshes nothing;
- existing lock by another reviewer returns `PRODUCT_REQUEST_LOCK_EXISTS` for city curators;
- project admin can explicitly take over an existing lock only through `lock_product_request()` by setting `locked_by_tg_id` to their Telegram ID and updating `locked_at`;
- approve, reject, and need_changes never auto-takeover another reviewer's lock for project admin;
- release by owner clears lock;
- release by project admin clears any lock;
- release by non-owner returns `PRODUCT_REQUEST_LOCK_NOT_OWNER`.

- [ ] Run focused backend tests again.

Run: `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`

Expected after implementation: PASS for new lock tests and existing MVP tests.

- [ ] Commit this task.

```powershell
git add webapp/services/product_request_events.py webapp/services/product_request_lifecycle.py tests/test_product_requests_contract.py
git commit -m "Add product request review locks"
```

---

### Task 3: Verdict Transitions Require Locks

**Files:**
- Modify: `webapp/services/product_request_lifecycle.py`
- Modify: `webapp/routes/admin.py`
- Modify: `webapp/schemas.py`
- Modify: `webapp/errors.py`
- Modify: `tests/test_product_requests_contract.py`

**Interfaces:**
- Consumes lock helpers from Task 2.
- Produces lifecycle functions:
  - `approve_product_request(request_id: int, *, actor, session: AsyncSession) -> ProductRequest`
  - `reject_product_request(request_id: int, comment: str, *, actor, session: AsyncSession) -> ProductRequest`
  - `request_product_request_changes(request_id: int, comment: str, *, actor, session: AsyncSession) -> ProductRequest`

- [ ] Add failing tests for verdict lock requirements.

Tests:
- approve without lock returns `PRODUCT_REQUEST_LOCK_REQUIRED`;
- reject without lock returns `PRODUCT_REQUEST_LOCK_REQUIRED`;
- request changes without lock returns `PRODUCT_REQUEST_LOCK_REQUIRED`;
- lock owner can approve and verdict clears lock;
- lock owner can reject and verdict clears lock;
- existing happy-path approve/reject tests are updated to call `lock_product_request(request.id, actor=reviewer, session=session)` before invoking approve/reject;
- reject accepts the current payload shape `{ "reason": "..." }`;
- reject accepts the new payload shape `{ "comment": "..." }`;
- reject with empty or whitespace `reason` or `comment` returns `PRODUCT_REQUEST_COMMENT_REQUIRED`;
- request changes requires non-empty comment, sets status `need_changes`, stores `review_comment`, preserves `reject_reason is None`, and clears lock;
- project admin cannot approve, reject, or request changes on a request locked by another reviewer until they explicitly call `lock_product_request()`;
- approved and rejected rows still reject every verdict with `PRODUCT_REQUEST_TRANSITION_INVALID`.
- old row-lock source test `test_approve_uses_row_lock_for_pending_request_transition` is rewritten to inspect `webapp.services.product_request_lifecycle.approve_product_request` or replaced with a behavioral concurrent-transition test.

- [ ] Run focused tests and confirm they fail.

Run: `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`

Expected before implementation: FAIL because verdicts still bypass explicit locks and `need_changes` does not exist.

- [ ] Move current approve publication logic into `approve_product_request()`.

Implementation details:
- Keep existing atomic publication behavior for `ADD_VARIANT` and `ADD_STOCK`.
- Require `request.status == "pending_review"`.
- Call `ensure_request_lock_owner()` before publication.
- On success set `status = "approved"`, `reviewer_tg_id`, `reviewed_at`, clear `locked_by_tg_id`, clear `locked_at`.
- Emit `product_request.approved`.

- [ ] Implement `reject_product_request()`.

Implementation details:
- Strip comment and reject empty comments with `ErrorCode.PRODUCT_REQUEST_COMMENT_REQUIRED`.
- Require `pending_review`.
- Require lock ownership.
- Set `status = "rejected"`, `review_comment = comment`, `reject_reason = comment`, `reviewer_tg_id`, `reviewed_at`.
- Clear lock.
- Emit `product_request.rejected`.

- [ ] Implement `request_product_request_changes()`.

Implementation details:
- Strip comment and reject empty comments.
- Require `pending_review`.
- Require lock ownership.
- Set `status = "need_changes"`, `review_comment = comment`, `reviewer_tg_id`, `reviewed_at`.
- Do not set `reject_reason`.
- Clear lock.
- Emit `product_request.need_changes`.

- [ ] Update `webapp/routes/admin.py`.

Route changes:
- existing `POST /api/admin/product-requests/{request_id}/approve` delegates to lifecycle `approve_product_request`;
- existing `POST /api/admin/product-requests/{request_id}/reject` keeps backward compatibility with current `{ "reason": "..." }` and also accepts `{ "comment": "..." }`;
- add `POST /api/admin/product-requests/{request_id}/need-changes`;
- add `POST /api/admin/product-requests/{request_id}/lock`;
- add `POST /api/admin/product-requests/{request_id}/release`.

- [ ] Update `webapp/errors.py`.

Add:

```python
PRODUCT_REQUEST_COMMENT_REQUIRED = "product_request.comment_required"
```

- [ ] Run focused tests again.

Run: `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`

Expected after implementation: PASS.

- [ ] Commit this task.

```powershell
git add webapp/routes/admin.py webapp/schemas.py webapp/errors.py webapp/services/product_request_lifecycle.py tests/test_product_requests_contract.py
git commit -m "Require locks for product request verdicts"
```

---

### Task 4: Edit From Need Changes

**Files:**
- Modify: `webapp/services/product_request_lifecycle.py`
- Modify: `webapp/routes/admin.py`
- Modify: `tests/test_product_requests_contract.py`

**Interfaces:**
- Consumes `UpdateProductRequestReviewRequest` from Task 1.
- Produces lifecycle function:
  - `edit_product_request(request_id: int, body: UpdateProductRequestReviewRequest, *, actor, session: AsyncSession) -> ProductRequest`

- [ ] Add failing edit-loop tests.

Tests:
- original point manager can edit their own `need_changes` request for their assigned Local Point;
- city curator assigned to the request city can edit `need_changes`;
- project admin can edit `need_changes`;
- another point manager cannot edit;
- edit is blocked when `locked_by_tg_id` is set;
- edit of `ADD_VARIANT` can change variant names, price override, and quantity;
- edit of `ADD_STOCK` can change only quantity;
- sending forbidden edit fields such as `product_id`, `location_id`, `request_type`, or `variant_id` is rejected by Pydantic `extra="forbid"`;
- schema-level tests instantiate `UpdateProductRequestReviewRequest(product_id=1)` and expect `ValidationError`;
- sending `price_override: null` for `ADD_VARIANT` clears the price override;
- omitted `price_override` for `ADD_VARIANT` preserves the previous price override;
- successful edit sets status back to `pending_review`;
- successful edit clears lock fields;
- successful edit preserves `review_comment`;
- successful edit emits `product_request.updated`;
- edit of `pending_review`, `approved`, or `rejected` returns `PRODUCT_REQUEST_TRANSITION_INVALID`.

- [ ] Run focused tests and confirm they fail.

Run: `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`

Expected before implementation: FAIL because edit lifecycle does not exist.

- [ ] Implement `edit_product_request()`.

Rules:
- load row with `with_for_update()`;
- missing row returns `PRODUCT_REQUEST_NOT_FOUND`;
- only `need_changes` is editable;
- if locked, return `PRODUCT_REQUEST_EDIT_LOCKED`;
- eligible actors:
  - original requester point manager with assignment to `request.location_id`;
  - city curator assigned to `request.city_id`;
  - project admin;
- validate editable fields using the same helpers as create/approve:
  - positive quantity;
  - non-negative price override;
  - non-empty variant names for `ADD_VARIANT`;
- never modify request type, city, location, product, variant_id, requester_user_id, or requester_tg_id;
- reject forbidden fields through schema validation rather than silently ignoring them;
- treat explicit `price_override=None` as "clear price override" for `ADD_VARIANT`;
- preserve existing `price_override` when `"price_override"` is absent from `body.model_fields_set`;
- set status to `pending_review`;
- clear `locked_by_tg_id` and `locked_at`;
- keep `review_comment`;
- emit `product_request.updated`.

- [ ] Add `PATCH /api/admin/product-requests/{request_id}` in `webapp/routes/admin.py`.

Route behavior:
- accepts `UpdateProductRequestReviewRequest`;
- delegates to `edit_product_request`;
- returns `ProductRequestSchema`.

- [ ] Run focused tests again.

Run: `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`

Expected after implementation: PASS.

- [ ] Commit this task.

```powershell
git add webapp/routes/admin.py webapp/services/product_request_lifecycle.py tests/test_product_requests_contract.py
git commit -m "Add product request correction edits"
```

---

### Task 5: Backend List Filters and Schema Compatibility

**Files:**
- Modify: `webapp/routes/admin.py`
- Modify: `webapp/schemas.py`
- Modify: `tests/test_product_requests_contract.py`

**Interfaces:**
- Consumes status constants from `db/models/product_request.py`.
- Produces list query support:
  - `GET /api/admin/product-requests?mode=active|archive&status=pending_review|need_changes|approved|rejected`

- [ ] Add failing list/filter tests.

Tests:
- active mode returns only `pending_review` and `need_changes`;
- archive mode returns only `approved` and `rejected`;
- active `status=need_changes` returns only `need_changes`;
- archive `status=rejected` returns only `rejected`;
- `mode=active&status=approved` returns an empty list;
- `mode=archive&status=need_changes` returns an empty list;
- invalid mode or status returns `PRODUCT_REQUEST_STATUS_INVALID`;
- city curator and point manager scoping still applies with filters;
- `ProductRequestSchema.review_comment` is populated for rejected rows created before this slice through fallback to `reject_reason` when needed.

- [ ] Run focused tests and confirm they fail.

Run: `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`

Expected before implementation: FAIL because list filters and schema fields are missing.

- [ ] Extend `admin_list_product_requests()`.

Implementation details:
- Add optional query params `mode: str | None = None`, `status: str | None = None`.
- When `mode == "active"`, filter to active statuses.
- When `mode == "archive"`, filter to final statuses.
- When `status` is provided, validate it belongs to known statuses and combine with mode constraints; incompatible mode/status combinations are valid filters that return no rows.
- Keep existing project admin, city curator, and point manager visibility rules.

- [ ] Update `_product_request_schema()`.

Rules:
- expose `review_comment=request.review_comment or request.reject_reason`;
- expose lock fields;
- keep `reject_reason` for backward compatibility.

- [ ] Run focused tests again.

Run: `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`

Expected after implementation: PASS.

- [ ] Commit this task.

```powershell
git add webapp/routes/admin.py webapp/schemas.py tests/test_product_requests_contract.py
git commit -m "Add product request list filters"
```

---

### Task 6: Frontend API, I18n, and Static Contract Tests

**Files:**
- Modify: `frontend/src/api/admin.ts`
- Modify: `frontend/src/i18n/locales/ru.ts`
- Modify: `frontend/tests/adminCms.test.mjs`

**Interfaces:**
- Consumes backend endpoints from Tasks 3-5.
- Produces frontend API methods:
  - `getProductRequests(params?: { mode?: 'active' | 'archive'; status?: ProductRequestStatus })`
  - `lockProductRequest(id: number)`
  - `releaseProductRequest(id: number)`
  - `needChangesProductRequest(id: number, comment: string)`
  - `updateProductRequest(id: number, data: ProductRequestUpdatePayload)`

- [ ] Add failing frontend static tests.

Assertions in `frontend/tests/adminCms.test.mjs`:
- `ProductRequestStatus` includes `need_changes`;
- `AdminProductRequest` includes `review_comment`, `locked_by_tg_id`, and `locked_at`;
- admin API exposes lock/release/need-changes/update methods;
- visible action strings are not hardcoded in JSX.

- [ ] Run frontend tests and confirm they fail.

Run from `frontend/`: `npm test`

Expected before implementation: FAIL because API methods and schema/i18n contract entries do not exist.

- [ ] Extend `frontend/src/api/admin.ts`.

Types:
- `ProductRequestStatus = 'pending_review' | 'need_changes' | 'approved' | 'rejected'`
- `AdminProductRequest.review_comment?: string`
- `AdminProductRequest.locked_by_tg_id?: number`
- `AdminProductRequest.locked_at?: string`
- `ProductRequestUpdatePayload` with `variant_name_ru`, `variant_name_pl`, `variant_name_uk`, `price_override`, `quantity`.

Methods:
- Build query string for `getProductRequests(params)`.
- POST lock/release/need-changes.
- PATCH edit payload.

- [ ] Extend `frontend/src/i18n/locales/ru.ts`.

Required labels:
- status `need_changes`: `Trebuyet izmeneniy`;
- action `needChanges`: `Zaprosit izmeneniya`;
- mode labels: `Aktivnye`, `Arkhiv`;
- filters: `Vse aktivnye`, `Na proverke`, `Trebuyut izmeneniy`, `Ves arkhiv`, `Podtverzhdennye`, `Otklonennye`;
- actions: `Vzyat v proverku`, `Snyat blokirovku`, `Perekhvatit`, `Redaktirovat`, `Sokhranit izmeneniya`;
- fields: `Kommentariy proverki`, `Posledniy kommentariy`, `Kommentariy dlya menedzhera`;
- messages for lock/release/need_changes/update success.

- [ ] Run frontend tests again.

Run from `frontend/`: `npm test`

Expected after API/i18n changes and test updates: PASS. Do not add JSX page-behavior assertions in this task; they belong to Task 7.

- [ ] Commit this task.

```powershell
git add frontend/src/api/admin.ts frontend/src/i18n/locales/ru.ts frontend/tests/adminCms.test.mjs
git commit -m "Add product request frontend contract"
```

---

### Task 7: Frontend Product Requests Page

**Files:**
- Create: `frontend/src/pages/admin/productRequestActions.ts`
- Create: `frontend/tests/productRequestActions.test.mjs`
- Modify: `frontend/src/pages/admin/AdminProductRequests.tsx`
- Modify: `frontend/tests/adminCms.test.mjs`

**Interfaces:**
- Consumes frontend API methods from Task 6.
- Produces UI state:
  - mode: `active | archive`
  - active filter: `all | pending_review | need_changes`
  - archive filter: `all | approved | rejected`
  - modals for reject, request changes, and edit
  - `getProductRequestActions(input) -> ProductRequestActionState` table-tested helper

- [ ] Add or complete failing frontend tests for page behavior.

Static assertions:
- page imports `getProductRequestActions` from `./productRequestActions`;
- page calls `adminApi.lockProductRequest`;
- page calls `adminApi.releaseProductRequest`;
- page calls `adminApi.needChangesProductRequest`;
- page calls `adminApi.updateProductRequest`;
- page renders mode controls using i18n keys;
- page renders latest `review_comment`;
- page shows edit modal for `need_changes`;
- page does not show approve/reject buttons unless request is locked by current reviewer or takeover flow is available.

- [ ] Add failing table tests for `productRequestActions.ts`.

Create `frontend/tests/productRequestActions.test.mjs` using the existing `typescript.transpileModule` pattern from `frontend/tests/profileSurface.test.mjs` to load the TypeScript helper under Node's test runner. Cover cases:
- point manager on own `need_changes` sees `canEdit=true`;
- city curator on free `pending_review` sees `canLock=true`;
- city curator owning lock sees `canApprove=true`, `canReject=true`, `canRequestChanges=true`, `canRelease=true`;
- city curator on somebody else's lock sees no verdict actions;
- project admin on somebody else's lock sees `canTakeover=true` and no verdict actions until lock ownership is theirs;
- project admin owning lock sees verdict actions;
- approved/rejected rows expose no lifecycle actions.

- [ ] Run frontend tests and confirm they fail if page is not updated.

Run from `frontend/`: `npm test`

Expected before implementation: FAIL on missing page references.

- [ ] Update load flow.

Implementation details:
- Keep loading access, requests, and options in one `load()` function.
- Pass `mode` and selected status filter into `adminApi.getProductRequests`.
- Reset incompatible filter when switching mode.
- Use `adminRole` and current user Telegram ID from existing user store to calculate lock ownership.
- If current user Telegram ID is missing, frontend shows no lock-owner verdict actions and relies on backend errors.
- Track per-row action loading with `pendingActionId: string | null`, formatted as `${request.id}:${action}`, so double clicks on lock/release/approve/reject/need_changes/update are disabled while the request is in flight.

- [ ] Add action rules.

UI rules:
- free `pending_review`: eligible reviewers see take-review action;
- locked by current reviewer: show approve, request changes, reject, and release;
- locked by another reviewer: show lock owner state and no verdict buttons for city curator;
- project admin with another owner: show takeover or force-release;
- `need_changes`: eligible editor sees edit action;
- `approved` and `rejected`: no lifecycle actions.

- [ ] Implement `frontend/src/pages/admin/productRequestActions.ts`.

Inputs:
- `role: AdminStaffRole | undefined`;
- `currentTgId: number | undefined`;
- `request: AdminProductRequest`;
- `isOwnEditableRequest: boolean`.

Output booleans:
- `canLock`;
- `canTakeover`;
- `canApprove`;
- `canReject`;
- `canRequestChanges`;
- `canRelease`;
- `canEdit`.

- [ ] Add modals.

Modals:
- reject modal requires comment;
- request changes modal requires comment;
- edit modal shows latest `review_comment`;
- edit modal for `ADD_VARIANT` contains variant name, optional price override, and quantity;
- edit modal for `ADD_STOCK` contains quantity only.

- [ ] Preserve mobile row readability.

Keep:
- `className="admin-request-meta"`;
- `className="admin-request-actions admin-row-actions"`;
- existing CSS layout classes unless a small responsive fix is required.

- [ ] Run frontend checks.

Run from `frontend/`:
- `npm test`
- `npm run check:ui-strings`
- `npm run build`

Expected after implementation: all PASS.

- [ ] Commit this task.

```powershell
git add frontend/src/pages/admin/AdminProductRequests.tsx frontend/src/pages/admin/productRequestActions.ts frontend/tests/adminCms.test.mjs frontend/tests/productRequestActions.test.mjs
git commit -m "Add product request review loop UI"
```

---

### Task 8: Documentation, Verification, Review, and Deploy

**Files:**
- Modify: `docs/admin/product-requests.md`
- Modify: `docs/products/moderation.md`
- Modify: `docs/backend/error-handling.md`
- Modify: `docs/AGENT_HANDOFF.md`

**Interfaces:**
- Consumes implemented behavior from Tasks 1-7.
- Produces synchronized docs and release-ready branch.

- [ ] Update `docs/admin/product-requests.md`.

Document current Local-only implemented behavior:
- no drafts;
- no InPost requests;
- point manager creates `pending_review`;
- city curator reviews assigned cities;
- project admin reviews all;
- `need_changes` edit loop;
- locks required for verdicts;
- final statuses cannot be restored.

- [ ] Update `docs/products/moderation.md`.

Document:
- only `pending_review` can receive verdicts;
- reviewer must lock before verdict;
- request changes requires comment and moves to `need_changes`;
- only `need_changes` can be edited;
- edit returns to `pending_review`.

- [ ] Update `docs/backend/error-handling.md`.

Update the existing product request error-code table only for the new code:
- add `product_request.comment_required`;
- keep existing lock/edit rows unchanged unless implementation changes their messages.

- [ ] Update `docs/AGENT_HANDOFF.md`.

Document:
- review loop implemented in code when this task is complete;
- deployment is pending until the explicit production approval and deploy step finishes;
- next-agent instructions must preserve explicit project-admin takeover, strict PATCH fields, `price_override: null` clearing, and empty list for incompatible mode/status filters.

- [ ] Run backend verification.

Run from repo root:
- `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`
- `.venv\Scripts\python.exe -m unittest discover tests`

Expected: PASS.

- [ ] Run frontend verification.

Run from `frontend/`:
- `npm test`
- `npm run check:ui-strings`
- `npm run build`

Expected: PASS.

- [ ] Run repository checks.

Run from repo root:
- `git diff --check`
- `git status --short`

Expected:
- `git diff --check` prints no whitespace errors;
- `git status --short` shows only intended changed files before commit.

- [ ] Request code review before deploy.

Review focus:
- backend authorization and lock ownership;
- approval transaction safety;
- no-op event hooks do not send Telegram messages;
- frontend action visibility matches backend rules;
- docs match current implementation.

- [ ] Fix review findings and rerun affected checks.

Expected: reviewer findings resolved or explicitly documented as non-blocking with reason.

- [ ] Commit documentation and review fixes.

```powershell
git add docs/admin/product-requests.md docs/products/moderation.md docs/backend/error-handling.md docs/AGENT_HANDOFF.md
git commit -m "Document product request review loop"
```

- [ ] Ask the user for explicit approval before production push/deploy.

Use this question:

```text
All local checks and two reviewer passes are clean. Approve pushing main and deploying backend to Railway plus frontend to Vercel?
```

Expected: do not run `git push`, `railway up`, or `vercel deploy` until the user explicitly approves.

- [ ] Push and deploy only after all checks pass and the user approves production release.

Before pushing, run from repo root:

```powershell
git branch --show-current
git status --short
```

Expected:
- branch is `main`;
- status is clean, or only approved uncommitted local-only files are present and not staged.

Commands:
- `git push origin main`
- `npx --yes @railway/cli up --detach --message "Deploy product request review loop"`
- `Invoke-RestMethod -Uri 'https://vapebot-production.up.railway.app/health' -TimeoutSec 20 | ConvertTo-Json -Compress`
- from `frontend/`: `npx --yes vercel deploy --prod --scope team_JYm3nRKRyxalcSjDepIQDMgy --yes`
- from `frontend/`: `npx --yes vercel alias set <deployment-host>.vercel.app frontend-vapebot.vercel.app --scope team_JYm3nRKRyxalcSjDepIQDMgy`

Expected:
- backend health returns `{"status":"ok","service":"vapebot-webapp"}`;
- Vercel deployment status is `Ready`;
- alias points to the new production deployment.

## Acceptance Criteria

- Reviewer cannot approve, reject, or request changes without an active lock.
- City curator can lock/review only assigned city requests.
- Project admin can review all requests and can take over or force-release locks.
- Non-owner curator cannot act on another reviewer lock.
- `need_changes` stores a mandatory latest reviewer comment.
- Eligible users can edit only approved small fields while request is in `need_changes`.
- Edited `need_changes` requests return to `pending_review`.
- Approved/rejected requests remain final.
- Active mode shows only `pending_review` and `need_changes`.
- Archive mode shows only `approved` and `rejected`.
- No Telegram notifications are sent, but all lifecycle hook calls are test-covered.

## Risks and Rollback

- Risk: approval logic regression while moving code into lifecycle service. Mitigation: keep existing publication tests and add lock-specific approval tests before refactor.
- Risk: status check constraint migration differs between SQLite and PostgreSQL. Mitigation: write migration with explicit Alembic batch operations for SQLite and PostgreSQL-compatible constraint replacement, then test `Base.metadata.create_all` plus Alembic upgrade locally.
- Risk: frontend buttons imply permissions the backend rejects. Mitigation: backend remains authoritative and frontend displays API errors from existing error handling.
- Risk: broad token/CLI access can deploy unintended changes. Mitigation: deploy only after clean tests, review, and explicit final deploy step.
- Rollback: revert the feature commits and downgrade Alembic from `0005` to `0004`; downgrade must be run only after no live rows remain in `need_changes`.

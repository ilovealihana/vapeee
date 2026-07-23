# Local Product Requests MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a testable Local-only product request workflow where point managers create requests for their assigned point and city curators or project admins approve or reject them.

**Architecture:** Add persistent request tables separate from live catalog tables, then publish into `product_variants` and `location_stock` only on approve. Keep permissions backend-owned: `point_manager` can create/read own point requests, `city_curator` can review requests in assigned cities, and `project_admin` can review all. Add one admin tab so the feature is manually testable in Telegram Mini App.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, Pydantic v2, React, Vite, TypeScript, node:test.

---

## Scope

In scope:
- Local Point only.
- Request types: `ADD_VARIANT`, `ADD_STOCK`.
- Creation status: `pending_review` immediately, no draft.
- `ADD_VARIANT`: existing product, new variant name, optional price override, positive initial quantity for requester location.
- `ADD_STOCK`: existing variant, positive quantity delta for requester location.
- Reject reason is required.
- Frontend admin tab: list, create, approve, reject.

Out of scope:
- New product creation.
- InPost inventory and InPost requests.
- Photo/media upload or `image_file_id`.
- Telegram notifications.
- Review locks and edit-during-review.

## Files

Create:
- `db/models/product_request.py` - request header and payload rows.
- `alembic/versions/0004_product_requests.py` - persistence migration.
- `tests/test_product_requests_contract.py` - backend contract tests.
- `frontend/src/pages/admin/AdminProductRequests.tsx` - admin UI tab.

Modify:
- `db/models/__init__.py` - register request models.
- `webapp/schemas.py` - request/response DTOs.
- `webapp/routes/admin.py` - product request endpoints and approval logic.
- `frontend/src/api/admin.ts` - product request types and API methods.
- `frontend/src/App.tsx` - route `/admin/product-requests`.
- `frontend/src/pages/admin/AdminLayout.tsx` - tab entry.
- `frontend/src/i18n/locales/ru.ts` - Russian UI strings and error labels.
- `frontend/tests/adminCms.test.mjs` - route/API/i18n surface tests.

---

### Task 1: Backend Model and Migration

- [ ] Add `ProductRequest` model with fields: `id`, `request_type`, `status`, `requester_user_id`, `requester_tg_id`, `city_id`, `location_id`, `product_id`, `variant_id`, `variant_name_ru`, `variant_name_pl`, `variant_name_uk`, `price_override`, `quantity`, `reject_reason`, `published_variant_id`, `reviewer_tg_id`, timestamps.
- [ ] Add check constraints for supported request types/statuses and positive `quantity`.
- [ ] Add Alembic migration `0004_product_requests.py`.
- [ ] Register model in `db/models/__init__.py`.
- [ ] Test migration with `python -m unittest tests.test_staff_migration -v` and full discovery later.

### Task 2: Backend Permission and Validation Tests

- [ ] Create backend tests first in `tests/test_product_requests_contract.py`.
- [ ] Cover point manager can create `ADD_VARIANT` for assigned location.
- [ ] Cover point manager cannot create for another location.
- [ ] Cover point manager can create `ADD_STOCK` for existing variant.
- [ ] Cover city curator can approve only requests in assigned city.
- [ ] Cover project admin can approve any request.
- [ ] Cover reject requires non-empty reason.
- [ ] Cover approve `ADD_VARIANT` creates live variant and stock row atomically.
- [ ] Cover approve `ADD_STOCK` increments existing location stock.

### Task 3: Backend Schemas and Endpoints

- [ ] Add schemas:
  - `CreateProductRequestRequest`
  - `RejectProductRequestRequest`
  - `ProductRequestSchema`
- [ ] Add endpoint `GET /api/admin/product-requests`.
- [ ] Add endpoint `POST /api/admin/product-requests`.
- [ ] Add endpoint `POST /api/admin/product-requests/{request_id}/approve`.
- [ ] Add endpoint `POST /api/admin/product-requests/{request_id}/reject`.
- [ ] Validate active city/location/product/variant.
- [ ] Enforce point manager and city curator scopes from `staff_assignments`.
- [ ] Use existing error codes under `ErrorCode.PRODUCT_REQUEST_*`.

### Task 4: Frontend API and Route Surface

- [ ] Add request types and admin API methods in `frontend/src/api/admin.ts`.
- [ ] Add `/admin/product-requests` route in `frontend/src/App.tsx`.
- [ ] Add `Заявки` tab in `AdminLayout`.
- [ ] Add i18n keys under `admin.productRequests`.
- [ ] Add source-regex tests in `frontend/tests/adminCms.test.mjs`.

### Task 5: Frontend Admin Product Requests Page

- [ ] Build one dense CMS-style page:
  - list requests with status/type/location/product;
  - create form for `ADD_VARIANT` and `ADD_STOCK`;
  - product selector from existing products;
  - variant selector for stock requests;
  - location selector limited by backend rejection, with frontend helping where possible;
  - approve/reject controls visible when backend role allows.
- [ ] Show backend errors without clearing form.
- [ ] Require reject reason in the UI before submit.
- [ ] Keep visible strings i18n-only.

### Task 6: Verification, Review, Deploy

- [ ] Run backend focused tests:
  - `.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v`
  - `.venv\Scripts\python.exe -m unittest discover tests`
- [ ] Run frontend checks:
  - `npm test`
  - `npm run check:ui-strings`
  - `npm run build`
- [ ] Run `git diff --check`.
- [ ] Request code review subagent for backend permission/publish logic and frontend role/UX wiring.
- [ ] Fix review findings.
- [ ] Commit, push `main`.
- [ ] Deploy backend to Railway and frontend to Vercel.
- [ ] Smoke-test `/health`, `/api/admin/access`, and the admin product requests tab.

## Acceptance Criteria

- A point manager can create a pending request for their assigned Local Point.
- A point manager cannot create a request for an unassigned Local Point.
- A city curator sees/reviews only requests in assigned cities.
- A project admin can review every request.
- Reject requires a reason.
- Approving `ADD_VARIANT` creates a live variant and sets stock for the request location.
- Approving `ADD_STOCK` increments existing stock for the request location.
- Approved/rejected requests cannot be approved/rejected again.
- Frontend lets the user manually test create/approve/reject in one admin tab.
- All new visible UI strings are in Russian i18n.

## Risks and Rollback

- Risk: approval writes live catalog data incorrectly. Mitigation: approval runs in one DB transaction and tests assert live rows.
- Risk: role scope leaks requests across cities. Mitigation: backend scope tests for point manager, city curator, and project admin.
- Risk: frontend shows controls that backend rejects. Mitigation: backend remains authoritative and frontend displays API errors.
- Rollback: revert the feature commit and downgrade Alembic from `0004` to `0003`.

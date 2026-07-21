# Point Manager Catalog Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Local Point catalog availability to active `point_manager` staff assignments.

**Architecture:** Keep `staff_members` and `staff_assignments` as the only manager source of truth. Compute manager fields for `LocationSchema` at API boundaries, enforce uniqueness in staff mutations, and update frontend UI to show coming-soon points without allowing catalog navigation.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic, React, TypeScript, Vite, Node test runner, Python unittest.

---

### Task 1: Backend Contract Tests

**Files:**
- Modify: `tests/test_admin_staff_contract.py`
- Modify: `tests/test_api_errors.py`
- Test command: `python -m unittest tests.test_admin_staff_contract tests.test_api_errors -v`

- [ ] Add tests proving that creating or updating a second active `point_manager` for the same `location_id` returns `staff.assignment_duplicate`.
- [ ] Add tests proving that `/api/cities/{city_id}/locations` returns active points without managers with `catalog_available=false`.
- [ ] Add tests proving that product catalog endpoints reject points without active managers.
- [ ] Run tests and verify they fail before implementation.

### Task 2: Backend Implementation

**Files:**
- Modify: `webapp/schemas.py`
- Modify: `webapp/routes/admin.py`
- Modify: `webapp/routes/catalog.py`
- Modify: `db/repositories/catalog.py`

- [ ] Add computed manager fields to `LocationSchema`.
- [ ] Add helper queries that find an active `point_manager` for a location.
- [ ] Populate manager fields in admin and customer location responses.
- [ ] Enforce one active point manager per location in staff create/update flows.
- [ ] Make catalog location validation require an active manager.
- [ ] Run backend tests and verify they pass.

### Task 3: Frontend Tests

**Files:**
- Modify: `frontend/tests/adminCms.test.mjs`
- Modify: or create focused static/runtime test for `frontend/src/pages/Locations.tsx`
- Test command: `npm test`

- [ ] Add tests proving the admin location modal no longer renders `telegramManager`.
- [ ] Add tests proving admin point rows reference manager assignment fields.
- [ ] Add tests proving customer location cards use `catalog_available` and show `locations.comingSoon`.
- [ ] Run tests and verify they fail before implementation.

### Task 4: Frontend Implementation

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/admin.ts`
- Modify: `frontend/src/pages/admin/AdminCities.tsx`
- Modify: `frontend/src/pages/Locations.tsx`
- Modify: `frontend/src/i18n/locales/ru.ts`

- [ ] Add `has_manager`, `manager_tg_id`, and `catalog_available` to frontend location types.
- [ ] Remove Telegram manager input and payload from admin point forms.
- [ ] Show manager status in admin point rows.
- [ ] Disable customer catalog navigation for points with `catalog_available=false`.
- [ ] Add Russian UI strings for `Нет менеджера`, `Менеджер: ID {id}`, and `Скоро открытие`.
- [ ] Run frontend tests and verify they pass.

### Task 5: Verification and Release

**Files:**
- No code-only files expected beyond previous tasks.

- [ ] Run `python -m unittest discover tests -v`.
- [ ] Run `npm test`.
- [ ] Run `npm run check:ui-strings`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit, push `main`, deploy frontend to Vercel, deploy backend to Railway, and smoke-test `/api/admin/access`, `/api/admin/staff`, and customer locations.

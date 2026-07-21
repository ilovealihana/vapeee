# Staff/settings MVP Design

## Goal

Build the first persistent staff management slice so project admins can assign one role to a Telegram user and bind that user to one or more allowed cities or locations. This slice prepares the backend for product request permissions without implementing product requests yet.

## Scope

In scope:

- persistent staff tables for role and assignment data;
- backend admin endpoints for listing, creating, updating and deactivating staff members;
- backend validation for supported roles, Telegram ID, duplicate assignments and protected bootstrap admins;
- frontend admin tab for staff management;
- Russian UI strings for the new admin staff screen;
- backend and frontend tests.

Out of scope:

- product request workflows;
- media upload;
- replacing the existing `ADMIN_IDS` bootstrap gate for all existing admin endpoints;
- multi-language translation content beyond Russian labels already required by the current UI.

## Roles

Supported roles:

- `project_admin`: project-level administrator, no city or location assignment required.
- `city_curator`: city-level curator, requires one or more city assignments.
- `point_manager`: point-level manager, requires one or more location assignments.
- `inpost_curator`: global InPost curator, no local city or location assignment in this MVP because InPost is a single global source.

Each staff user has exactly one role at a time. Multiple cities or locations are represented as assignment rows for the same staff member.

## Data Model

Add `staff_members`:

- `id`;
- `tg_id`, unique;
- `role`;
- `is_active`;
- `created_at`;
- `updated_at`.

Add `staff_assignments`:

- `id`;
- `staff_member_id`;
- `city_id`, nullable;
- `location_id`, nullable;
- `created_at`.

Assignment rules:

- `city_curator` assignments contain `city_id` and no `location_id`;
- `point_manager` assignments contain `location_id` and no `city_id`;
- `project_admin` and `inpost_curator` do not require assignment rows;
- duplicate assignments for the same staff member and target are rejected.
- database constraints enforce that an assignment row has exactly one target: either `city_id` or `location_id`, never both and never neither.

The existing `admins` table remains untouched for compatibility.

## Access Model

Staff management mutations require a project admin actor.

For this MVP, a project admin actor is:

- any Telegram ID listed in `settings.ADMIN_IDS`;
- or an active `staff_members` row with role `project_admin`.

The current frontend admin entry gate can still use `VITE_ADMIN_IDS`, but the Staff screen must rely on backend errors for the final decision. This means a newly added staff-based `project_admin` may require a later frontend access-gate upgrade before they can open the admin shell directly. That gate upgrade is explicitly out of scope for this slice.

Bootstrap admins from `settings.ADMIN_IDS` are protected identities. They do not need seeded database rows to keep access, but if a staff row exists for one of those Telegram IDs it cannot be deactivated or demoted below `project_admin`.

## Backend API

Add endpoints under `/api/admin/staff`, protected by current admin dependency and project-admin rules:

- `GET /api/admin/staff`: list active and inactive staff with assignments;
- `POST /api/admin/staff`: create or reactivate staff by `tg_id`, role and assignments;
- `PUT /api/admin/staff/{staff_id}`: update role, active state and assignment set;
- `DELETE /api/admin/staff/{staff_id}`: soft-deactivate staff.

`POST /api/admin/staff` semantics:

- if no staff row exists for `tg_id`, create it;
- if an inactive staff row exists for `tg_id`, reactivate it, replace role and replace assignments with the submitted payload;
- if an active staff row exists for `tg_id`, reject the request with `staff.assignment_duplicate` and HTTP 409.

`PUT /api/admin/staff/{staff_id}` semantics:

- replace the single role with the submitted role when provided;
- replace the full assignment set with submitted city/location IDs when assignment arrays are provided;
- update `is_active` when provided;
- reject demoting or deactivating a protected bootstrap admin.

## Frontend UI

Add `Staff` tab in the existing admin CMS shell. The screen uses the same dense admin table/modal pattern as cities/products/stock/orders:

- list staff users by Telegram ID, role, status and assignment summary;
- create/edit modal with Telegram ID, role selector and assignment selectors;
- deactivate action with confirmation dialog;
- all visible text uses i18n keys.

The existing frontend admin gate using `VITE_ADMIN_IDS` stays as the current entry gate for this MVP. Backend remains the source of truth for protected mutations.

## Error Handling

Use existing structured error codes already present in `webapp/errors.py`:

- `staff.tg_id_required`;
- `staff.invalid_tg_id`;
- `staff.role_invalid`;
- `staff.assignment_not_found`;
- `staff.assignment_duplicate`;
- `staff.location_required`;
- `staff.location_not_allowed`;
- `staff.cannot_delete_protected_admin`;
- `staff.project_admin_required`.

`staff.location_not_allowed` is reserved for later scoped delegation. In this MVP, only project admins can manage staff, so missing or inactive city/location targets use `staff.assignment_not_found`.

## Testing

Backend tests cover:

- staff creation with valid role and assignments;
- one role per staff member;
- duplicate assignment rejection;
- role-specific assignment validation;
- bootstrap admin cannot be deactivated.

Frontend static tests cover:

- staff tab route and navigation wiring;
- admin API client staff methods;
- Staff page uses shared CMS UI and i18n keys.

## Rollback

Rollback consists of reverting the feature commit and applying Alembic downgrade for the staff tables. Existing admin functionality remains unaffected because the legacy `admins` table and `ADMIN_IDS` gate are not replaced.

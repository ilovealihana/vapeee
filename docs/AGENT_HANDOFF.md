# Agent Handoff Prompt

Use this file as the first project-specific briefing when continuing work from a fresh Codex or other coding-agent session. It complements the canonical docs under `docs/` and the current implementation state.

## Start Here

You are working on a commercial Telegram Mini App for a vape-shop network.

Required reading order before code changes:

1. `docs/README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/core/00-project-rules.md`
4. `docs/MASTER_PROMPT.md`
5. This file: `docs/AGENT_HANDOFF.md`
6. The specialized docs/spec/plan for the task.

Do not treat this file as a replacement for the canonical docs. If this file and canonical docs disagree, inspect the current code and ask the user before changing business behavior.

## Current Project Shape

- Frontend: React + Vite + TypeScript in `frontend/`.
- Backend: FastAPI + SQLAlchemy async ORM in `webapp/`, `db/`.
- Database migrations: Alembic in `alembic/versions/`.
- Tests:
  - backend unittest suite under `tests/`;
  - frontend node tests under `frontend/tests/`.
- Deployment:
  - backend Railway service: `https://vapebot-production.up.railway.app`;
  - frontend Vercel alias: `https://frontend-vapebot.vercel.app`.

## Important Working Commands

From repo root:

```powershell
.venv\Scripts\python.exe -m unittest tests.test_product_requests_contract -v
.venv\Scripts\python.exe -m unittest discover tests
git diff --check
```

From `frontend/`:

```powershell
npm test
npm run check:ui-strings
npm run build
```

Deploy commands:

```powershell
git push origin main
npx --yes @railway/cli up --detach --message "Deploy product request review loop"
Invoke-RestMethod -Uri 'https://vapebot-production.up.railway.app/health' -TimeoutSec 20 | ConvertTo-Json -Compress
```

```powershell
npx --yes vercel deploy --prod --scope team_JYm3nRKRyxalcSjDepIQDMgy --yes
npx --yes vercel alias set <deployment-host>.vercel.app frontend-vapebot.vercel.app --scope team_JYm3nRKRyxalcSjDepIQDMgy
```

Do not run production push/deploy without explicit user approval.

## User Working Style

- Respond in Russian unless explicitly asked otherwise.
- Ask one focused clarification question at a time when behavior is ambiguous.
- Prefer narrow, test-backed slices.
- Send plans and major verification checkpoints to two independent read-only reviewers.
- Work inline in the main workspace unless the user says otherwise.
- Do not remove or rewrite unrelated work.

## Current Implemented Business State

### Staff and Access

Roles currently used:

- `project_admin`: project-level admin.
- `city_curator`: curator for one or more cities.
- `point_manager`: manager for one or more Local Points.
- `inpost_curator`: exists in staff model, but InPost request flow is not implemented.

Current hierarchy for this project:

```text
project_admin -> city_curator -> point_manager
```

Admin shell access is backed by `/api/admin/access`.

Non-project roles can access the admin shell only for product requests. Full CMS tabs such as cities, products, stock, orders and staff are project-admin only.

### Local Points and Managers

Local Points are active for customers only when they have an assigned active manager.

Staff management supports deactivation and hard deletion. Point selection for staff should avoid already occupied points where applicable.

### Profile

Profile uses real user data.

Users can edit phone and email in profile. Filled contact fields are used as editable defaults during checkout.

Profile language UI shows RU/EN/PL/UK, but only RU is currently active.

### Product Request Review Loop

Implemented locally in code:

- `point_manager` creates Local-only product requests for assigned Local Points.
- `city_curator` sees and reviews requests only for assigned cities.
- `project_admin` reviews all requests.
- Request types:
  - `ADD_VARIANT`: existing product, new variant name, optional price override, quantity.
  - `ADD_STOCK`: existing product variant, quantity.
- Statuses:
  - `pending_review`
  - `need_changes`
  - `approved`
  - `rejected`
- Active statuses:
  - `pending_review`
  - `need_changes`
- Final statuses:
  - `approved`
  - `rejected`
- No drafts.
- No InPost requests.
- No media upload.
- No Telegram notifications are sent for requests in this slice.

Review behavior:

- Reviewer must explicitly lock a `pending_review` request before approve, reject or request changes.
- Lock owner can approve, reject, request changes or release.
- Project admin can explicitly take over another lock through the lock endpoint.
- Project admin can force-release any lock.
- City curator cannot act on another reviewer's lock.
- Verdicts clear the lock.
- Approved/rejected requests are final.

Correction behavior:

- Request changes requires a non-empty comment.
- `need_changes` stores latest reviewer comment.
- Original point manager, assigned city curator or project admin can edit an unlocked `need_changes` request.
- Successful edit returns the request to `pending_review`, clears lock fields and preserves latest comment.
- PATCH rejects forbidden fields such as `product_id`, `location_id`, `request_type`, and `variant_id`.
- `price_override: null` clears the override for `ADD_VARIANT`; omitted `price_override` preserves it.

List/UI behavior:

- `/admin/product-requests` has active/archive modes.
- Active mode shows only `pending_review` and `need_changes`.
- Archive mode shows only `approved` and `rejected`.
- Status filters intersect with mode; incompatible combinations return an empty list.
- Rows show latest comment.
- UI actions are lock-aware and backed by helper tests.
- Modal form state is preserved when backend action fails.

Event hook behavior:

- Internal no-op event hooks exist for request lifecycle events.
- They must not import or call Telegram notification senders in this slice.

Relevant files:

- `db/models/product_request.py`
- `alembic/versions/0005_product_request_review_loop.py`
- `webapp/routes/admin.py`
- `webapp/schemas.py`
- `webapp/services/product_request_lifecycle.py`
- `webapp/services/product_request_events.py`
- `tests/test_product_requests_contract.py`
- `frontend/src/api/admin.ts`
- `frontend/src/pages/admin/AdminProductRequests.tsx`
- `frontend/src/pages/admin/productRequestActions.ts`
- `frontend/src/i18n/locales/ru.ts`
- `frontend/tests/adminCms.test.mjs`
- `frontend/tests/productRequestActions.test.mjs`

## Deployment State

The review loop is implemented in local commits. Production deployment is pending until:

1. full local backend/frontend verification passes;
2. two read-only reviewers pass the release checkpoint;
3. the user explicitly approves pushing `main` and deploying Railway/Vercel.

## Invariants Future Agents Must Preserve

- Backend remains authoritative for product request permissions, status transitions, locks, prices, inventory and edits.
- Project admin takeover is explicit through lock; verdict endpoints must not auto-takeover.
- Verdicts require owned lock.
- `need_changes` and reject require non-empty comments.
- Final statuses are immutable.
- PATCH must reject immutable fields instead of silently ignoring them.
- `price_override: null` clears override; omitted preserves.
- Incompatible mode/status filters return an empty list.
- No Telegram notifications are sent from the no-op hook layer until a future explicit slice.

## Known Documentation Notes

The canonical current behavior is now documented in:

- `docs/admin/product-requests.md`
- `docs/products/moderation.md`
- `docs/backend/error-handling.md`

If older docs mention broader behavior such as drafts, InPost requests, cancellation, direct product creation, or notification delivery, inspect current code and ask before changing business rules.

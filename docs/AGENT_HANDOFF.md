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
.venv\Scripts\python.exe -m unittest discover tests
git diff --check
```

From `frontend/`:

```powershell
npm test
npm run check:ui-strings
npm run build
```

Deploy commands used recently:

```powershell
railway up --detach
railway status
Invoke-RestMethod -Uri 'https://vapebot-production.up.railway.app/health' -TimeoutSec 20 | ConvertTo-Json -Compress
```

```powershell
vercel deploy --prod --scope team_JYm3nRKRyxalcSjDepIQDMgy --yes
vercel alias set <deployment-host>.vercel.app frontend-vapebot.vercel.app --scope team_JYm3nRKRyxalcSjDepIQDMgy
```

## User Working Style

- Respond in Russian unless explicitly asked otherwise.
- Before business logic changes, ask detailed clarifying questions until the behavior is clear.
- Prefer narrow, test-backed slices.
- For larger features, use subagent review before final commit/deploy.
- The user actively tests in the Telegram Mini App and reports UI/flow bugs.
- Do not remove or rewrite unrelated work.

## Current Implemented Business State

### Staff and Access

Roles currently used:

- `project_admin`: project-level admin.
- `city_curator`: curator for one or more cities.
- `point_manager`: manager for one or more Local Points.
- `inpost_curator`: exists in staff model, but InPost request flow is not implemented yet.

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

Profile is no longer hardcoded. It uses real user data.

Users can edit phone and email in profile. Filled contact fields are used as plain editable defaults during checkout.

Profile language UI shows RU/EN/PL/UK, but only RU is currently active.

### Product Requests MVP

Implemented and tested end-to-end in production:

- `point_manager` creates Local-only product requests for assigned Local Points.
- `city_curator` sees and reviews requests only for assigned cities.
- `project_admin` reviews all requests.
- Request types:
  - `ADD_VARIANT`: existing product, new variant name, optional price override, quantity.
  - `ADD_STOCK`: existing product variant, quantity.
- No drafts.
- No InPost requests.
- No media upload.
- No Telegram notifications for requests yet.
- `approve` publishes to live catalog/stock.
- `reject` stores comment/reason and finalizes request.
- Approved/rejected requests cannot be approved/rejected again.
- Frontend row layout was fixed for mobile readability in commit `13d1a2c`.

Relevant files:

- `db/models/product_request.py`
- `alembic/versions/0004_product_requests.py`
- `webapp/routes/admin.py`
- `webapp/schemas.py`
- `frontend/src/pages/admin/AdminProductRequests.tsx`
- `frontend/src/api/admin.ts`
- `tests/test_product_requests_contract.py`
- `frontend/tests/adminCms.test.mjs`

## Latest Verified Production State

The user manually verified:

- a manager can create a request;
- admin can see it;
- approval immediately updates stock;
- reject opens comment input and completes;
- city curator sees no requests outside assigned city;
- after assigning the curator to the city with requests, the requests and history become visible.

## Next Approved Slice

The next approved slice is product request review loop expansion:

```text
need_changes + review lock + edit + filters/archive + notification hook prep
```

Design spec:

- `docs/superpowers/specs/2026-07-23-product-request-need-changes-lock-design.md`

The user approved the design. The next step is to write an implementation plan, then implement through tests and subagent review.

### Approved Behavior

Statuses:

- `pending_review`
- `need_changes`
- `approved`
- `rejected`

Final statuses:

- `approved`
- `rejected`

`need_changes` behavior:

- reviewer requests changes with mandatory comment;
- editable by original author, city curator for request city, and project admin;
- after successful edit, status automatically returns to `pending_review`;
- only small fields are editable:
  - `ADD_VARIANT`: variant name, price override, quantity;
  - `ADD_STOCK`: quantity;
- request type, Local Point, product and existing target variant are not editable.

Lock behavior:

- reviewer must explicitly take the request for review before approve/reject/need_changes;
- lock blocks author edits while reviewer is checking;
- lock owner can approve, reject, request changes or release;
- project admin can force-release or take over;
- another curator cannot act on somebody else's lock;
- verdict clears lock.

UI behavior:

- everything stays on `/admin/product-requests`;
- use modals, not a new detail route;
- active mode shows only `pending_review` and `need_changes`;
- archive mode shows only `approved` and `rejected`;
- active filters: all active, awaiting review, requires changes;
- archive filters: all archive, approved, rejected;
- show latest comment in row and in edit modal;
- status label for `need_changes`: "Trebuyet izmeneniy" in Russian UI;
- action label for `need_changes`: "Zaprosit izmeneniya" in Russian UI.

Notification preparation:

- do not send notifications in this slice;
- add no-op event hooks for future notifications:
  - `product_request.created`
  - `product_request.locked`
  - `product_request.released`
  - `product_request.need_changes`
  - `product_request.updated`
  - `product_request.approved`
  - `product_request.rejected`
- hooks should carry enough context for future `TelegramNotificationSender` integration.

## Known Documentation Drift

Some older docs still mention broader or older behavior, including:

- project admin as the only request reviewer;
- broader product moderation;
- InPost request support;
- notification routes for product requests.

Current implemented and user-approved behavior is:

- city curators can review requests in assigned cities;
- project admins can review all;
- InPost requests are not implemented yet;
- notifications are only prepared in the next slice, not sent.

When a conflict appears, inspect current code and the latest specs under `docs/superpowers/specs/` and ask the user before changing business rules.

## Recent Commits To Know

- `13d1a2c` - Fix product request row layout
- `0961719` - Add local product request workflow
- `366d516` - Add editable profile contacts
- `df90358` - Use real profile data

There is also a local spec commit that should be pushed with this handoff:

- `248ebbf` - Document product request need changes workflow

## Implementation Expectations For Next Agent

For the next coding task:

1. Read the design spec.
2. Create an implementation plan under `docs/superpowers/plans/`.
3. Start with failing backend tests for lock/status/edit transitions.
4. Add migration for new fields/status support.
5. Keep backend authorization authoritative.
6. Add frontend static tests for route/API/i18n/role/status UI.
7. Run backend and frontend checks.
8. Use at least one subagent review before commit/deploy.
9. Push and deploy only after tests and review are clean.

Do not implement Telegram notifications in the next slice unless the user explicitly expands scope.

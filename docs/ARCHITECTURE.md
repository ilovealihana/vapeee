# Project Architecture

**Project:** Vape Shop Telegram Mini App  
**Document Version:** 2.0.0  
**Status:** Approved  
**Architecture Status:** Frozen

## Purpose

This document defines the target technical architecture for the Vape Shop Telegram Mini App.

The product UI is the Telegram Mini App. FastAPI is the backend. The old interactive Telegram bot flows are not part of the target architecture.

The documentation structure under `docs/` remains frozen. This document updates the approved product architecture by replacing the old bot-driven architecture with a Mini App-only interface and a minimal Telegram notification sender.

## Architecture Decision

The project no longer uses Telegram bot handlers as a customer, admin, catalog, cart, order, profile, or product-management interface.

Target decision:

- keep Telegram as the platform that launches the Mini App and provides user identity through Mini App `initData`;
- keep `BOT_TOKEN` only for outbound Telegram notifications;
- send notifications through Telegram Bot API over HTTP;
- do not use `aiogram`, bot FSM, bot keyboards, polling, webhooks, or Redis-backed bot state;
- keep all customer and admin workflows inside the Mini App.

## Target Project Structure

```text
tgs/
├─ frontend/                 # Telegram Mini App, React + Vite
│  ├─ src/
│  │  ├─ api/
│  │  ├─ components/
│  │  ├─ i18n/
│  │  ├─ pages/
│  │  │  └─ admin/
│  │  ├─ store/
│  │  ├─ utils/
│  │  ├─ App.tsx
│  │  ├─ main.tsx
│  │  └─ index.css
│  ├─ tests/
│  ├─ public/
│  ├─ screenshots/
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ vercel.json
│
├─ webapp/                   # FastAPI backend for Mini App and Admin UI
│  ├─ routes/
│  ├─ main.py
│  ├─ deps.py
│  ├─ auth.py
│  └─ schemas.py
│
├─ services/                 # Backend services such as Telegram notifications
│
├─ db/                       # SQLAlchemy database layer
│  ├─ models/
│  ├─ repositories/
│  └─ session.py
│
├─ alembic/                  # Database migrations
│  ├─ versions/
│  └─ env.py
│
├─ docs/                     # Approved documentation
│  ├─ admin/
│  ├─ backend/
│  ├─ core/
│  ├─ deployment/
│  ├─ products/
│  ├─ shopping/
│  ├─ testing/
│  └─ ui/
│
├─ tests/                    # Backend and integration tests
├─ design-prototypes/        # HTML and design references
│
├─ config.py
├─ requirements.txt
├─ Dockerfile
├─ docker-compose.yml
├─ railway.toml
├─ alembic.ini
└─ .env / .env.example
```

Legacy paths to remove during the bot-removal implementation stage:

```text
bot/
main.py                     # old bot entrypoint
locales/                    # old bot Fluent translations, if not reused elsewhere
```

## High-Level System Architecture

```text
                  Telegram Client
                        |
                        v
              Telegram Mini App
                React + Vite
                        |
                        v
                  FastAPI API
                        |
        +---------------+---------------+
        |                               |
        v                               v
 Business Services              Auth and Permissions
        |
        v
 Repository Layer
        |
        v
 SQLAlchemy Models
        |
        v
 Database

 FastAPI Notification Service
        |
        v
 Telegram Bot API sendMessage
```

## Main Applications

## Frontend

Directory:

```text
frontend/
```

Frontend is the Telegram Mini App and the administrative web interface.

Technology:

- React;
- TypeScript;
- Vite;
- Zustand;
- React Router;
- `i18next` and `react-i18next`;
- Telegram Mini App SDK or equivalent integration;
- frontend API client.

Frontend owns:

- customer UI;
- admin UI;
- navigation;
- local UI state;
- loading, empty and error states;
- language switching;
- display of backend data;
- safe optimistic UI only where backend validation remains authoritative.

Frontend does not own:

- roles;
- permissions;
- prices;
- inventory;
- product-source membership;
- server cart validity;
- request moderation;
- checkout validity;
- order status transitions.

## Existing Frontend Design

The existing frontend design must be preserved.

Implementation principle:

> Connect real backend behavior to the existing interface and design system instead of replacing the UI without a concrete need.

Allowed:

- add loading states;
- connect API calls;
- add validation;
- add missing screens;
- reuse existing components;
- extend Zustand stores;
- fix UX issues that block business logic.

Not allowed:

- full redesign without explicit approval;
- parallel frontend implementation;
- deleting approved screens only because backend is not ready yet;
- duplicating backend business rules as frontend-only security.

## Frontend Structure

## API

Directory:

```text
frontend/src/api/
```

Expected API modules:

```text
client.ts
auth.ts
catalog.ts
cart.ts
orders.ts
admin.ts
productRequests.ts
staff.ts
settings.ts
media.ts
```

Existing API files do not need to be split immediately unless the implementation task requires it.

## i18n

Directory:

```text
frontend/src/i18n/
```

Frontend UI localization is defined in `docs/ui/localization.md`.

Required languages:

- `ru`;
- `pl`;
- `uk`.

Product names, product descriptions, variant names, variant descriptions and user/admin comments are content data and must not be auto-translated as UI labels.

## Components

Directory:

```text
frontend/src/components/
```

Components contain reusable UI. Components must not own critical backend business logic.

Examples:

- TopBar;
- BottomNav;
- ProductCard;
- Icon;
- Smoke;
- loaders;
- empty states;
- error states;
- form controls;
- product variant selector;
- localized status badges.

## Pages

Directory:

```text
frontend/src/pages/
```

Customer Mini App screens include:

- Home;
- Mode Selection;
- Cities;
- Local Points;
- Products;
- Product Details;
- Cart;
- Checkout;
- Orders;
- Profile.

## Admin Pages

Directory:

```text
frontend/src/pages/admin/
```

Admin screens include:

- Dashboard;
- Cities;
- Products;
- Product Requests;
- Stock;
- Orders;
- Settings.

Settings contains tabs:

- Staff;
- Sources.

`Product Requests` is shown after `Products` in the admin menu.

## Store

Directory:

```text
frontend/src/store/
```

Frontend store may keep:

- active shopping mode;
- selected city;
- selected Local Point;
- frontend cache of backend carts;
- user data;
- current language;
- admin permissions returned by `/api/admin/me`;
- temporary form state;
- UI preferences.

Frontend store is not permanent storage for carts, orders, product requests, staff permissions, or settings.

## Web Application Backend

Directory:

```text
webapp/
```

Technology:

- FastAPI;
- Pydantic;
- SQLAlchemy through the database layer;
- Telegram Mini App authentication validation;
- dependency injection through FastAPI dependencies.

Backend serves:

- Telegram Mini App;
- administrative Mini App UI;
- notification sending through a backend service.

Backend does not serve interactive Telegram bot flows.

## Routes

Directory:

```text
webapp/routes/
```

Expected route groups:

```text
auth
user
catalog
locations
cart
orders
products
product_requests
categories
media
admin
staff
settings
```

Do not create one large admin route file for unrelated domains when a focused route module is clearer.

## Backend Responsibilities

Backend is the source of truth for:

- Telegram Mini App authentication;
- roles and permissions;
- staff assignments;
- cities and Local Points;
- catalog;
- InPost global source status;
- products;
- variants;
- prices;
- inventory;
- carts;
- checkout;
- orders;
- product request moderation;
- notifications;
- error codes.

## Telegram Notification Sender

The product keeps a minimal outbound notification sender.

It is not an interactive Telegram bot.

Allowed:

- send Telegram messages through Bot API `sendMessage`;
- include inline buttons that open Mini App routes;
- use `BOT_TOKEN`;
- log send failures;
- keep business state changes committed even if notification sending fails.

Not allowed:

- aiogram Dispatcher;
- polling;
- webhooks;
- bot FSM;
- Redis-backed bot state;
- bot catalog/cart/order/profile/admin flows;
- Telegram keyboards as the primary product UI.

Notification button targets use normal Mini App URLs built from `WEBAPP_URL`.

Examples:

```text
{WEBAPP_URL}/admin/product-requests/{id}
{WEBAPP_URL}/admin/orders/{id}
{WEBAPP_URL}/profile/requests
```

Notification rules are defined in `docs/backend/notifications.md`.

## Database Layer

Directory:

```text
db/
```

Database access is separated through:

```text
db/models/
db/repositories/
db/session.py
```

Models define persistent data. Repositories own database queries and persistence operations.

Route handlers should not contain complex raw SQL when a repository or service boundary is clearer.

## Migrations

Directory:

```text
alembic/
```

Schema changes require Alembic migrations.

Migrations must preserve existing data whenever possible and include rollback or recovery consideration.

## Localization

Frontend UI localization is owned by `frontend/src/i18n/` and documented in `docs/ui/localization.md`.

The old `locales/` Fluent folder belongs to the legacy bot implementation unless explicitly reused by another approved layer.

## Testing

## Frontend Tests

Directory:

```text
frontend/tests/
```

Used for:

- UI regression;
- layout checks;
- component behavior;
- navigation;
- i18n hardcoded text checks;
- critical user flows.

## Backend Tests

Directory:

```text
tests/
```

Used for:

- API;
- permissions;
- repositories;
- product request moderation;
- inventory;
- carts;
- checkout;
- orders;
- notification service behavior.

## Design Prototypes

Directory:

```text
design-prototypes/
```

Contains approved or intermediate HTML and design references.

Existing frontend and approved design references have priority over ad hoc redesign.

## Deployment

## Frontend

Frontend may be deployed through Vercel according to:

```text
frontend/vercel.json
```

## Backend

Backend may be deployed through:

- Railway;
- Docker;
- Docker Compose;
- Procfile-compatible platform.

Target deployment has one backend web process. There is no separate bot worker process in the approved architecture.

Configuration files:

```text
railway.toml
Dockerfile
docker-compose.yml
Procfile
```

## Environment Configuration

Configuration is managed through:

```text
config.py
.env
.env.example
```

Required environment variables:

- `BOT_TOKEN` - used only for outbound Telegram notifications;
- `DATABASE_URL`;
- `ADMIN_IDS`;
- `WEBAPP_URL`;
- other variables required by current backend features.

`REDIS_URL` is not required in the target architecture unless a later approved feature introduces Redis again.

Secrets must not be stored in code.

`.env.example` must list required variables without real secrets.

## Implementation Strategy

Functionality is delivered as complete vertical slices:

```text
Database
    |
Repository
    |
Backend schema and service
    |
API route
    |
Frontend API client
    |
Frontend state
    |
Existing UI
    |
Tests
    |
Documentation
```

Do not implement only decorative frontend flows without backend behavior when the feature requires backend rules.

## Updated Feature Order

Approved implementation order:

1. Bot removal and notification-only architecture.
2. Full frontend i18n migration.
3. Staff/settings.
4. Product request backend.
5. Media/upload.
6. Product requests frontend and notifications.

## Product Request Flow

Product request requirements are defined in:

- `docs/admin/product-requests.md`;
- `docs/products/moderation.md`;
- `docs/products/product-model.md`;
- `docs/products/inventory.md`.

The current approved request types are:

- `ADD_VARIANT`;
- `ADD_STOCK`.

## Architectural Boundaries

## Local and InPost

Local Points and InPost are independent shopping sources.

They cannot share:

- inventory;
- carts;
- checkout;
- fulfillment methods.

InPost is a single global source in the approved MVP model. Its active state is stored in DB settings.

## Staff and Administrator

The approved hierarchy is:

```text
project_admin > city_curator > point_manager
```

InPost has a dedicated `inpost_curator` role.

`project_admin` is the only role that can review product requests.

## Frontend and Backend

Frontend preserves design and interaction.

Backend enforces business behavior and security.

## Documentation Architecture

The documentation structure under:

```text
docs/
```

is frozen.

No documentation directories or files should be moved, renamed or reorganized without explicit user approval.

## Definition of Done

The architecture is respected when:

- the existing frontend design is preserved;
- Mini App is the only customer/admin interface;
- old interactive bot flows are removed;
- Telegram Bot API is used only for outbound notifications;
- Redis is not required unless a later approved feature needs it;
- backend business logic is not duplicated in frontend;
- database access is separated through repositories;
- schema changes use Alembic;
- permissions are validated by backend;
- functionality is delivered as complete vertical slices;
- Local Points and InPost remain independent;
- code and documentation remain synchronized.

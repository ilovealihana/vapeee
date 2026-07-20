# Environments

**Version:** 1.0.0  
**Status:** Approved

## Purpose

This document defines supported runtime environments for the Mini App-only architecture.

The target deployment has a frontend Mini App and one FastAPI backend process. There is no separate interactive Telegram bot process.

## Scope

In scope:

- local development;
- preview/staging;
- production;
- required environment variables;
- database;
- notification configuration;
- Redis removal from required infrastructure.

Out of scope:

- cloud provider billing;
- CI/CD pipeline details;
- external object storage selection.

## Related documents

- `docs/ARCHITECTURE.md`
- `docs/backend/notifications.md`
- `docs/backend/database.md`
- `docs/deployment/README.md`
- `docs/deployment/releases.md`

## Environment types

## Local development

Local development may use:

- SQLite for quick backend development;
- PostgreSQL when testing production-like database behavior;
- local Vite dev server for frontend;
- FastAPI dev server for backend.

Redis is not required for the target architecture.

Local notification testing requires a valid `BOT_TOKEN` and reachable Telegram API.

## Preview/Staging

Preview/staging should use:

- deployed frontend preview URL;
- deployed FastAPI backend URL;
- staging or isolated database;
- `WEBAPP_URL` pointing to the preview frontend;
- non-production or controlled Telegram notification recipients when possible.

## Production

Production should use:

- deployed frontend URL;
- deployed FastAPI backend;
- production database;
- `WEBAPP_URL` pointing to the production Mini App URL;
- `BOT_TOKEN` for outbound notifications.

Production must not require:

- `REDIS_URL`;
- aiogram;
- bot polling;
- bot webhook.

## Required environment variables

Required:

```text
BOT_TOKEN
DATABASE_URL
ADMIN_IDS
WEBAPP_URL
```

Optional depending on deployment:

```text
INPOST_DELIVERY_COST
SUPPORT_USERNAME
```

Not required in the target architecture:

```text
REDIS_URL
WEBHOOK_HOST
WEBHOOK_PATH
WEBHOOK_PORT
```

Legacy bot variables may be removed during the bot-removal implementation stage.

## Database

Development may use SQLite when the task does not depend on PostgreSQL-specific behavior.

Production should use PostgreSQL.

All schema changes must use Alembic migrations.

## Notifications

Notifications are sent by the FastAPI backend through Telegram Bot API.

Notification configuration:

- `BOT_TOKEN` identifies the Telegram bot used only as an outbound sender;
- `WEBAPP_URL` is used to build Mini App route buttons.

No separate notification worker is required for the MVP.

## Redis

Redis is removed from required infrastructure.

Redis may be reintroduced only after an approved feature explicitly needs:

- queues;
- retry jobs;
- rate limiting;
- cache;
- distributed locks.

Until then, the application must start and operate without Redis.

## Edge cases

- `BOT_TOKEN` missing in environment where notifications are enabled: notification sending fails with logged configuration error.
- `WEBAPP_URL` points to wrong frontend: notification buttons open wrong route; deployment validation must check it.
- SQLite local dev differs from PostgreSQL constraints: production-like database should be used for migration and concurrency-sensitive testing.
- Redis variable remains in old `.env`: application should ignore it once Redis is no longer configured.

## Definition of Done

Environment configuration is correct when:

- FastAPI backend can run without Redis;
- no interactive bot process is required;
- frontend uses the correct backend API URL;
- backend uses the correct `WEBAPP_URL` for notification buttons;
- migrations run against the selected database;
- `.env.example` documents only current required and optional variables.

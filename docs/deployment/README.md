# Deployment

**Version:** 1.0.0  
**Status:** Approved

## Purpose

This document summarizes deployment rules for the Mini App-only architecture.

The target system deploys the frontend Mini App and the FastAPI backend. Telegram notification sending is part of the backend and does not require a separate bot process.

## Related documents

- `docs/ARCHITECTURE.md`
- `docs/deployment/environments.md`
- `docs/deployment/releases.md`
- `docs/backend/notifications.md`
- `docs/backend/database.md`

## Deployment components

## Frontend

Directory:

```text
frontend/
```

Responsibilities:

- build React/Vite Mini App;
- serve customer UI;
- serve admin UI;
- handle frontend routing for notification button URLs;
- use backend API URL from frontend environment configuration.

Expected deployment target:

- Vercel or equivalent static frontend hosting.

## Backend

Directory:

```text
webapp/
```

Responsibilities:

- FastAPI API;
- Telegram Mini App auth validation;
- catalog/cart/order/product request/admin APIs;
- staff/settings APIs;
- media upload;
- Telegram notification sender through HTTP Bot API.

Expected deployment target:

- Railway or equivalent Python web service hosting.

## Removed deployment component

The old interactive Telegram bot worker is not part of the target deployment.

Do not deploy:

- aiogram polling process;
- aiogram webhook process;
- bot FSM worker;
- separate `bot` process in `Procfile`;
- Redis service only for bot FSM.

## Configuration files

Current deployment-related files:

```text
frontend/vercel.json
railway.toml
Dockerfile
docker-compose.yml
Procfile
.env.example
```

These files must be updated during the bot-removal implementation stage so they match the target architecture.

## Target process model

Target production process:

```text
web: alembic upgrade head && uvicorn webapp.main:app --host 0.0.0.0 --port $PORT
```

No target `bot:` process.

## Required environment variables

Backend:

```text
BOT_TOKEN
DATABASE_URL
ADMIN_IDS
WEBAPP_URL
```

Frontend:

```text
VITE_API_URL
```

Optional backend variables depend on enabled features and are documented in `docs/deployment/environments.md`.

## Database migrations

Backend deployment must run:

```text
alembic upgrade head
```

before serving traffic or as part of the startup command.

Migrations must be reviewed before production deployment when they affect existing data.

## Notifications

Notifications do not require a second deployed service.

The FastAPI backend sends Telegram messages directly through Bot API.

Notification buttons use `WEBAPP_URL` and normal Mini App routes.

## Local deployment

Local development may run:

```text
uvicorn webapp.main:app --reload
```

and:

```text
npm run dev
```

inside `frontend/`.

Docker Compose may be used for database support, but Redis is not required by the target application.

## Edge cases

- Old deployment still starts `python main.py`: deployment is using legacy bot entrypoint and must be updated.
- `REDIS_URL` is missing: target app must still start.
- `BOT_TOKEN` is missing: backend can run core APIs, but notification sending must fail gracefully and log configuration error.
- `WEBAPP_URL` is wrong: notification buttons open wrong app target.

## Definition of Done

Deployment is aligned with architecture when:

- frontend deploys as Mini App UI;
- backend deploys as one FastAPI web process;
- no aiogram bot process is deployed;
- Redis is not required;
- migrations run during backend deployment;
- notification sending works from backend through Telegram Bot API;
- `.env.example`, `Procfile`, `railway.toml`, `Dockerfile` and `docker-compose.yml` match this architecture.

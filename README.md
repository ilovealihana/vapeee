# VapeShop Telegram Mini App

Telegram Mini App для vape shop: клиентский интерфейс работает во frontend, backend работает как FastAPI API. Telegram bot используется только как outbound sender для уведомлений через Telegram Bot API.

## Стек

- Python 3.11+
- FastAPI
- SQLAlchemy 2.0 async
- Alembic
- PostgreSQL для production
- SQLite допустим для локальной разработки
- Docker Compose для backend + PostgreSQL
- Telegram Bot API через `httpx` для уведомлений

## Быстрый старт

### 1. Настроить окружение

```bash
cp .env.example .env
```

Заполни в `.env` базовые значения:

```text
DATABASE_URL=postgresql+asyncpg://vapebot:vapebot_secret@localhost:5432/vapebot
ADMIN_IDS=123456789,987654321
WEBAPP_URL=https://your-vapeshop.vercel.app
```

`BOT_TOKEN` нужен для отправки Telegram-уведомлений. Если он пустой, backend стартует, а отправка уведомлений логирует ошибку и возвращает `False`.

### 2. Запуск через Docker Compose

```bash
docker compose up postgres backend
```

Compose запускает PostgreSQL и FastAPI backend. Redis и отдельный bot process не нужны.

### 3. Локальный запуск без Docker

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn webapp.main:app --reload
```

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `BOT_TOKEN` | Telegram bot token для outbound уведомлений |
| `DATABASE_URL` | SQLAlchemy async database URL |
| `ADMIN_IDS` | Comma-separated Telegram IDs project admins |
| `INPOST_DELIVERY_COST` | Стоимость доставки InPost |
| `SUPPORT_USERNAME` | Telegram username поддержки без `@` |
| `WEBAPP_URL` | URL frontend Mini App |

## Структура

```text
tgs/
  alembic/                # DB migrations
  db/                     # SQLAlchemy models and repositories
  docs/                   # Project documentation
  frontend/               # Telegram Mini App frontend
  tests/                  # unittest tests
  webapp/                 # FastAPI backend
    routes/               # API routes
    services/             # Backend services, including notifications
  config.py               # Settings via pydantic-settings
  docker-compose.yml      # backend + PostgreSQL local services
```

## Уведомления

Уведомления отправляются backend-ом через Telegram Bot API. Отправка best-effort: ошибки Telegram API или сети логируются и не должны откатывать бизнес-операции.

Кнопки в уведомлениях должны вести на обычные Mini App routes, построенные от `WEBAPP_URL`.

## Миграции

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

## Тесты

```bash
python -m unittest discover -s tests -v
```

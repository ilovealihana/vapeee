# 🛒 VapeShop Telegram Bot

Telegram-бот магазин для продажи вейпов, электронных сигарет и одноразок в Польше.

## Стек

- **Python 3.11+** + **aiogram 3**
- **PostgreSQL** + **SQLAlchemy 2.0** (async)
- **Redis** (FSM storage)
- **Docker Compose**
- Мультиязычность: 🇷🇺 RU / 🇵🇱 PL / 🇺🇦 UK (Fluent .ftl)

## Быстрый старт

### 1. Клонирование и настройка окружения

```bash
cp .env.example .env
# Отредактируй .env — вставь BOT_TOKEN и ADMIN_IDS
```

### 2. Запуск через Docker

```bash
docker-compose up --build
```

Это запустит PostgreSQL, Redis и сам бот. Миграции применяются автоматически.

### 3. Разработка без Docker

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # заполни переменные
alembic upgrade head
python main.py
```

> Нужны запущенные PostgreSQL и Redis (или используй Docker только для них):
> ```bash
> docker-compose up postgres redis -d
> ```

## Структура проекта

```
tgs/
├── bot/
│   ├── handlers/       # Message & callback handlers
│   │   └── admin/      # Admin panel handlers
│   ├── keyboards/      # Keyboard builders
│   ├── middlewares/    # DB session + locale injection
│   ├── states/         # FSM states
│   ├── filters/        # IsAdmin filter
│   └── utils/          # Calendar widget, i18n, formatters
├── db/
│   ├── models/         # SQLAlchemy models
│   └── repositories/   # DB query layer
├── locales/            # Fluent .ftl files (ru/pl/uk)
├── alembic/            # Migrations
├── config.py           # Settings via pydantic-settings
└── main.py             # Entry point
```

## Конфигурация (.env)

| Переменная | Описание |
|-----------|---------|
| `BOT_TOKEN` | Токен от @BotFather |
| `DATABASE_URL` | asyncpg URL к PostgreSQL |
| `REDIS_URL` | Redis URL |
| `ADMIN_IDS` | Telegram ID администраторов через запятую |
| `INPOST_DELIVERY_COST` | Стоимость доставки InPost (PLN) |
| `SUPPORT_USERNAME` | Telegram username поддержки |
| `WEBHOOK_HOST` | Оставь пустым для polling (разработка) |

## Функционал

### 👤 Пользователь
- `/start` — регистрация, главное меню
- **🏪 Самовывоз** — города → точки → каталог → корзина
- **📦 InPost** — каталог без привязки к точке
- **🛒 Корзина** → оформление заказа:
  - Тип доставки → Имя/Телефон/Email → [Адрес] → Дата → Время → Сводка → Оплата
- **👤 Профиль** — история заказов, смена языка, поддержка

### 🔧 Администратор (`/admin`)
- **Товары** — добавить/скрыть товар, добавить вариант (вкус/цвет)
- **Локации** — города и точки самовывоза
- **Остатки** — обновить количество по точке + варианту
- **Заказы** — просмотр новых заказов, смена статуса, уведомление клиента

## Способы оплаты
- 💵 Наличные (при получении)
- 📱 Blik
- 🇺🇦 Monobank (карта UA)

## Миграции

```bash
# Создать новую миграцию
alembic revision --autogenerate -m "description"

# Применить
alembic upgrade head

# Откатить
alembic downgrade -1
```

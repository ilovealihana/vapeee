# Notifications

**Version:** 1.0.0  
**Status:** Approved

## Purpose

This document defines outbound notification behavior for the Mini App architecture.

Notifications are sent through Telegram Bot API by the backend. The project does not use an interactive Telegram bot interface.

## Scope

In scope:

- backend notification service;
- Telegram `sendMessage`;
- Mini App URL buttons;
- product request notifications;
- order notification targets when implemented;
- failure handling.

Out of scope:

- interactive bot commands;
- polling;
- webhooks;
- aiogram FSM;
- Redis queues;
- marketing broadcasts;
- push notifications outside Telegram.

## Related documents

- `docs/ARCHITECTURE.md`
- `docs/backend/error-handling.md`
- `docs/admin/product-requests.md`
- `docs/products/moderation.md`
- `docs/deployment/environments.md`
- `docs/deployment/README.md`

## Notification architecture

Notifications are sent by backend service code using direct HTTP calls to Telegram Bot API.

Required configuration:

- `BOT_TOKEN`;
- `WEBAPP_URL`.

Runtime dependencies:

- an async HTTP client, such as `httpx`;
- no `aiogram`;
- no Redis;
- no bot polling or webhook server.

The notification sender is a backend service, not a second application interface.

## Message buttons

Telegram messages may include inline buttons that open normal Mini App routes.

Button URLs are built from `WEBAPP_URL`.

Examples:

```text
{WEBAPP_URL}/admin/product-requests/{request_id}
{WEBAPP_URL}/admin/orders/{order_id}
{WEBAPP_URL}/profile/requests
```

Frontend must validate auth and permissions after the user opens the route.

## Business rules

1. Notification sending must not be the source of truth for business state.
2. Business state changes must not be rolled back only because a notification failed.
3. Notification failures must be logged.
4. Notification text must be localizable when it is user-facing.
5. Notification buttons must point to Mini App routes, not bot commands.
6. Backend must not depend on Redis to send notifications.
7. Backend must not start an interactive Telegram bot process for notifications.

## Product request notifications

Author receives Telegram message for:

- `needs_changes`;
- `approved`;
- `rejected`.

Author does not receive Telegram message for:

- `cancelled`;
- `review_started`;
- `review_released`;
- `updated`.

Local approved request:

- notify author;
- notify manager or managers assigned to the target Local Point.

InPost approved request:

- notify author;
- notify all active `inpost_curator` assignments.

Notification failure does not roll back the request status change.

## UI notification badges

Mini App UI badge rules are separate from Telegram message delivery.

Badge-triggering statuses:

- `needs_changes`;
- `approved`;
- `rejected`;
- `cancelled`.

Read state is stored through `product_request_event_reads`.

Users clear UI badges by pressing `Mark as read`.

## Backend requirements

Backend notification service must:

- accept recipient Telegram IDs;
- accept message template/key and structured parameters;
- build Mini App button URLs from `WEBAPP_URL`;
- call Telegram Bot API `sendMessage`;
- support optional inline keyboard buttons;
- return success/failure to caller without throwing unhandled exceptions into business transactions;
- log failures with recipient id, notification type and Telegram error response when safe.

Backend business services must:

- commit the business state first or keep notification sending outside the critical transaction;
- schedule or invoke notification sending after status changes;
- ignore notification failure for product request verdict completion.

## Localization

Notification text should use the recipient language when it is known.

Language source priority for notifications:

1. recipient user/staff language when known;
2. actor/request language when appropriate;
3. fallback `ru`.

Product names, variant names, user comments and admin comments are content data and must not be auto-translated.

## Error handling

Notification-specific API errors are defined in `docs/backend/error-handling.md`.

Telegram API failures should generally be logged and not returned to the user for business actions that already succeeded.

If a user explicitly triggers a test notification or notification-only action, the API may return a notification error code.

## Edge cases

- Recipient blocked the bot: log failure and keep business action successful.
- Recipient never started/opened the bot: log Telegram failure and keep business action successful.
- `BOT_TOKEN` is missing: backend startup or notification service health should expose configuration error in deployment checks.
- `WEBAPP_URL` is missing: notification buttons cannot be generated; log configuration error.
- Product request route is later unavailable to recipient: frontend route must show `Access denied` or `Not found`.
- Multiple point managers exist for one Local Point: notify all active assigned point managers.

## Test plan

Backend tests:

- notification service builds correct Telegram API payload;
- inline button URL uses `WEBAPP_URL`;
- failed Telegram API response is logged and does not raise into product request approval;
- `approved` Local request selects author and point managers;
- `approved` InPost request selects author and active InPost curators;
- `needs_changes` and `rejected` notify only author.

Manual verification:

- send test notification to a Telegram ID;
- verify Mini App button opens expected route;
- verify route permissions still apply after opening from notification.

## Definition of Done

Notifications are complete when:

- interactive bot flows are not used;
- notification sender uses direct Telegram Bot API HTTP calls;
- Redis is not required;
- product request notification recipients match documented rules;
- Mini App route buttons are generated correctly;
- notification failure cannot roll back approved business state;
- tests cover payload building and failure handling.

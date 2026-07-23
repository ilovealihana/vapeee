# Product Request Need Changes and Lock Design

## Goal

Extend the current Local-only product request workflow with a controlled review loop: reviewers can request changes, eligible users can edit small request fields, and review actions are protected by an explicit lock. The slice should keep the existing approve/reject behavior working while preparing clean hook points for future Telegram notifications.

## Scope

In scope:

- add `need_changes` as a non-final request status;
- add explicit review locks for product requests;
- require a lock before approve, reject or requesting changes;
- allow eligible users to edit `need_changes` requests;
- automatically move edited `need_changes` requests back to `pending_review`;
- show the latest reviewer comment in the request row and edit modal;
- add active/archive modes and status filters in the existing admin request page;
- add backend no-op notification event hooks for future Telegram notifications;
- backend and frontend tests.

Out of scope:

- sending Telegram notifications;
- new routes or detail pages;
- InPost requests;
- media upload;
- full comment history;
- changing request type, product or Local Point during edit;
- restoring `approved` or `rejected` requests.

## Status Model

Supported statuses after this slice:

- `pending_review`: active request waiting for reviewer action.
- `need_changes`: active request requiring corrections.
- `approved`: final request that has been published into live catalog/stock.
- `rejected`: final request that will not be published.

Only `pending_review` can receive verdicts.

Only `need_changes` can be edited.

`approved` and `rejected` are final and cannot be edited, approved, rejected or restored.

## Lock Model

Review locks protect `pending_review` requests from concurrent reviewer decisions and author edits while a reviewer is checking the request.

Add lock fields to `product_requests`:

- `locked_by_tg_id`, nullable;
- `locked_at`, nullable.

Lock rules:

- `city_curator` can lock requests in assigned cities.
- `project_admin` can lock any request.
- `point_manager` cannot lock requests for review.
- approve, reject and request changes require an active lock.
- the lock owner can approve, reject, request changes or release.
- `project_admin` can force-release or take over any lock.
- another city curator cannot act while a lock is owned by someone else.
- verdict actions clear the lock.
- manual release clears the lock without changing status.

If a reviewer opens a request without locking it, the backend must reject verdict endpoints with a lock-required error.

## Editing Rules

Editable users for `need_changes`:

- the original author point manager, limited to their assigned Local Point;
- a city curator assigned to the request city;
- a project admin.

Editable fields:

- `ADD_VARIANT`: variant name, optional price override, quantity;
- `ADD_STOCK`: quantity.

Not editable:

- request type;
- Local Point;
- product;
- target existing variant for `ADD_STOCK`;
- requester identity.

Successful edit behavior:

- validate the edited fields with the same constraints as request creation;
- update editable request fields;
- set status to `pending_review`;
- clear lock fields;
- preserve the latest reviewer comment for visibility;
- emit a no-op `product_request.updated` event hook.

## Comments

For this slice, store and show only the latest reviewer comment.

Comment rules:

- reject requires a non-empty comment;
- request changes requires a non-empty comment;
- comment is visible in the request row for `need_changes` and `rejected`;
- comment is visible inside the edit modal for `need_changes`;
- no full comment history table is added in this slice.

The current `reject_reason` field may be reused or renamed only if migrations and API schemas remain clear. The public API should expose a neutral comment field such as `review_comment` so the UI does not treat `need_changes` as rejection.

## Backend API

Extend existing `/api/admin/product-requests` endpoints.

Add endpoints:

- `POST /api/admin/product-requests/{request_id}/lock`
- `POST /api/admin/product-requests/{request_id}/release`
- `POST /api/admin/product-requests/{request_id}/need-changes`
- `PATCH /api/admin/product-requests/{request_id}`

Existing endpoints changed:

- approve requires lock ownership or project-admin takeover rules;
- reject requires lock ownership or project-admin takeover rules;
- list endpoint supports active/archive filtering, either through query params or frontend-side filtering if the payload remains small.

Recommended backend organization:

- keep route handlers thin;
- introduce request lifecycle helpers for lock, release, verdict, edit and event emission;
- centralize permission checks so city scope and project-admin overrides are not duplicated in every endpoint.

## Frontend UI

Keep everything on `/admin/product-requests`.

Modes:

- active mode: `pending_review` and `need_changes`;
- archive mode: `approved` and `rejected`.

Filters:

- active mode: all active, awaiting review, requires changes;
- archive mode: all archive, approved, rejected.

Actions:

- free `pending_review`: show a take-review action for eligible reviewers;
- locked by current reviewer: show approve, request changes, reject and release actions;
- locked by another reviewer: show lock owner state, no verdict buttons for non-admin users;
- project admin: show force-release or takeover when another user owns the lock;
- `need_changes`: show edit for eligible users.

Modals:

- reject modal requires comment;
- request changes modal requires comment;
- edit modal shows latest comment and editable fields;
- all visible text uses i18n keys.

## Notification Prep

Do not send notifications in this slice.

Add a small internal event hook layer with no-op behavior for:

- `product_request.created`;
- `product_request.locked`;
- `product_request.released`;
- `product_request.need_changes`;
- `product_request.updated`;
- `product_request.approved`;
- `product_request.rejected`.

The hook should receive enough context for future notification routing:

- request ID;
- event type;
- actor Telegram ID;
- requester Telegram ID;
- city ID;
- location ID;
- current status;
- optional comment.

Future Telegram delivery can subscribe to these hooks and use `TelegramNotificationSender` without rewriting product request route logic.

## Error Handling

Use structured API errors.

Expected cases:

- request not found;
- unsupported status transition;
- lock required;
- lock already exists;
- lock not owned by actor;
- edit not allowed for actor or status;
- required comment missing;
- invalid quantity, price or variant name.

Existing product request error codes should be reused where present.

## Testing

Backend tests cover:

- reviewer must lock before approve/reject/request changes;
- city curator can lock only assigned city requests;
- project admin can force-release or take over;
- non-owner curator cannot act on another user's lock;
- request changes requires comment and moves status to `need_changes`;
- edit from `need_changes` updates allowed fields and returns to `pending_review`;
- rejected and approved are final;
- lifecycle hooks are called for lock, release, need changes, edit, approve and reject without sending Telegram messages.

Frontend tests cover:

- active/archive mode source wiring;
- status filters;
- lock/release/request-changes/edit API methods;
- actions are role/status/lock aware;
- edit modal contains latest comment and only allowed fields;
- all visible strings use i18n keys.

## Rollback

Rollback consists of reverting the feature commit and downgrading the Alembic migration that adds lock/comment/status changes. Existing `pending_review`, `approved` and `rejected` requests from the current MVP remain valid after rollback if the migration preserves or drops only the new nullable lock/comment fields and `need_changes` status is not present in live rows.

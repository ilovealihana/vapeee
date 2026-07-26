# Product Requests

**Version:** 1.1.0
**Status:** Implemented

## Purpose

This document describes the implemented Local-only product request workflow used by point managers, city curators and project admins.

Product requests let point managers propose catalog/stock changes without publishing directly. Backend review remains authoritative for permissions, status transitions, locks, prices, inventory and publication.

## Current Scope

Implemented:

- Local Point product requests only.
- `ADD_VARIANT`: add a new variant to an existing product, with optional price override and initial quantity.
- `ADD_STOCK`: add quantity to an existing variant at a Local Point.
- Point manager request creation for assigned Local Points.
- City curator review for assigned cities.
- Project admin review for all cities.
- Review locks before verdicts.
- `need_changes` correction loop.
- Active/archive list filters.
- No-op lifecycle event hooks for future notifications.

Not implemented:

- Drafts.
- InPost product requests.
- New product creation through requests.
- Media upload through requests.
- Telegram notification delivery for request lifecycle events.
- Restoring final requests.

## Actors

Point manager:

- creates Local-only requests for assigned active Local Points;
- sees visible requests for assigned Local Points;
- can edit own `need_changes` request while it is not locked;
- cannot lock, approve, reject or request changes.

City curator:

- sees requests for assigned cities;
- can lock `pending_review` requests in assigned cities;
- can approve, reject or request changes only while owning the review lock;
- can edit `need_changes` requests in assigned cities while they are not locked;
- cannot act on another reviewer's lock.

Project admin:

- sees all product requests;
- can lock any `pending_review` request;
- can explicitly take over another reviewer's lock by calling lock;
- can force-release any lock;
- can approve, reject or request changes only while owning the lock;
- can edit any unlocked `need_changes` request.

## Status Model

Allowed statuses:

- `pending_review` - request is waiting for review.
- `need_changes` - reviewer requested corrections with a mandatory comment.
- `approved` - request was approved and published to the Local catalog/stock.
- `rejected` - request was rejected with a mandatory comment.

Active statuses:

- `pending_review`
- `need_changes`

Final statuses:

- `approved`
- `rejected`

Allowed transitions:

- create -> `pending_review`
- `pending_review` -> `approved`
- `pending_review` -> `rejected`
- `pending_review` -> `need_changes`
- `need_changes` -> `pending_review` after a successful edit

No transition is allowed out of `approved` or `rejected`.

## Review Locks

Verdicts require an active lock owned by the reviewer:

- approve;
- reject;
- request changes.

Lock rules:

- only `pending_review` requests can be locked;
- point managers cannot lock;
- the same reviewer can call lock idempotently;
- city curators cannot take over another reviewer's lock;
- project admin takeover is explicit through the lock endpoint;
- release clears the lock for the owner;
- project admin can release any lock;
- verdicts clear the lock.

## Correction Loop

`need_changes` rules:

- reviewer comment is required;
- latest reviewer comment is stored in `review_comment`;
- `reject_reason` is retained for backward compatibility and legacy rejected rows;
- only `need_changes` requests can be edited;
- locked `need_changes` requests cannot be edited;
- successful edit returns the request to `pending_review`;
- successful edit clears lock fields and preserves the latest reviewer comment.

Editable fields:

- `ADD_VARIANT`: `variant_name_ru`, `variant_name_pl`, `variant_name_uk`, `price_override`, `quantity`;
- `ADD_STOCK`: `quantity` only.

Forbidden fields are rejected, not silently ignored:

- `product_id`;
- `location_id`;
- `request_type`;
- `variant_id`;
- ownership/requester fields.

For `ADD_VARIANT`, explicit `price_override: null` clears the override. Omitted `price_override` preserves the previous value.

## Listing

`GET /api/admin/product-requests` supports:

- `mode=active` for `pending_review` and `need_changes`;
- `mode=archive` for `approved` and `rejected`;
- `status=pending_review|need_changes|approved|rejected`.

`mode` and `status` combine by intersection. Incompatible filters such as `mode=active&status=approved` return an empty list.

Role scoping still applies after filters:

- project admin sees all matching requests;
- city curator sees matching requests in assigned cities;
- point manager sees matching requests for assigned Local Points.

## Backend Endpoints

Implemented product request endpoints:

- `GET /api/admin/product-requests`
- `POST /api/admin/product-requests`
- `GET /api/admin/product-requests/options`
- `POST /api/admin/product-requests/{request_id}/lock`
- `POST /api/admin/product-requests/{request_id}/release`
- `POST /api/admin/product-requests/{request_id}/approve`
- `POST /api/admin/product-requests/{request_id}/reject`
- `POST /api/admin/product-requests/{request_id}/need-changes`
- `PATCH /api/admin/product-requests/{request_id}`

Backend validates:

- actor role and staff assignment;
- Local Point access;
- request type;
- status transitions;
- lock ownership;
- required comments;
- quantity and price values;
- duplicate variant names;
- immutable edit fields.

## Frontend Behavior

The implemented UI stays on `/admin/product-requests`.

It provides:

- active/archive mode controls;
- mode-specific status filters;
- latest review comment in rows;
- lock/takeover/release actions;
- approve/reject/request-changes actions only for the current lock owner;
- edit modal for eligible `need_changes` requests;
- reject and request-changes comment modals;
- backend error display without treating hidden buttons as authorization.

## Event Hooks

Lifecycle hooks are implemented as no-op internal calls:

- `product_request.created`
- `product_request.locked`
- `product_request.released`
- `product_request.need_changes`
- `product_request.updated`
- `product_request.approved`
- `product_request.rejected`

They must not import or call Telegram notification senders in this slice.

## Test Coverage

Backend contract tests cover:

- create permission and Local Point scoping;
- lock/release permissions;
- lock-required verdicts;
- project admin takeover;
- approve/reject/request-changes transitions;
- edit from `need_changes`;
- active/archive/status filters;
- role scoping with filters;
- legacy `review_comment` fallback;
- no-op event hook boundaries.

Frontend tests cover:

- admin product request routing/API/i18n contracts;
- product request action helper table;
- active/archive and action wiring;
- hardcoded UI string scanning;
- TypeScript production build.

## Definition of Done

This slice is complete when:

- backend lock and transition rules are enforced;
- active/archive filters work with role scoping;
- eligible users can edit only `need_changes` requests;
- approved/rejected requests remain final;
- frontend actions match backend lock rules;
- docs, tests and deployment state are synchronized.

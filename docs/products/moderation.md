# Moderation

**Version:** 1.0.0  
**Status:** Approved

## Purpose

This document defines product moderation rules for curator-submitted product requests. Moderation protects catalog quality, inventory correctness and source separation before a product becomes visible to customers.

## Scope

In scope:

- administrator review of product requests;
- moderation decisions;
- edit-before-approval behavior;
- rejection reasons;
- audit expectations;
- publication trigger after approval.

Out of scope:

- post-publication analytics;
- payment disputes;
- supplier quality scoring;
- automatic content moderation.

## Related documents

- `docs/admin/product-requests.md`
- `docs/admin/products.md`
- `docs/products/product-model.md`
- `docs/products/pricing.md`
- `docs/products/inventory.md`
- `docs/products/media.md`
- `docs/products/publishing.md`
- `docs/backend/permissions.md`

## Business rules

1. A product submitted by a curator must pass administrator moderation before publication.
2. Moderation is performed on a product request, not directly on the live product.
3. Only requests in `pending_review` can be approved or rejected.
4. Approval creates or publishes the catalog product according to `docs/admin/product-requests.md`.
5. Rejection must keep the request data available to the curator.
6. Administrator edits before approval are allowed for corrections that do not change requester ownership.
7. Changing source type from `LOCAL` to `INPOST`, from `INPOST` to `LOCAL`, or changing the Local Point after submission requires returning the request to `draft`.
8. The backend must record who reviewed the request and when.
9. The frontend must show moderation status clearly but must not enforce moderation permissions alone.

## Moderation checklist

Administrator must be able to check:

- source type is correct;
- Local Point is active when source is `LOCAL`;
- product name is clear;
- category is correct if categories are enabled;
- variants are complete;
- price values are valid;
- initial inventory is valid for the selected source;
- media references are present when required by product presentation;
- no obvious duplicate product exists in the same source catalog.

## Decisions

Approve:

- request is valid;
- administrator accepts the product data;
- backend publishes product data atomically.

Reject:

- request is invalid or incomplete;
- product should not be published;
- rejection reason is stored and visible to the curator.

Edit then approve:

- administrator fixes minor data quality problems;
- source type and ownership do not change;
- updated request data is what gets published.

Cancel:

- request should be closed without publication;
- used for obsolete or accidental requests.

## Backend requirements

Backend moderation actions must:

- validate administrator permission;
- validate current request status;
- apply status transitions atomically;
- store reviewer identity and review timestamp;
- store rejection reason when provided;
- prevent duplicate publication;
- roll back publication if product, variant, media or inventory creation fails.

## Frontend requirements

Frontend must:

- provide a moderation list with status filters;
- provide a request detail view;
- show source, target, product, variants, price, media and inventory;
- expose approve, reject and cancel actions only in administrator context;
- require confirmation before approve and cancel;
- allow rejection reason input;
- surface backend errors without losing form state.

## Permissions

Curator:

- can view own moderation result;
- can edit rejected request after it returns to `draft`;
- cannot approve or reject.

Administrator:

- can view pending requests;
- can approve, reject, cancel and perform safe edits.

Backend:

- must be the source of truth for every moderation decision.

## Edge cases

- Product request is updated while administrator has it open: backend must reject stale invalid transitions or require refetch.
- Administrator approval races with another administrator: only one action succeeds.
- Rejection reason is too long: backend returns validation error and keeps request pending.
- Request target becomes inactive: approval is blocked.
- Media reference is deleted before approval: approval is blocked or product is approved without media only if media is not required.

## Test plan

Backend tests:

- non-admin cannot approve;
- non-admin cannot reject;
- admin can approve pending request;
- admin can reject pending request;
- rejected request stores reason;
- approved request stores reviewer and timestamp;
- duplicate approval does not create duplicate live products;
- inactive target blocks approval.

Frontend tests:

- pending request list renders;
- detail view shows all moderation fields;
- approve confirmation calls backend action;
- reject form submits reason;
- permission errors are displayed.

## Definition of Done

Moderation is complete when:

- product requests cannot bypass administrator review;
- approval, rejection and cancellation transitions are enforced on the backend;
- administrator decisions are auditable;
- frontend review screens preserve the existing admin design;
- tests cover permission failures, invalid transitions and successful moderation.

# Moderation

**Version:** 1.1.0
**Status:** Implemented

## Purpose

This document defines moderation rules for the implemented Local-only product request flow. Moderation protects catalog quality and stock correctness before a requested change becomes visible to customers.

## Scope

In scope:

- Local product request review;
- review locks;
- approve/reject/request-changes decisions;
- `need_changes` correction loop;
- small safe edits before repeat review;
- audit fields and comments;
- publication after approval.

Out of scope:

- InPost requests;
- drafts;
- request cancellation;
- post-publication analytics;
- supplier scoring;
- automatic content moderation;
- Telegram notification delivery.

## Related Documents

- `docs/admin/product-requests.md`
- `docs/admin/products.md`
- `docs/products/product-model.md`
- `docs/products/pricing.md`
- `docs/products/inventory.md`
- `docs/products/publishing.md`
- `docs/backend/permissions.md`

## Business Rules

1. A Local product request must pass review before it changes live catalog or stock.
2. Moderation is performed on `ProductRequest`, not directly on live product rows.
3. Only `pending_review` requests can receive verdicts.
4. A reviewer must lock a request before approve, reject or request changes.
5. Verdict actions require the lock to be owned by the current reviewer.
6. Project admin takeover is explicit through the lock endpoint.
7. City curators can review only assigned cities.
8. Point managers cannot review.
9. Approval publishes the requested Local change atomically.
10. Reject requires a non-empty comment and finalizes the request.
11. Request changes requires a non-empty comment and moves the request to `need_changes`.
12. Only `need_changes` requests can be edited.
13. Successful edit returns the request to `pending_review`.
14. Approved and rejected requests are final.
15. Frontend visibility is advisory; backend permissions and transitions are authoritative.

## Review Locks

Lock behavior:

- lock is allowed only for `pending_review`;
- owner can approve, reject, request changes or release;
- owner verdict clears the lock;
- project admin can force-release another reviewer's lock;
- project admin can take over by locking;
- city curator cannot act on another reviewer's lock.

If the current user Telegram ID is unavailable in the frontend, owner-only verdict actions are not shown. Backend still enforces the same rule.

## Decisions

Approve:

- request is valid;
- reviewer owns the lock;
- backend publishes product/variant/stock changes atomically;
- request becomes `approved`.

Reject:

- reviewer owns the lock;
- non-empty comment is provided;
- submitted data remains stored for audit;
- request becomes `rejected`.

Request changes:

- reviewer owns the lock;
- non-empty comment is provided;
- comment is stored as latest `review_comment`;
- request becomes `need_changes`;
- lock is cleared.

Edit and resubmit:

- allowed only from `need_changes`;
- blocked while locked;
- allowed for original point manager, assigned city curator or project admin;
- editable fields are limited by request type;
- request returns to `pending_review`.

## Backend Requirements

Backend moderation actions must:

- validate actor role and assignment;
- validate current status;
- validate lock ownership;
- require comments for reject and request changes;
- reject immutable PATCH fields;
- preserve latest review comment through edit;
- store reviewer identity and timestamps where applicable;
- roll back publication if approval fails.

## Frontend Requirements

Frontend must:

- show active and archive modes;
- show mode-specific filters;
- show latest review comment;
- expose lock/takeover/release controls according to role and lock state;
- expose verdict actions only to the lock owner;
- expose edit only for eligible unlocked `need_changes` requests;
- keep modal form state when backend errors occur;
- surface backend errors clearly.

Frontend must not:

- assume hidden buttons enforce permissions;
- auto-takeover before verdict;
- show final requests as editable or reviewable.

## Edge Cases

- Product request is updated while reviewer has it open: backend rejects stale invalid transitions or lock conflicts.
- Reviewer loses lock before submitting a modal: backend rejects the action and frontend keeps form state.
- Approval races with another reviewer: only the lock owner transition can succeed.
- Request target or variant becomes invalid before approval: approval is blocked or rolled back.
- Legacy rejected rows without `review_comment`: list schema falls back to `reject_reason`.

## Test Plan

Backend tests:

- point manager cannot review;
- city curator can review assigned city only;
- project admin can review all;
- lock is required for verdicts;
- project admin takeover is explicit;
- non-owner cannot act on another lock;
- reject/request changes require comments;
- edit is allowed only from unlocked `need_changes`;
- final statuses reject further lifecycle actions.

Frontend tests:

- API contract exposes review-loop endpoints;
- action helper covers role/status/lock matrix;
- page calls lock/release/need-changes/update APIs;
- page renders filters, latest comment and modals;
- hidden buttons are not relied on for backend authorization;
- modal inputs are preserved on API errors.

## Definition of Done

Moderation is complete when:

- product requests cannot bypass review;
- locks gate verdicts;
- corrections flow through `need_changes`;
- final requests remain immutable;
- frontend review screens preserve the admin design;
- tests cover permission failures, invalid transitions and successful moderation.

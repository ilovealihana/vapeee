# Product Requests

**Version:** 1.0.0  
**Status:** Approved

## Purpose

This document defines the workflow where a curator submits a complete product creation request and an administrator reviews it before the product becomes available in a Local Point or InPost catalog.

Product requests are the first approved vertical implementation slice for product management. They prevent curators from publishing products directly and keep catalog publication under administrator control.

## Scope

In scope:

- curator product request creation;
- request target selection: `LOCAL` or `INPOST`;
- Local Point selection when the target is `LOCAL`;
- product core data;
- product variants;
- prices;
- initial inventory;
- product media references;
- request statuses;
- administrator review, edit, approval and rejection;
- publication to the selected catalog source after approval.

Out of scope:

- public customer checkout;
- payment processing;
- stock deduction during order fulfillment;
- analytics;
- automatic supplier import.

## Related documents

- `docs/ARCHITECTURE.md`
- `docs/core/00-project-rules.md`
- `docs/core/02-user-roles.md`
- `docs/admin/products.md`
- `docs/products/product-model.md`
- `docs/products/variants.md`
- `docs/products/pricing.md`
- `docs/products/inventory.md`
- `docs/products/media.md`
- `docs/products/moderation.md`
- `docs/products/publishing.md`
- `docs/shopping/local-points/catalog.md`
- `docs/shopping/inpost/catalog.md`

## Actors

Curator:

- creates product requests;
- can submit only for sources allowed by backend permissions;
- can view own submitted requests;
- can edit own request only while it is in `draft` or `rejected` status;
- cannot approve, publish or directly edit live catalog products unless also granted administrator permissions.

Administrator:

- can view all product requests;
- can edit submitted request data before approval;
- can approve or reject requests;
- can publish approved request data to the catalog;
- can leave a rejection reason.

Backend:

- is the source of truth for permissions, request status transitions, prices, inventory and publication;
- must not trust frontend-hidden controls for authorization.

## Status model

Allowed statuses:

- `draft` - curator is still editing the request.
- `pending_review` - curator submitted the request for administrator review.
- `approved` - administrator approved the request and the product was published or is ready to publish inside the same backend transaction.
- `rejected` - administrator rejected the request with an optional comment.
- `cancelled` - curator or administrator cancelled the request before approval.

Allowed transitions:

- `draft` -> `pending_review`
- `draft` -> `cancelled`
- `pending_review` -> `approved`
- `pending_review` -> `rejected`
- `pending_review` -> `cancelled`
- `rejected` -> `draft`
- `rejected` -> `cancelled`

No transition is allowed out of `approved` or `cancelled`.

## Business rules

1. A product request must have exactly one source type: `LOCAL` or `INPOST`.
2. A `LOCAL` request must reference one active city and one active Local Point.
3. An `INPOST` request must not reference a Local Point.
4. Local Point and InPost products may share product naming rules, but they must not share inventory or cart state.
5. A request must include product name, base price, at least one variant and initial availability data before it can move to `pending_review`.
6. Product display names and descriptions are stored as product content and do not change automatically when the interface language changes.
7. Prices are stored and validated on the backend.
8. The frontend may show draft validation, but backend validation is authoritative.
9. Approval publishes the product to the selected source only.
10. Rejection must preserve the submitted data so the curator can revise and resubmit it.
11. Administrators may edit request data before approval when the correction is small and does not change the request ownership or source type.
12. Any change to source type after submission requires returning the request to `draft`.
13. A request approval must be atomic: the product, variants, media references and inventory state must either all be created or none of them are created.
14. Published catalog products must be linked back to the source request for auditability.

## User flow

Curator flow:

1. Curator opens the admin/curator product request screen.
2. Curator selects product source: `LOCAL` or `INPOST`.
3. If `LOCAL`, curator selects city and Local Point.
4. Curator fills product data.
5. Curator adds one or more variants.
6. Curator sets prices and initial inventory.
7. Curator attaches media references if available.
8. Curator saves the request as `draft` or submits it as `pending_review`.
9. Curator sees review status and rejection comments.

Administrator flow:

1. Administrator opens product requests.
2. Administrator filters by status and source type.
3. Administrator opens a request detail view.
4. Administrator checks product data, variants, media, price and inventory.
5. Administrator approves, edits then approves, rejects with a comment, or cancels the request.
6. On approval, the product becomes visible in the selected catalog according to publishing rules.

## Backend requirements

Backend must provide endpoints for:

- creating a draft product request;
- updating an editable request;
- submitting a request for review;
- listing requests visible to the current actor;
- reading request details;
- approving a request;
- rejecting a request;
- cancelling a request.

Backend must validate:

- actor role;
- source type;
- city and Local Point membership for `LOCAL` requests;
- absence of Local Point for `INPOST` requests;
- required product fields;
- variant list is not empty before submission;
- non-negative inventory quantities;
- non-negative prices;
- allowed status transitions.

## Frontend requirements

Frontend must:

- reuse the existing admin UI style and navigation;
- show separate states for draft, pending review, approved, rejected and cancelled;
- show backend validation errors near the relevant fields;
- prevent obvious invalid submits in the UI without relying on UI controls for security;
- keep source selection explicit;
- show rejection comments to the curator;
- show administrator actions only when backend user permissions allow them.

Frontend must not:

- publish a product directly from curator UI;
- treat hidden buttons as permission enforcement;
- merge Local Point and InPost request state.

## Data model

The implementation should introduce a persistent product request model that can store:

- id;
- source type: `LOCAL` or `INPOST`;
- city id for Local requests;
- location id for Local requests;
- requester user id or Telegram id;
- current status;
- rejection reason;
- product fields;
- variant fields;
- media references;
- initial inventory rows;
- linked published product id after approval;
- created, updated, submitted, reviewed timestamps;
- reviewer id when reviewed.

The exact table layout may be split into request, request variant, request media and request inventory tables if that follows local SQLAlchemy conventions better.

## Permissions

Curator permissions:

- create own request;
- update own editable request;
- submit own request;
- cancel own non-approved request;
- read own requests.

Administrator permissions:

- read all requests;
- edit pending requests;
- approve pending requests;
- reject pending requests;
- cancel pending requests.

Super administrator permissions:

- all administrator permissions;
- future role management when user role documentation is approved.

## Validation

Submit validation:

- source type is present;
- Local request has active city and Local Point;
- InPost request has no Local Point;
- product name is present;
- base price is greater than or equal to zero;
- at least one variant exists;
- each variant has a display name;
- inventory quantity is greater than or equal to zero;
- attached media references use supported storage identifiers.

Approval validation:

- request is in `pending_review`;
- reviewer has administrator permission;
- target source is still active;
- category, product, variants and inventory can be created consistently;
- no duplicate publish has already happened.

## Edge cases

- Target Local Point is disabled while the request is pending: approval is blocked until the administrator selects another active target or rejects the request.
- Category is removed while the request is pending: approval is blocked until the request is corrected.
- Curator submits a request with zero inventory: allowed only if product visibility rules can keep the product hidden or unavailable.
- Administrator rejects without a comment: allowed, but frontend should encourage a reason.
- Curator edits a rejected request: status returns to `draft`.
- Concurrent approval attempts: only one approval can succeed.
- Approval partially fails: transaction rolls back and the request remains `pending_review`.
- Published product is later deactivated: the original request remains as audit history.

## Test plan

Backend tests:

- curator can create and submit own request;
- curator cannot approve request;
- administrator can approve pending request;
- administrator can reject pending request with comment;
- invalid status transitions are rejected;
- Local request without location is rejected;
- InPost request with location is rejected;
- approval creates product, variants and inventory atomically;
- duplicate approval is rejected or idempotently returns the published product without creating duplicates.

Frontend tests:

- request form shows source-specific fields;
- submit button handles validation errors;
- rejected request shows rejection reason;
- administrator review actions are visible only in admin context;
- approved request no longer exposes edit controls.

## Definition of Done

A product request slice is complete when:

- the documented status model is implemented;
- backend permissions enforce curator and administrator boundaries;
- request data persists before publication;
- approval publishes product, variants and inventory atomically;
- rejection preserves request data and reason;
- Local Point and InPost source rules are enforced;
- frontend uses the existing admin UI style;
- backend and frontend tests cover success, permission failure and invalid data paths;
- related documentation is synchronized.

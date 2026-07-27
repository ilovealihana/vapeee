# InPost Foundation and Requests Design

## Goal

Add the first working InPost slice without checkout: make InPost a first-class global catalog source, activate it by active InPost curator presence, and extend the product request workflow so InPost curators and project admins can create warehouse-stock requests reviewed by project admins.

This slice prepares the customer catalog and admin workflows for InPost purchasing, but does not enable InPost checkout or official InPost delivery validation yet.

## Scope

In scope:

- add InPost as a first-class product request source;
- keep Local Point requests working unchanged for point managers and city curators;
- allow `inpost_curator` and `project_admin` to create InPost requests;
- allow only `project_admin` to review InPost requests;
- publish approved InPost requests into `inpost_stock`;
- expose source filtering in the admin product request list: all, InPost, Local Points;
- show source labels in request rows and modals;
- expose InPost availability from backend catalog sources using active `inpost_curator` presence;
- keep the customer source selector pattern: InPost block first, divider, Local Points below;
- backend and frontend tests.

Out of scope:

- InPost checkout;
- paczkomat selection;
- courier address validation;
- official InPost API integration;
- Telegram notifications;
- media upload;
- making `city_curator` review InPost requests;
- adding fake cities, fake local points, or fake managers for InPost.

## Source Model

Supported product request sources after this slice:

- `local_point`: a request targeting one Local Point and its `location_stock`;
- `inpost`: a request targeting the global InPost warehouse and its `inpost_stock`.

InPost is not a Local Point. It has no city, no location, and no point manager.

## Data Model

Add `source_type` to `product_requests`.

Allowed values:

- `local_point`;
- `inpost`.

Migration behavior:

- existing rows receive `source_type = 'local_point'`;
- existing Local rows keep `city_id` and `location_id`;
- InPost rows store `city_id = null` and `location_id = null`.

Constraints:

- Local Point request: `source_type = 'local_point'`, `city_id IS NOT NULL`, `location_id IS NOT NULL`;
- InPost request: `source_type = 'inpost'`, `city_id IS NULL`, `location_id IS NULL`;
- request type and status constraints remain unchanged.

Relationships:

- `city` and `location` relationships become nullable in API/schema handling;
- request list and detail rendering must handle null city/location for InPost.

## Role Rules

Local Point rules remain:

- `point_manager` creates Local Point requests only for assigned Local Points;
- `city_curator` reviews Local Point requests only in assigned cities;
- `project_admin` reviews all Local Point requests.

InPost rules:

- `inpost_curator` can create InPost requests;
- `project_admin` can create InPost requests;
- only `project_admin` can lock, approve, reject, request changes, release, or edit InPost requests as reviewer;
- active `inpost_curator` users can see InPost requests and edit unlocked `need_changes` InPost requests, because InPost is one global source;
- `city_curator` cannot see or review InPost requests unless they are also project admin, which is not supported by the current one-role staff model;
- `point_manager` cannot create, see, or review InPost requests.

The current staff model has one role per user. No InPost manager role is introduced.

## Request Types

Both existing request types apply to InPost:

- `ADD_VARIANT`: existing product, new variant name, optional price override, quantity;
- `ADD_STOCK`: existing product variant, quantity.

For InPost:

- `ADD_VARIANT` creates or publishes a product variant as today, then upserts/increments `inpost_stock`;
- `ADD_STOCK` increments `inpost_stock` for the selected existing variant;
- no `location_stock` row is created.

For Local Point:

- current behavior remains unchanged;
- approved requests update `location_stock`.

## Request Creation API

Extend create request payload with `source_type`.

Recommended payload shape:

```ts
type ProductRequestPayload = {
  source_type: 'local_point' | 'inpost';
  request_type: 'ADD_VARIANT' | 'ADD_STOCK';
  location_id?: number | null;
  product_id: number;
  variant_id?: number | null;
  variant_name_ru?: string | null;
  variant_name_pl?: string | null;
  variant_name_uk?: string | null;
  price_override?: string | null;
  quantity: number;
};
```

Backend validation:

- missing `source_type` defaults to `local_point` only for backward compatibility with old deployed frontend versions;
- `local_point` requires valid active `location_id`;
- `inpost` requires `location_id` to be omitted or null;
- `inpost_curator` and `project_admin` may create InPost requests;
- `point_manager` may create only Local Point requests;
- `city_curator` cannot create InPost requests in this slice.

## Request Listing API

Extend list endpoint with source filtering:

```text
GET /api/admin/product-requests?mode=active&status=pending_review&source=all
GET /api/admin/product-requests?source=inpost
GET /api/admin/product-requests?source=local_point
```

Allowed source query values:

- omitted or `all`;
- `inpost`;
- `local_point`.

Role filtering:

- `project_admin`: all sources, all requests;
- `inpost_curator`: all InPost requests, with no Local Point requests;
- `city_curator`: Local Point requests in assigned cities only;
- `point_manager`: Local Point requests in assigned locations only.

If a role cannot access a requested source filter, return an empty list or a permission error consistently with existing product request behavior. Prefer empty list for valid filters outside the user's scope and 403 for no product request access at all.

## Review And Lock Rules

Existing lock rules remain for Local Point requests.

For InPost:

- only `project_admin` can lock an InPost request for review;
- verdict endpoints require owned lock, as they do today;
- project admin takeover and release rules remain explicit;
- `need_changes`, `rejected`, and `approved` behavior mirrors Local Point requests;
- final statuses remain immutable.

Editing `need_changes`:

- active `inpost_curator` can edit unlocked `need_changes` InPost requests;
- `project_admin` can edit unlocked InPost requests;
- editable fields are the same as current Local Point requests: variant name, optional price override, quantity for `ADD_VARIANT`; quantity for `ADD_STOCK`;
- source, product, request type, and target variant remain immutable.

## InPost Availability

InPost availability for customers is based on active InPost curator presence.

Rules:

- if at least one active staff member has role `inpost_curator`, InPost source status is available;
- if no active `inpost_curator` exists, InPost remains visible but disabled with "coming soon" style copy;
- if InPost is available but warehouse stock is empty, the source is selectable and the catalog shows an empty state;
- if InPost was selected and later becomes unavailable, keep the selected source visible with disabled/unavailable state and block purchase actions.

This mirrors Local Point availability, where Local Points need an active point manager.

## Customer UI

Use the shared source ordering pattern everywhere sources are shown:

1. InPost block at the top.
2. Divider labelled "Local Points".
3. City accordion and Local Point rows below.

Selector behavior:

- InPost block is always visible;
- disabled InPost shows "soon available" copy and cannot be selected;
- enabled InPost can be selected and drives the catalog to `source=inpost`;
- Local Points keep current city accordion behavior.

Catalog behavior:

- InPost catalog loads product list from `inpost_stock`;
- only products with active variants and positive InPost stock are purchasable;
- checkout remains blocked for InPost in this slice.

## Admin UI

Product requests page:

- keep active/archive modes and status filters;
- add source filter: `All`, `InPost`, `Local Points`;
- show source label in every request row;
- for InPost rows show `InPost` instead of city/location;
- for Local rows show `Local Point - city - point`;
- create modal lets eligible users choose source when they can create more than one source;
- `inpost_curator` create modal is scoped directly to InPost with no city/location picker;
- `point_manager` create modal remains scoped to their Local Points;
- `project_admin` can choose InPost or Local Point if Local creation remains allowed for admins.

Staff/Admin source status:

- InPost status is derived from active `inpost_curator`;
- no separate InPost manager assignment UI is added.

Stock page:

- keep Local Point and InPost source separation;
- do not treat InPost as a location row.

## Backend Publishing

Approved Local Point request:

- current behavior remains: publish variant if needed and update `location_stock`.

Approved InPost request:

- publish variant if needed;
- upsert `InpostStock` by `variant_id`;
- increment quantity by request quantity;
- set `published_variant_id`;
- set final review fields;
- emit existing product request lifecycle event hook with `source_type = inpost`.

Notification hooks remain no-op in this slice.

## Error Handling

Add or reuse canonical error codes for:

- invalid source type;
- missing Local Point for Local request;
- forbidden Local Point source;
- forbidden InPost source;
- InPost inactive when a non-admin/non-curator attempts InPost creation;
- review permission denied for InPost.

Error messages must be localized through existing frontend error handling.

## Testing

Backend tests:

- migration/schema contains nullable `city_id`, nullable `location_id`, and `source_type`;
- existing Local Point request tests still pass;
- existing rows default to `local_point`;
- point manager cannot create InPost request;
- city curator cannot create or review InPost request;
- inpost curator can create InPost `ADD_VARIANT`;
- inpost curator can create InPost `ADD_STOCK`;
- project admin can create InPost request;
- project admin can review InPost request;
- approved InPost `ADD_VARIANT` increments `inpost_stock` and not `location_stock`;
- approved InPost `ADD_STOCK` increments `inpost_stock`;
- InPost request can go to `need_changes` and be edited by the original InPost curator;
- source filter returns expected rows per role.

Frontend tests:

- API types include `source_type`;
- product request page exposes source filter UI;
- InPost create flow has no city/location selector for `inpost_curator`;
- source labels render for InPost and Local rows;
- selector keeps InPost block above Local Points;
- disabled InPost copy appears when backend marks it unavailable;
- checkout remains blocked for InPost.

Manual verification:

- create active `inpost_curator`;
- verify InPost becomes selectable in catalog selector;
- create InPost `ADD_VARIANT` request as `inpost_curator`;
- approve as `project_admin`;
- verify `inpost_stock` increases;
- verify InPost catalog shows the approved stock;
- verify InPost checkout is still blocked with current copy.

## Rollout

Implementation should be split into testable commits:

1. backend schema and migration for request sources;
2. backend permissions, creation, listing, and publishing;
3. frontend API and product request UI;
4. customer source availability polish;
5. deployment verification.

Deploy backend before frontend if API schema changes are not backward compatible. Keep create payload backward-compatible by defaulting missing `source_type` to `local_point` during rollout.

## Risks And Rollback

Risks:

- migration can break existing Local Point requests if `city_id` and `location_id` nullable changes are incomplete;
- frontend can accidentally show InPost as a fake city/location;
- review permissions can accidentally let `city_curator` approve InPost;
- approved InPost requests can update `location_stock` if publishing logic is not source-aware.

Rollback:

- revert frontend source filter and InPost request UI;
- keep `source_type` column if already migrated, but stop creating InPost rows;
- disable InPost creation by backend permission guard;
- keep existing Local Point requests usable.

## Definition Of Done

This slice is done when:

- InPost is a visible top source in customer source selection;
- InPost availability follows active `inpost_curator` presence;
- InPost requests can be created by `inpost_curator` and `project_admin`;
- InPost requests can be reviewed only by `project_admin`;
- approved InPost requests publish into `inpost_stock`;
- Local Point request behavior remains unchanged;
- admin requests have source filters and source labels;
- checkout remains blocked for InPost until the next slice;
- backend and frontend tests pass.

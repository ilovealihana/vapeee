# Inventory

**Version:** 1.0.0  
**Status:** Approved

## Purpose

This document defines inventory rules for product variants across Local Points and InPost.

Inventory is backend-owned business state. Frontend stock indicators are display-only and must not be treated as authority for checkout or publication.

## Scope

In scope:

- Local Point inventory;
- InPost inventory boundary;
- initial inventory from product requests;
- stock validation;
- checkout stock checks;
- administrator stock updates;
- inventory audit expectations.

Out of scope:

- supplier replenishment automation;
- financial accounting;
- warehouse barcode scanning;
- external ERP integration.

## Related documents

- `docs/admin/product-requests.md`
- `docs/admin/products.md`
- `docs/admin/stores.md`
- `docs/products/product-model.md`
- `docs/products/variants.md`
- `docs/products/publishing.md`
- `docs/shopping/local-points/catalog.md`
- `docs/shopping/inpost/warehouse.md`
- `docs/shopping/carts/validation.md`
- `docs/shopping/carts/checkout.md`

## Business rules

1. Inventory belongs to a source.
2. Local Point inventory belongs to a specific Local Point and product variant.
3. InPost inventory is independent from Local Point inventory.
4. Local Point and InPost must not share inventory rows.
5. Inventory quantity cannot be negative.
6. Backend is the source of truth for stock availability.
7. Cart quantity must be validated against backend stock before checkout.
8. Stock deduction happens only for fulfillment types that consume the relevant stock source.
9. Product request approval creates initial inventory for the selected source.
10. Administrator stock updates must validate variant and source existence.
11. Stock updates should be auditable when inventory history is implemented.

## Local Point inventory

Local Point inventory is stored per `(location_id, variant_id)`.

Required behavior:

- one row per Local Point and variant;
- quantity is an integer greater than or equal to zero;
- zero quantity means unavailable for that Local Point unless catalog rules intentionally show out-of-stock products;
- checkout for Local pickup or Local delivery must validate and deduct this stock when order creation succeeds.

Existing implementation already uses `location_stock` for Local Point inventory.

## InPost inventory

InPost must have inventory state separate from `location_stock`.

Until a dedicated InPost inventory model is implemented, InPost checkout must not deduct Local Point stock. If InPost stock validation is not implemented yet, the UI and backend must not present InPost stock as guaranteed by Local Point inventory.

Future InPost inventory may be represented by:

- a dedicated warehouse stock table;
- source-scoped inventory rows with `source_type = INPOST`;
- another model approved by backend architecture.

The selected implementation must preserve the Local/InPost separation.

## Product request inventory

A product request must capture initial inventory for the selected source:

- `LOCAL`: quantity per selected Local Point and variant.
- `INPOST`: quantity per InPost warehouse and variant when InPost inventory exists.

Approval validation must ensure:

- quantities are non-negative integers;
- target source still exists;
- variant data is valid;
- stock rows are created atomically with product publication.

## Backend requirements

Backend must:

- validate stock before checkout;
- reject negative stock updates;
- keep stock updates inside transactions;
- prevent race conditions during checkout stock deduction;
- expose stock summaries to catalog and admin screens;
- keep Local Point stock isolated from InPost stock.

## Frontend requirements

Frontend must:

- show stock and availability based on backend responses;
- display empty or unavailable states when backend reports no stock;
- disable obvious invalid add-to-cart actions while still relying on backend validation;
- show administrator stock update errors without losing edited values;
- not infer InPost stock from Local Point stock.

## Permissions

Curator:

- can propose initial inventory through product requests for allowed sources.

Administrator:

- can approve request inventory;
- can update live stock quantities;
- can correct invalid proposed inventory before approval.

Backend:

- enforces all permission checks.

## Validation

Stock update validation:

- source exists;
- variant exists;
- quantity is an integer;
- quantity is greater than or equal to zero;
- actor has permission for the source.

Checkout validation:

- cart source matches checkout source;
- product and variant are active;
- requested quantity is available for the source;
- stock deduction and order creation happen atomically.

## Edge cases

- Two customers buy the last item concurrently: only one checkout may deduct the final available quantity.
- Administrator lowers stock below quantities currently in carts: checkout revalidates and may reject stale carts.
- Product is approved with zero initial stock: product may exist but must not be orderable for that source.
- Variant is deleted or disabled: inventory rows must not allow ordering that variant.
- InPost has no implemented stock model: InPost must not pretend to use Local Point stock.

## Test plan

Backend tests:

- negative stock update is rejected;
- stock update for missing variant is rejected;
- Local checkout deducts Local Point stock;
- InPost checkout does not deduct Local Point stock;
- concurrent checkout cannot oversell stock;
- product request approval creates initial stock rows.

Frontend tests:

- admin stock screen renders backend quantities;
- stock save handles backend validation errors;
- product card reflects unavailable state;
- stale cart stock error is displayed at checkout.

## Definition of Done

Inventory behavior is complete when:

- Local Point stock is source-specific and non-negative;
- InPost stock is separate or explicitly not claimed as Local stock;
- backend validates cart and checkout quantities;
- stock-changing operations are transactional;
- admin and curator flows use backend validation;
- tests cover success, invalid updates, stale carts and source separation.

# Product Model

**Version:** 1.0.0  
**Status:** Approved

## Purpose

This document defines the product data model used by catalog, product requests, moderation, inventory and checkout.

The product model must support a Telegram Mini App catalog with Local Point and InPost sources while keeping source-specific inventory and carts independent.

## Scope

In scope:

- product core fields;
- variants;
- categories;
- media references;
- pricing fields;
- source availability;
- relationship with product requests.

Out of scope:

- payment data;
- order status history;
- supplier contracts;
- analytics.

## Related documents

- `docs/admin/product-requests.md`
- `docs/products/variants.md`
- `docs/products/pricing.md`
- `docs/products/inventory.md`
- `docs/products/media.md`
- `docs/products/publishing.md`
- `docs/shopping/local-points/catalog.md`
- `docs/shopping/inpost/catalog.md`
- `docs/shopping/carts/architecture.md`

## Product identity

A product represents a sellable catalog item family, such as a device, liquid or accessory.

Required product fields:

- id;
- category id, nullable only when uncategorized products are allowed;
- display name;
- optional description;
- base price;
- active/visible flag;
- media reference;
- created timestamp;
- updated timestamp.

Current code stores localized fields as `name_ru`, `name_pl`, `name_uk`, `description_ru`, `description_pl`, `description_uk`. The business rule from project context says product names, descriptions, flavors, colors and variant names are content, not interface labels. Therefore implementation may keep current localized columns for compatibility, but future changes must not auto-translate or silently rewrite product content when interface language changes.

## Variants

A product must have at least one variant before it can be submitted for publication.

Variant fields:

- id;
- product id;
- display name;
- optional media reference;
- optional price override;
- active flag if variant-level hiding is introduced.

Variant examples:

- flavor;
- color;
- nicotine strength;
- size;
- device model.

## Categories

Categories organize catalog browsing.

Category fields:

- id;
- display name;
- sort order;
- active flag if category hiding is introduced.

Products may reference one category. Removing a category must not delete products; affected products become uncategorized or must be reassigned before category deletion, depending on implementation choice.

## Source availability

Product content may be reusable across sources, but availability is source-specific.

Local Point availability:

- tied to a Local Point;
- backed by Local Point inventory rows;
- shown only for that Local Point when stock and visibility rules allow it.

InPost availability:

- separate from Local Point stock;
- must not read or deduct Local Point inventory;
- must not share cart state with Local Point carts.

## Product requests

Curator-created products enter the system through product requests. A product request stores proposed product, variant, media, price and inventory data before publication.

On approval:

- a live product is created or updated according to publishing rules;
- variants are created;
- inventory rows are created for the selected source;
- the live product is linked back to the request.

## Backend requirements

Backend must:

- validate required fields;
- validate price precision;
- validate variant list before publication;
- expose products through catalog APIs;
- keep backend as source of truth for active state, price and availability;
- prevent deleted or inactive products from being added to cart;
- prevent inactive variants from being ordered when variant-level active state exists.

## Frontend requirements

Frontend must:

- display product cards using the existing UI style;
- show product detail with variants and price;
- reflect backend active/availability state;
- show unavailable products as unavailable or hide them according to catalog rules;
- never calculate authoritative prices without backend validation.

## Data model

Minimum persistent live catalog entities:

- `products`;
- `product_variants`;
- `categories`;
- source-specific inventory table or tables;
- optional request-to-product audit link.

Existing implementation already contains:

- `products`;
- `product_variants`;
- `categories`;
- `location_stock`.

The product request slice should add request persistence without replacing the existing live product tables.

## Validation

Product validation:

- name is required;
- base price is greater than or equal to zero;
- category exists when provided;
- product can be inactive but inactive products are not orderable.

Variant validation:

- variant name is required;
- price override is either null or greater than or equal to zero;
- variant belongs to exactly one product.

## Edge cases

- Product has no variants: cannot be submitted or approved.
- Product is inactive: must not be returned as orderable.
- Variant price override is null: product base price is used.
- Category is removed: products must remain safe and visible only if catalog rules allow uncategorized products.
- Product exists in multiple sources: inventory and cart behavior remain source-specific.

## Test plan

Backend tests:

- product cannot be approved without variants;
- inactive product is not orderable;
- null variant price uses base price;
- category deletion does not delete products;
- Local Point stock does not affect InPost availability.

Frontend tests:

- product card renders name, price and availability;
- variant selection changes displayed price when override exists;
- unavailable product cannot be added to cart.

## Definition of Done

The product model is complete when:

- live products, variants and categories are represented consistently;
- product requests can publish into the live model;
- source availability is separated from product identity;
- backend validates prices, active state and variant requirements;
- frontend displays products without becoming source of truth for price or availability.

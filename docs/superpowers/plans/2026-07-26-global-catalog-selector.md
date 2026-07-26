# Global Catalog Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old customer city -> point catalog entry with one global selected catalog source that drives Home, Catalog, product details, cart and checkout.

**Architecture:** Backend owns the cart source after a cart exists; frontend keeps only a validated local cache for the selected source before cart source is known. Local Points use `location_stock`, InPost uses a separate `inpost_stock` table but remains disabled until stock and first-slice checkout validation are implemented. Google geocoding and map rendering are added behind explicit env/config checks so missing keys do not crash the Mini App.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Pydantic, Python unittest, React, TypeScript, Zustand, Vite, Node test runner, Google Geocoding API, Google Maps JavaScript API.

---

## Scope Split

This feature touches independent backend schema, cart semantics, customer navigation, map integration and InPost checkout. Implement it as staged commits. Each task below must leave the app runnable and testable.

Release gate:

- Local Point global selector can ship first.
- InPost must render disabled until `inpost_stock` management and InPost checkout validation both pass tests.
- Google Map tab must degrade to the List tab if `VITE_GOOGLE_MAPS_API_KEY` is absent.
- Admin point create/update must not be deployed with blocking geocoding unless `GOOGLE_GEOCODING_API_KEY` exists in Railway.

## File Map

- `alembic/versions/0006_global_catalog_sources.py`: schema migration for coordinates, cart source, order source and InPost stock.
- `db/models/location.py`: nullable `latitude` and `longitude`.
- `db/models/cart.py`: explicit `source_type`.
- `db/models/inpost_stock.py`: warehouse stock per variant.
- `db/models/order.py`: source and first-slice InPost fulfillment fields.
- `db/models/__init__.py`: import new model.
- `config.py`: Google API settings.
- `webapp/errors.py`: new catalog/cart/order/geocoding error codes.
- `webapp/services/geocoding.py`: Google geocoding wrapper with timeout and typed errors.
- `webapp/schemas.py`: catalog source, cart source, item availability and InPost order schemas.
- `db/repositories/catalog.py`: selector source queries, InPost stock queries, source-aware products.
- `db/repositories/cart.py`: source-aware get/create/set helpers.
- `db/repositories/order.py`: source fields on order creation.
- `webapp/routes/catalog.py`: `/api/catalog-sources`, product source matrix and Local Point validation.
- `webapp/routes/cart.py`: cart source response, source-aware mutations and inactive item availability.
- `webapp/routes/orders.py`: checkout source validation and InPost disabled/first-slice behavior.
- `webapp/routes/admin.py`: point geocoding on create/update and optional InPost stock admin extension.
- `frontend/src/api/client.ts`: source/cart/order types and API methods.
- `frontend/src/store/catalogSource.ts`: selected source store with localStorage and cart hydration helpers.
- `frontend/src/store/cart.ts`: expose backend cart source and clear-on-switch support.
- `frontend/src/pages/CatalogSelector.tsx`: new full-screen selector with List/Map tabs.
- `frontend/src/pages/Home.tsx`: header/source action and pre-selection popular state.
- `frontend/src/pages/Products.tsx`: selected source product loading and deep-link hydration.
- `frontend/src/pages/ProductDetail.tsx`: selected source detail loading and add-to-cart.
- `frontend/src/pages/Cart.tsx`: inactive item rendering and checkout blocking.
- `frontend/src/pages/Checkout.tsx`: source-specific delivery options.
- `frontend/src/App.tsx`: route redirects and `/catalog-selector`.
- `frontend/src/i18n/locales/ru.ts`: all new RU strings.
- `frontend/src/vite-env.d.ts`: `VITE_GOOGLE_MAPS_API_KEY`.
- `frontend/src/index.css`: selector screen, accordion, map fallback and modal styles.

## Task 1: Backend Schema Foundation

**Files:**
- Create: `alembic/versions/0006_global_catalog_sources.py`
- Create: `db/models/inpost_stock.py`
- Modify: `db/models/location.py`
- Modify: `db/models/cart.py`
- Modify: `db/models/order.py`
- Modify: `db/models/__init__.py`
- Test: `tests/test_global_catalog_schema.py`

- [ ] **Step 1: Write schema tests**

Create `tests/test_global_catalog_schema.py` with tests that create metadata in SQLite and assert the new columns/tables exist:

```python
import unittest

import db.models  # noqa: F401
from db.session import Base


class GlobalCatalogSchemaTest(unittest.TestCase):
    def test_location_cart_order_and_inpost_schema_are_registered(self):
        self.assertIn("locations", Base.metadata.tables)
        self.assertIn("carts", Base.metadata.tables)
        self.assertIn("orders", Base.metadata.tables)
        self.assertIn("inpost_stock", Base.metadata.tables)

        locations = Base.metadata.tables["locations"].c
        carts = Base.metadata.tables["carts"].c
        orders = Base.metadata.tables["orders"].c
        inpost_stock = Base.metadata.tables["inpost_stock"].c

        self.assertIn("latitude", locations)
        self.assertIn("longitude", locations)
        self.assertIn("source_type", carts)
        self.assertIn("source_type", orders)
        self.assertIn("inpost_delivery_method", orders)
        self.assertIn("inpost_point_id", orders)
        self.assertIn("inpost_point_label", orders)
        self.assertIn("inpost_courier_address_json", orders)
        self.assertIn("variant_id", inpost_stock)
        self.assertIn("quantity", inpost_stock)
        self.assertIn("last_sold_at", inpost_stock)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the failing test**

Run: `python -m unittest tests.test_global_catalog_schema -v`

Expected before implementation: FAIL because `inpost_stock`, `latitude`, `longitude` and `source_type` do not exist.

- [ ] **Step 3: Add model fields**

Implement:

- `Location.latitude` and `Location.longitude` as nullable `Numeric(9, 6)`;
- `Cart.source_type` as nullable `String(32)`;
- `Order.source_type` as nullable `String(32)`;
- `Order.inpost_delivery_method`, `Order.inpost_point_id`, `Order.inpost_point_label`, `Order.inpost_courier_address_json`;
- `InpostStock` model with unique `variant_id`, `quantity`, `last_sold_at`;
- import `db.models.inpost_stock` from `db/models/__init__.py`.

- [ ] **Step 4: Add Alembic migration**

Create revision `0006_global_catalog_sources.py` with:

```python
"""global catalog sources

Revision ID: 0006_global_catalog_sources
Revises: 0005_product_request_review_loop
Create Date: 2026-07-26
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0006_global_catalog_sources"
down_revision = "0005_product_request_review_loop"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("latitude", sa.Numeric(9, 6), nullable=True))
    op.add_column("locations", sa.Column("longitude", sa.Numeric(9, 6), nullable=True))
    op.add_column("carts", sa.Column("source_type", sa.String(length=32), nullable=True))
    op.add_column("orders", sa.Column("source_type", sa.String(length=32), nullable=True))
    op.add_column("orders", sa.Column("inpost_delivery_method", sa.String(length=32), nullable=True))
    op.add_column("orders", sa.Column("inpost_point_id", sa.String(length=128), nullable=True))
    op.add_column("orders", sa.Column("inpost_point_label", sa.String(length=256), nullable=True))
    op.add_column("orders", sa.Column("inpost_courier_address_json", sa.Text(), nullable=True))
    op.create_table(
        "inpost_stock",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("variant_id", name="uq_inpost_variant"),
    )
    op.create_index(op.f("ix_inpost_stock_variant_id"), "inpost_stock", ["variant_id"], unique=False)
    op.execute("UPDATE carts SET source_type = 'local_point' WHERE location_id IS NOT NULL")
    op.execute("UPDATE orders SET source_type = 'local_point' WHERE location_id IS NOT NULL")


def downgrade() -> None:
    op.drop_index(op.f("ix_inpost_stock_variant_id"), table_name="inpost_stock")
    op.drop_table("inpost_stock")
    op.drop_column("orders", "inpost_courier_address_json")
    op.drop_column("orders", "inpost_point_label")
    op.drop_column("orders", "inpost_point_id")
    op.drop_column("orders", "inpost_delivery_method")
    op.drop_column("orders", "source_type")
    op.drop_column("carts", "source_type")
    op.drop_column("locations", "longitude")
    op.drop_column("locations", "latitude")
```

- [ ] **Step 5: Verify schema tests pass**

Run: `python -m unittest tests.test_global_catalog_schema -v`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add alembic/versions/0006_global_catalog_sources.py db/models tests/test_global_catalog_schema.py
git commit -m "Add global catalog source schema"
```

## Task 2: Catalog Sources API And Source-Aware Products

**Files:**
- Modify: `webapp/schemas.py`
- Modify: `db/repositories/catalog.py`
- Modify: `webapp/routes/catalog.py`
- Modify: `webapp/errors.py`
- Test: `tests/test_catalog_sources_contract.py`

- [ ] **Step 1: Write selector API tests**

Create tests that seed one active city, one active location with manager, one active location without manager, stock rows, product/variant and an InPost stock row. Assert `/api/catalog-sources` returns:

- `inpost.type == "inpost"`;
- cities grouped by city;
- local point `status == "available"` when it has an active point manager;
- local point `status == "coming_soon"` when manager is missing;
- stock count excludes inactive products;
- coordinates are included.

- [ ] **Step 2: Write product source matrix tests**

Add tests for:

- `/api/products?location_id={id}` returns only variants stocked at that Local Point;
- `/api/products?source=inpost` returns variants stocked in `inpost_stock`;
- `source=inpost&location_id={id}` returns `catalog.source_invalid`;
- `/api/products/{id}?source=inpost` returns 404 when no InPost variant has quantity.

- [ ] **Step 3: Run failing backend tests**

Run: `python -m unittest tests.test_catalog_sources_contract -v`

Expected before implementation: FAIL because endpoint and InPost source matrix do not exist.

- [ ] **Step 4: Add schemas**

Add Pydantic schemas:

```python
class CatalogSourceInpostSchema(BaseModel):
    type: str = "inpost"
    status: str
    stock_count: int


class CatalogSourceLocationSchema(BaseModel):
    type: str = "local_point"
    id: int
    city_id: int
    name: str
    address: str
    status: str
    catalog_available: bool
    stock_count: int
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    manager_tg_username: Optional[str] = None


class CatalogSourceCitySchema(BaseModel):
    id: int
    name: str
    locations: List[CatalogSourceLocationSchema]


class CatalogSourcesSchema(BaseModel):
    inpost: CatalogSourceInpostSchema
    cities: List[CatalogSourceCitySchema]
```

- [ ] **Step 5: Add repository helpers**

Add methods to `CatalogRepository`:

- `get_catalog_source_cities()`;
- `get_inpost_stock_summary()`;
- `get_products(..., source: str | None = None)`;
- `get_product(..., source: str | None = None)`;
- `get_inpost_variant_quantity(variant_id: int)`.

Keep Local Point behavior unchanged when `source` is absent.

- [ ] **Step 6: Add route behavior**

Implement `/api/catalog-sources`, add `source: Optional[str] = Query(None)` to product routes, and enforce:

- `source` allowed only as `"inpost"`;
- `source` and `location_id` are mutually exclusive;
- InPost products filter by `inpost_stock.quantity > 0`;
- Local Point validation remains manager-aware.

- [ ] **Step 7: Verify**

Run:

```bash
python -m unittest tests.test_catalog_sources_contract tests.test_admin_inventory_contract -v
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add webapp/schemas.py db/repositories/catalog.py webapp/routes/catalog.py webapp/errors.py tests/test_catalog_sources_contract.py
git commit -m "Add catalog source API"
```

## Task 3: Cart Source Contract And Inactive Items

**Files:**
- Modify: `webapp/schemas.py`
- Modify: `db/repositories/cart.py`
- Modify: `webapp/routes/cart.py`
- Modify: `webapp/errors.py`
- Test: `tests/test_cart_source_contract.py`

- [ ] **Step 1: Write cart tests**

Cover:

- empty cart returns `source = null`;
- adding with `location_id` sets source `{type: "local_point"}`;
- adding with `source_type: "inpost"` sets source `{type: "inpost"}`;
- adding InPost item to Local Point cart returns `cart.source_mismatch`;
- adding Local Point item from another point returns `cart.source_mismatch`;
- inactive/unavailable items remain in response with `availability.active == false`;
- inactive items can be removed;
- inactive items cannot be increased.

- [ ] **Step 2: Run failing tests**

Run: `python -m unittest tests.test_cart_source_contract -v`

Expected before implementation: FAIL because request/response source fields and availability are missing.

- [ ] **Step 3: Extend schemas**

Add:

```python
class CartSourceSchema(BaseModel):
    type: str
    location_id: Optional[int] = None
    status: str


class CartItemAvailabilitySchema(BaseModel):
    active: bool
    reason: Optional[str] = None
    available_quantity: int
```

Then add `source: Optional[CartSourceSchema]` to `CartSchema`, `availability: CartItemAvailabilitySchema` to `CartItemSchema`, and `source_type: Optional[str]` to `AddCartItemRequest`.

- [ ] **Step 4: Implement repository source helpers**

Add:

- `get_or_create(user_id, source_type=None, location_id=None)`;
- `set_source(cart, source_type, location_id)`;
- `clear(cart_id)` keeps cart row and resets source only when the cart is empty after manual switch if frontend calls a dedicated clear-and-reset helper.

- [ ] **Step 5: Implement availability calculation**

In `webapp/routes/cart.py`, calculate item availability from:

- product active;
- variant exists;
- selected Local Point active/manager/city status and `location_stock`;
- selected InPost status and `inpost_stock`.

Return inactive item reasons from the spec: `source_unavailable`, `product_unavailable`, `variant_unavailable`, `insufficient_stock`.

- [ ] **Step 6: Implement mutation rules**

Enforce:

- Local Point add requires `location_id`;
- InPost add requires `source_type == "inpost"`;
- cannot mix sources;
- increasing checks stock;
- decreasing/removing inactive items is allowed.

- [ ] **Step 7: Verify**

Run:

```bash
python -m unittest tests.test_cart_source_contract tests.test_order_delivery -v
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add webapp/schemas.py db/repositories/cart.py webapp/routes/cart.py webapp/errors.py tests/test_cart_source_contract.py
git commit -m "Add source-aware cart contract"
```

## Task 4: Checkout Source Validation

**Files:**
- Modify: `webapp/schemas.py`
- Modify: `db/repositories/order.py`
- Modify: `webapp/routes/orders.py`
- Modify: `webapp/errors.py`
- Test: `tests/test_order_source_contract.py`

- [ ] **Step 1: Write checkout tests**

Cover:

- checkout rejects carts with inactive item availability;
- Local Point checkout requires local point source and decrements `location_stock`;
- InPost checkout is rejected with a clear unavailable/not-implemented error until validated InPost fields are implemented;
- when first-slice InPost is enabled in this task, `inpost_locker` requires `inpost_point_id` and `inpost_point_label`;
- `inpost_courier` requires structured courier address JSON;
- InPost checkout decrements `inpost_stock`.

- [ ] **Step 2: Run failing tests**

Run: `python -m unittest tests.test_order_source_contract -v`

Expected before implementation: FAIL because order source fields and inactive item checkout blocking are missing.

- [ ] **Step 3: Extend `CreateOrderRequest`**

Add optional fields:

- `source_type`;
- `inpost_delivery_method`;
- `inpost_point_id`;
- `inpost_point_label`;
- `inpost_courier_address`.

Keep existing Local Point request shape working.

- [ ] **Step 4: Implement Local Point validation through cart source**

Change checkout to use `cart.source_type` and `cart.location_id`, not only `body.location_id`.

- [ ] **Step 5: Implement InPost gate**

If official validation is not implemented in this release, reject InPost checkout with `order.inpost_unavailable` and keep InPost source disabled in `/api/catalog-sources`.

If implementing first-slice now, validate required fields and decrement `inpost_stock`.

- [ ] **Step 6: Verify**

Run:

```bash
python -m unittest tests.test_order_source_contract tests.test_order_delivery -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add webapp/schemas.py db/repositories/order.py webapp/routes/orders.py webapp/errors.py tests/test_order_source_contract.py
git commit -m "Validate checkout catalog source"
```

## Task 5: Google Geocoding Service And Admin Point Coordinates

**Files:**
- Modify: `config.py`
- Create: `webapp/services/geocoding.py`
- Modify: `webapp/routes/admin.py`
- Test: `tests/test_admin_location_geocoding.py`

- [ ] **Step 1: Write geocoding tests**

Cover:

- create location stores `latitude` and `longitude` from a patched geocoder;
- update location re-geocodes when address changes;
- update location does not geocode when address is unchanged;
- invalid address returns a domain error;
- missing key returns a configuration domain error;
- delete city/location cleanup still works.

- [ ] **Step 2: Run failing tests**

Run:

```bash
python -m unittest tests.test_admin_location_geocoding tests.test_admin_delete_contract -v
```

Expected before implementation: FAIL for geocoding tests, existing delete tests pass.

- [ ] **Step 3: Add settings**

Add to `config.py`:

```python
GOOGLE_GEOCODING_API_KEY: str | None = None
GOOGLE_GEOCODING_TIMEOUT_SECONDS: float = 4.0
```

- [ ] **Step 4: Implement service**

Create `webapp/services/geocoding.py` with:

- `GeocodingConfigError`;
- `GeocodingAddressNotFound`;
- `GeocodingTransientError`;
- `GoogleGeocoder.geocode(address: str) -> tuple[Decimal, Decimal]`.

Use `httpx.AsyncClient(timeout=settings.GOOGLE_GEOCODING_TIMEOUT_SECONDS)`.

- [ ] **Step 5: Wire admin create/update**

In `admin_create_location`, geocode before commit. In `admin_update_location`, geocode only when `body.address` is present and different from `loc.address`.

- [ ] **Step 6: Verify**

Run:

```bash
python -m unittest tests.test_admin_location_geocoding tests.test_admin_delete_contract -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add config.py webapp/services/geocoding.py webapp/routes/admin.py tests/test_admin_location_geocoding.py
git commit -m "Add location geocoding"
```

## Task 6: Frontend Source Store And API Types

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/store/cart.ts`
- Create: `frontend/src/store/catalogSource.ts`
- Modify: `frontend/src/vite-env.d.ts`
- Test: `frontend/tests/catalogSourceStore.test.mjs`

- [ ] **Step 1: Write frontend store tests**

Test source resolution from:

- backend cart source wins over localStorage;
- empty cart falls back to localStorage;
- invalid remembered source is cleared;
- non-empty cart switch calls clear cart before applying target source;
- clear-cart failure keeps current source.

- [ ] **Step 2: Run failing tests**

Run: `cd frontend && npm test -- catalogSourceStore`

Expected before implementation: FAIL because store does not exist.

- [ ] **Step 3: Add API types and methods**

Add interfaces for `CatalogSources`, `CatalogSource`, `CartSource`, `CartItemAvailability`, extend `Cart` and `CartItem`, and add:

- `api.catalog.sources()`;
- `api.catalog.products({ source })`;
- `api.catalog.product(id, { source })`;
- `api.cart.addItem(..., { source_type })`.

- [ ] **Step 4: Add source store**

Create `catalogSource.ts` with:

- `selectedSource`;
- `sources`;
- `loadSources`;
- `hydrateFromCart(cart)`;
- `selectSource(target, cart, clearCart)`;
- `clearSelectedSource`.

Persist with key `catalog.selectedSource.v1`.

- [ ] **Step 5: Verify**

Run:

```bash
cd frontend
npm test -- catalogSourceStore
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add frontend/src/api/client.ts frontend/src/store/cart.ts frontend/src/store/catalogSource.ts frontend/src/vite-env.d.ts frontend/tests/catalogSourceStore.test.mjs
git commit -m "Add frontend catalog source store"
```

## Task 7: Frontend Selector Screen And Navigation

**Files:**
- Create: `frontend/src/pages/CatalogSelector.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Home.tsx`
- Modify: `frontend/src/pages/Products.tsx`
- Modify: `frontend/src/pages/ProductDetail.tsx`
- Modify: `frontend/src/components/CopiedBottomNav.tsx`
- Modify: `frontend/src/utils/copiedBottomNav.ts`
- Modify: `frontend/src/i18n/locales/ru.ts`
- Modify: `frontend/src/index.css`
- Test: `frontend/tests/globalCatalogSelector.test.mjs`
- Test: `frontend/tests/responsiveLayout.test.mjs`
- Test: `frontend/tests/copiedBottomNav.test.mjs`

- [ ] **Step 1: Write navigation/static tests**

Assert:

- bottom nav catalog path is `/products`;
- `/catalog-selector` route exists;
- `/cities` and `/cities/:cityId/locations` redirect to selector in customer flow;
- Home uses `catalogSource` store and shows selector action;
- Products redirects to selector when no source is selected;
- Products calls `api.catalog.products` with `location_id` or `source: "inpost"`;
- ProductDetail preserves selected source.

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd frontend
npm test -- globalCatalogSelector responsiveLayout copiedBottomNav
```

Expected before implementation: FAIL on new selector expectations.

- [ ] **Step 3: Implement `CatalogSelector.tsx`**

Build a full-screen copied-style page with:

- top/back area;
- separate InPost block;
- tabs `list` and `map`;
- Local Points divider;
- one-open-city accordion;
- point rows with address, stock count, status, working-hours text;
- disabled state for coming soon/inactive sources;
- source switch confirmation when cart has items.

- [ ] **Step 4: Update Home**

Replace hardcoded navigation to `/cities` with:

- if selected source exists: catalog actions go `/products`;
- if none: catalog actions go `/catalog-selector`;
- popular section shows the pre-selection empty state until source exists.

- [ ] **Step 5: Update Products/ProductDetail**

Remove old mandatory back arrow behavior for root catalog. Load by selected source:

- Local Point: `location_id`;
- InPost: `source=inpost`;
- no source: `navigate('/catalog-selector', { replace: true })`.

Keep deep-link hydration for `location_id` and `source=inpost`.

- [ ] **Step 6: Update app routes and bottom nav**

Add `/catalog-selector`. Make `/cities` and `/cities/:cityId/locations` redirect to `/catalog-selector` with replace. Keep old route components only if admin/tests still need them, but remove them from customer navigation.

- [ ] **Step 7: Verify**

Run:

```bash
cd frontend
npm test -- globalCatalogSelector responsiveLayout copiedBottomNav
npm run check:ui-strings
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add frontend/src frontend/tests
git commit -m "Add global catalog selector UI"
```

## Task 8: Map Tab And Google Frontend Fallbacks

**Files:**
- Modify: `frontend/src/pages/CatalogSelector.tsx`
- Create: `frontend/src/components/GoogleMapSelector.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/tests/googleMapSelector.test.mjs`

- [ ] **Step 1: Write map tests**

Assert:

- missing `VITE_GOOGLE_MAPS_API_KEY` renders map unavailable state;
- InPost is not rendered as a marker source;
- Local Point markers use latitude/longitude;
- no coordinates shows empty map state and List tab remains available;
- map component code does not crash when `window.google` is absent.

- [ ] **Step 2: Run failing tests**

Run: `cd frontend && npm test -- googleMapSelector`

Expected before implementation: FAIL because map component does not exist.

- [ ] **Step 3: Implement map component**

Create a component that:

- checks `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`;
- lazy-loads Google Maps script;
- renders bounded loading, unavailable and retry states;
- renders markers only for Local Points with coordinates.

- [ ] **Step 4: Verify**

Run:

```bash
cd frontend
npm test -- googleMapSelector
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add frontend/src/components/GoogleMapSelector.tsx frontend/src/pages/CatalogSelector.tsx frontend/src/index.css frontend/tests/googleMapSelector.test.mjs
git commit -m "Add catalog selector map fallback"
```

## Task 9: InPost Stock Admin And Enablement Gate

**Files:**
- Modify: `webapp/schemas.py`
- Modify: `webapp/routes/admin.py`
- Modify: `webapp/routes/catalog.py`
- Modify: `frontend/src/pages/admin/AdminStock.tsx`
- Modify: `frontend/src/i18n/locales/ru.ts`
- Test: `tests/test_admin_inpost_stock_contract.py`
- Test: `frontend/tests/adminInpostStock.test.mjs`

- [ ] **Step 1: Write backend tests**

Cover:

- admin stock can return Local Point rows and InPost rows separately;
- updating InPost stock upserts `inpost_stock`;
- deleted products/variants are excluded;
- `/api/catalog-sources` returns InPost `inactive` when no managed stock or checkout gate is disabled.

- [ ] **Step 2: Write frontend tests**

Assert AdminStock has a source filter/tabs for Local Points and InPost, and InPost quantity inputs use the same dark input styling as existing stock fields.

- [ ] **Step 3: Run failing tests**

Run:

```bash
python -m unittest tests.test_admin_inpost_stock_contract -v
cd frontend && npm test -- adminInpostStock
```

Expected before implementation: FAIL.

- [ ] **Step 4: Implement stock admin extension**

Add source type to stock rows without breaking existing Local Point stock update. InPost stock rows must not require `location_id`.

- [ ] **Step 5: Enable InPost only when safe**

In `/api/catalog-sources`, set InPost `status = "available"` only when:

- at least one active InPost variant has quantity > 0;
- checkout source validation for InPost is enabled by code/tests.

- [ ] **Step 6: Verify**

Run:

```bash
python -m unittest tests.test_admin_inpost_stock_contract tests.test_catalog_sources_contract -v
cd frontend && npm test -- adminInpostStock
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add webapp/schemas.py webapp/routes/admin.py webapp/routes/catalog.py frontend/src/pages/admin/AdminStock.tsx frontend/src/i18n/locales/ru.ts tests/test_admin_inpost_stock_contract.py frontend/tests/adminInpostStock.test.mjs
git commit -m "Add InPost stock management gate"
```

## Task 10: Full Verification, Review And Deploy

**Files:**
- No new feature files expected.

- [ ] **Step 1: Backend full test run**

Run:

```bash
python -m unittest discover tests -v
```

Expected: PASS.

- [ ] **Step 2: Frontend full test run**

Run:

```bash
cd frontend
npm test
npm run check:ui-strings
npm run build
```

Expected: PASS.

- [ ] **Step 3: Static diff checks**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only intended branch ahead state.

- [ ] **Step 4: Subagent review**

Send the final diff to two reviewers:

- Backend/API reviewer: schema migrations, API contracts, source/cart/order invariants, rollback.
- Frontend/UX reviewer: source selector flow, Telegram navigation, responsive layout, unavailable states.

- [ ] **Step 5: Apply accepted review fixes**

For every review item:

- verify it against the codebase;
- implement only technically correct items;
- rerun the narrow tests that cover the touched area.

- [ ] **Step 6: Final smoke test**

Run the app locally and verify:

- Home opens with no selected catalog and shows the pre-selection popular state;
- selector opens from Home and Catalog;
- Local Point selection changes Catalog immediately;
- non-empty cart source switch asks for confirmation and clears after confirm;
- old `/cities` redirects to selector;
- old `/locations/:id/products` hydrates source or redirects;
- InPost is disabled unless stock and checkout gates are enabled;
- missing Google frontend key does not crash the Map tab.

- [ ] **Step 7: Commit review fixes**

Run:

```bash
git add .
git commit -m "Finalize global catalog selector"
```

- [ ] **Step 8: Push and deploy after user approval**

Run only after explicit approval:

```bash
git push origin main
```

Then deploy Vercel/Railway using the existing project process and smoke-test Railway health.

## Self-Review

Spec coverage:

- Global selected source: Tasks 2, 6, 7.
- Backend source of truth through cart: Tasks 3, 6.
- Manual switch confirmation and clear: Tasks 6, 7.
- Backend-driven unavailable cart items: Task 3.
- Old customer routes and deep links: Task 7.
- InPost separate stock and no fake location: Tasks 1, 2, 9.
- InPost checkout gate: Task 4.
- Google geocoding and map fallback: Tasks 5, 8.
- Admin point create/update geocoding: Task 5.
- Tests and review: Task 10.

Known constraints:

- Google keys are not available yet, so geocoding and map behavior must be tested with patched services and missing-key fallbacks.
- InPost official validation is not integrated yet; InPost must stay disabled unless first-slice validation is explicitly completed.
- The current RU locale file contains existing mojibake-like text. This plan does not include a full locale repair; new strings should be added through the existing i18n structure without introducing hardcoded UI strings.

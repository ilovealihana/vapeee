# Global Catalog Selector Design

## Goal

Replace the current city -> local point catalog flow with one global catalog source selection that drives the customer Mini App. Customers choose a catalog once from the Home header, then Home, Catalog, product details, cart and checkout adapt to that selected source.

The selected source can be either:

- a Local Point catalog backed by that point's stock;
- the InPost catalog backed by separate warehouse stock.

## Decisions

- The header action label is the RU UI string for "Choose catalog".
- Before a catalog is selected, Home remains usable, but the popular-products area shows the RU UI string for "Choose a point to see popular products near you".
- The selected catalog is cached in frontend state and `localStorage`, but backend cart source is the source of truth whenever a backend cart exists.
- Bottom navigation "Catalog" opens products for the selected source immediately.
- If no source is selected and the user opens Catalog, the app opens the new catalog selector.
- Old customer `/cities` and `/cities/:cityId/locations` UI is removed from the normal app flow.
- Direct visits to old customer routes redirect to the new selector.
- Direct visits to old product routes with `location_id` hydrate or validate source before rendering.
- The old city/location selection pages must not remain as a parallel UX.
- Manual source switching with a non-empty cart requires confirmation and clears the cart after confirmation.
- The previous no-delete cart switching rule is replaced by this explicit confirmation-and-clear rule.
- If the already-selected source or cart items become unavailable by backend state changes, the selected source and cart remain visible; unavailable cart items become inactive and checkout is blocked until they become available again or the user changes/clears the cart.
- InPost can be selectable only when first-slice InPost stock and checkout validation are implemented. If not ready, InPost is rendered disabled/unavailable.

## Source Of Truth And Synchronization

Backend cart source is authoritative after the user has a cart.

Frontend uses `localStorage` only to remember the last selected source before a backend cart exists or when the backend cart is empty. On app startup:

1. Fetch user and cart.
2. Fetch `/api/catalog-sources`.
3. If backend cart has a source, hydrate selected source from cart source and validate it against selector sources.
4. If cart is empty and `localStorage` has a source, validate it against selector sources.
5. If the remembered source no longer exists, clear frontend selection and remove the stored value.
6. If the remembered source exists but is unavailable, keep it selected and show its unavailable status.

Manual source switching:

- target source must exist in `/api/catalog-sources`;
- target source must be `available` to become the active shopping source;
- switching to a disabled/unavailable source is blocked;
- if the backend cart has items, show confirmation;
- if the user cancels, keep current source and cart unchanged;
- if the user confirms, call clear cart first, then set the new selected source locally;
- if clear cart fails, keep current source and show the error.

Multi-device behavior:

- a different device can change the backend cart source;
- every cart fetch can update the local selected source from backend cart source;
- frontend must not silently keep a stale localStorage source when backend cart source differs.

## Selected Source Model

Frontend stores a source-shaped value rather than only a `location_id`:

```ts
type SelectedCatalog =
  | {
      type: 'local_point';
      locationId: number;
      cityId: number;
      name: string;
      status: 'available' | 'coming_soon' | 'inactive';
    }
  | {
      type: 'inpost';
      status: 'available' | 'inactive';
    };
```

Local Point status mapping:

- `inactive`: `locations.is_active = false`; hidden from selector except when it is the user's saved or cart source;
- `coming_soon`: active point with `catalog_available = false`, usually because no active point manager exists;
- `available`: active point with `catalog_available = true`.

Stock count in selector rows is total available active quantity for the source:

- Local Point: sum of active product variant quantities in `location_stock`;
- InPost: sum of active product variant quantities in `inpost_stock`.

Local Point sources use local point stock. InPost uses warehouse stock and must not be represented as a fake Local Point.

## Customer Navigation

Home:

- shows the Home title and the "Choose catalog" action in the header area;
- if a source is selected, the action shows `InPost` or the selected point name;
- pickup, delivery, categories and all catalog-entry actions open the selector first when no source is selected;
- popular products show a pre-selection empty state until a source is selected;
- after source selection, popular products are source-specific.

Catalog:

- Local Point source: list products with the selected `location_id`;
- InPost source: list products from the InPost warehouse catalog;
- no source: open the selector instead of showing old city selection;
- unavailable selected source: show a clear unavailable state and block add-to-cart.

Product detail:

- uses the selected source for availability and add-to-cart;
- must not lose source context during navigation;
- a direct product detail route with `location_id` must validate or hydrate the matching local source before rendering;
- a direct product detail route with `source=inpost` must validate InPost availability before rendering.

## Deep Links And Back Navigation

Routes removed from normal UI:

- `/cities`;
- `/cities/:cityId/locations`;
- `/locations/:locationId/products`.

Redirect behavior:

- `/cities` -> `/catalog-selector` with history replace;
- `/cities/:cityId/locations` -> `/catalog-selector` with history replace;
- `/locations/:locationId/products` -> hydrate selected Local Point if valid, then show Catalog; otherwise redirect to `/catalog-selector`;
- `/products?location_id={id}` -> hydrate selected Local Point if valid, then render product list;
- `/products/{id}?location_id={id}` -> hydrate selected Local Point if valid, then render detail;
- `/products?source=inpost` and `/products/{id}?source=inpost` hydrate InPost if available.

Telegram Mini App BackButton:

- the selector screen registers the Telegram BackButton when available;
- from selector opened by Catalog without source, BackButton returns Home;
- from selector opened by header action, BackButton returns the previous screen;
- redirect-based entries use history replace so BackButton does not loop through removed routes.

## Catalog Selector Screen

Add a dedicated customer screen at `/catalog-selector`.

The screen has:

- back navigation;
- a separate InPost block;
- a segmented control for "List" and "Map";
- source selection actions.

## Selector List Tab

The list tab contains:

- an InPost block at the top;
- a divider labelled "Local points";
- cities as an accordion;
- only one city open at a time;
- opening another city smoothly closes the previous one and opens the new one.

Each Local Point row shows:

- point name;
- address;
- stock count;
- the RU UI string for "Working hours: ask the manager";
- availability status.

Unavailable active points remain visible with a "Coming soon" status, but cannot be selected as an active catalog. Fully inactive points are hidden unless backend intentionally returns them as a saved unavailable selection.

## Selector Map Tab

The map tab uses Google Maps and shows all Local Points at once.

Map behavior:

- InPost remains a separate block outside the map and is not shown as a Local Point marker;
- Local Point markers are rendered from stored coordinates;
- tapping a marker opens a point card;
- the point card shows name, address, stock count, working-hours text, status and select action;
- unavailable points can have a disabled or muted marker/card state.

Map failure and fallback states:

- missing frontend key: show a map-unavailable message and keep List tab usable;
- script load failure: show a map-unavailable message and keep List tab usable;
- slow network: show a bounded loading state, then a retry action;
- no points with coordinates: show an empty map state and link to List tab;
- large marker count: render all points for first launch, but keep marker rendering isolated so clustering can be added later.

## Backend Data Contract

Local Points:

- add nullable `latitude Numeric(9, 6)`;
- add nullable `longitude Numeric(9, 6)`;
- geocode address automatically on create;
- geocode address automatically when address changes;
- block create/update when geocoding fails;
- keep coordinates internal and do not expose them as editable CMS fields.

Coordinate migration:

- add columns nullable first;
- deploy code that requires coordinates for new create/update only;
- existing locations without coordinates remain valid temporarily and appear in List but not Map;
- after Google keys are configured, run a one-off backfill command for existing active locations;
- backfill failures should report city/location/address and leave the row unchanged;
- a later migration can make coordinates required only after all active locations have coordinates.

Google configuration:

- backend env: `GOOGLE_GEOCODING_API_KEY`;
- frontend env: `VITE_GOOGLE_MAPS_API_KEY`;
- backend settings expose `GOOGLE_GEOCODING_API_KEY`;
- frontend env typings expose `VITE_GOOGLE_MAPS_API_KEY`;
- backend geocoding timeout is bounded;
- transient Google failures return a service-unavailable style domain error;
- invalid address returns a validation/domain error;
- missing backend key returns a configuration domain error;
- frontend key is restricted by HTTP referrer and Maps JavaScript API;
- backend key is stored only in Railway env and restricted to Geocoding API where possible.

Geocoding service:

- lives outside route handlers, for example in `webapp/services/geocoding.py`;
- route layer calls the service during admin point create/update;
- tests can inject or patch the service without calling Google.

Catalog selector API:

- expose one customer endpoint: `/api/catalog-sources`;
- return enough data for List and Map tabs without requiring the old `/cities` route flow.

Response shape:

```json
{
  "inpost": {
    "type": "inpost",
    "status": "available",
    "stock_count": 42
  },
  "cities": [
    {
      "id": 1,
      "name": "Wroclaw",
      "locations": [
        {
          "type": "local_point",
          "id": 10,
          "city_id": 1,
          "name": "Center",
          "address": "Main 1",
          "status": "available",
          "catalog_available": true,
          "stock_count": 12,
          "latitude": 51.110000,
          "longitude": 17.030000,
          "manager_tg_username": "manager"
        }
      ]
    }
  ]
}
```

Filtering:

- active cities only;
- active locations only, except saved/cart source recovery if needed;
- available and coming-soon points are returned;
- inactive locations are hidden from ordinary selector lists.

InPost:

- is its own source type;
- has its own availability state;
- uses separate warehouse stock;
- must not be implemented through a fake `location_id`.

Products API:

- Local Point product lists continue to use `location_id`;
- Local Point product details continue to use `location_id`;
- InPost product lists use `/api/products?source=inpost`;
- InPost product details use `/api/products/{id}?source=inpost`;
- `source=inpost` and `location_id` are mutually exclusive;
- no `source` and no `location_id` is no longer used by the customer Catalog flow;
- backend may keep global active product listing for admin/dev compatibility only if it is not linked from customer Catalog;
- frontend must not infer InPost availability from Local Point stock.

InPost stock:

- add a dedicated `inpost_stock` table for the first implementation;
- fields: `id`, `variant_id`, `quantity`, `last_sold_at`;
- unique constraint on `variant_id`;
- keep it separate from `location_stock`;
- each row belongs to a product variant and stores warehouse quantity;
- later migration to a generalized inventory-source model is allowed only if it reduces real duplication.

## Cart API Contract

Database:

- replace ambiguous `carts.location_id = NULL means InPost` with explicit source fields;
- add `carts.source_type` enum/string: `local_point` or `inpost`;
- keep `carts.location_id` nullable and required only when `source_type = local_point`;
- require `location_id IS NULL` when `source_type = inpost`;
- migration maps existing carts:
  - `location_id IS NOT NULL` -> `source_type = local_point`;
  - `location_id IS NULL` and cart has items -> `source_type = inpost` only if InPost stock is enabled, otherwise mark cart source invalid and block checkout;
  - empty carts with no source can remain source-less until selection.

Cart response shape additions:

```ts
type CartSource =
  | { type: 'local_point'; location_id: number; status: 'available' | 'coming_soon' | 'inactive' }
  | { type: 'inpost'; status: 'available' | 'inactive' }
  | null;

type CartItemAvailability =
  | { active: true; reason: null; available_quantity: number }
  | {
      active: false;
      reason:
        | 'source_unavailable'
        | 'product_unavailable'
        | 'variant_unavailable'
        | 'insufficient_stock';
      available_quantity: number;
    };
```

Cart item response includes `availability`.

Cart mutation rules:

- `POST /api/cart/items` accepts source context:
  - Local Point: `location_id`;
  - InPost: `source_type = inpost`;
- backend rejects attempts to mix Local Point and InPost items in one cart;
- backend rejects attempts to mix two Local Points in one cart;
- frontend clears cart before switching source after confirmation;
- quantity can be increased only up to current available quantity;
- inactive items can be decreased or removed;
- inactive items cannot be increased;
- cart and item availability are recalculated on every cart fetch and mutation.

Checkout rules:

- checkout rejects carts with any inactive item;
- Local Point checkout validates local stock and decrements `location_stock`;
- InPost checkout validates warehouse stock and decrements `inpost_stock`;
- checkout error codes distinguish inactive item, insufficient stock and source unavailable.

## Admin Cities And Points

City creation remains mostly unchanged and exists to group Local Points.

Point create/update:

- admin enters name, address and optional description;
- backend geocodes the address;
- save succeeds only if coordinates are found;
- save fails with a user-facing error if the address cannot be found;
- save fails with a user-facing configuration error if Google geocoding is not configured.

Admin UI:

- does not show latitude/longitude;
- does not allow manual coordinate input;
- keeps point deletion behavior that cleans dependent requests, staff assignments and stock.

InPost stock admin:

- first implementation may manage InPost stock through the existing stock admin pattern extended with a source filter;
- if this is too large for the first implementation plan, InPost source must stay disabled until stock rows can be managed safely.

## Cart And Checkout UX

Manual source switch:

- empty cart: switch immediately;
- non-empty cart: show confirmation;
- cancel: no source/cart changes;
- confirm: clear cart, then apply the new source;
- clear failure: keep current source and show error.

Backend-driven unavailability:

- do not clear cart automatically;
- keep the selected source visible with its status;
- mark unavailable cart items inactive;
- block checkout while inactive items remain;
- restore item activity if stock/source availability returns on a later cart refetch.

Local Point checkout:

- remains tied to `location_id`;
- keeps existing pickup/local behavior;
- can continue to expose manager contact where available.

InPost checkout first slice:

- InPost can be selected only if checkout can complete with validated first-slice fields;
- delivery methods: `inpost_locker` and `inpost_courier`;
- `inpost_locker` requires a validated point identifier and display address;
- `inpost_courier` requires structured courier address fields;
- if official InPost validation is not ready, InPost source is disabled rather than accepting unvalidated free text.

Order storage additions:

- `orders.source_type`;
- `orders.location_id` remains for Local Point orders;
- `orders.inpost_delivery_method`;
- `orders.inpost_point_id`;
- `orders.inpost_point_label`;
- `orders.inpost_courier_address_json` or explicit structured address columns.

Future required InPost integration:

- official InPost parcel locker picker or widget;
- validated InPost point ID;
- validated courier address;
- later shipment or label creation if needed.

## Implementation Stages

1. Backend foundation:
   - location coordinate migration;
   - settings and error codes for Google;
   - Google geocoding service;
   - selector API schemas;
   - source status mapping.

2. Admin points update:
   - create/update through geocoding;
   - blocked invalid addresses;
   - hidden coordinates;
   - tests for create/update/delete behavior;
   - legacy coordinate backfill command.

3. Source-aware products and stock:
   - `inpost_stock`;
   - product list/detail `source=inpost`;
   - product source validation matrix;
   - stock admin path or disabled InPost until stock can be managed.

4. Cart/source contract:
   - explicit cart source migration;
   - inactive item response fields;
   - add/update/remove source validation;
   - checkout source and inactive-item validation.

5. Frontend global catalog context:
   - source store;
   - backend cart source hydration;
   - `localStorage` fallback;
   - "Choose catalog" header action;
   - remove old `/cities` UX from customer navigation;
   - deep-link hydration and redirects;
   - Telegram BackButton behavior.

6. Catalog selector screen:
   - list tab;
   - InPost block;
   - city accordion;
   - Google map tab;
   - markers and selected point card;
   - map failure fallbacks.

7. Cart/source UX:
   - confirmation and clear on manual source switch;
   - inactive item rendering;
   - checkout block for inactive items.

8. InPost checkout:
   - parcel locker / courier options;
   - first-slice validated fields;
   - official InPost validation follow-up if not included in the first release.

## Testing

Backend tests should cover:

- point create geocodes and stores coordinates;
- point update re-geocodes only when address changes;
- invalid address blocks create/update;
- missing Google geocoding key returns a domain error;
- selector API returns InPost plus grouped Local Points;
- selector API includes coordinates and availability;
- selector API status mapping from `is_active`, manager and `catalog_available`;
- Local Point product listing still respects local stock;
- InPost product listing uses warehouse stock;
- `source=inpost` and `location_id` are mutually exclusive;
- cart source migration handles existing local carts;
- cart rejects mixed Local Point/InPost items;
- cart exposes inactive items when source or stock becomes unavailable;
- checkout rejects inactive cart items;
- Local Point checkout decrements `location_stock`;
- InPost checkout decrements `inpost_stock`;
- admin delete city/location still cleans dependent data.

Frontend tests should cover:

- Home shows the "Choose catalog" action;
- Home popular section shows the pre-selection empty state;
- selected source hydrates from backend cart source;
- selected source falls back to `localStorage` only when cart has no source;
- Catalog opens selector when no source is selected;
- Catalog uses selected Local Point source;
- Catalog uses selected InPost source;
- old `/cities` routes redirect to selector;
- old `/locations/:locationId/products` hydrates or redirects;
- selector list tab renders InPost, divider, cities and point rows;
- only one city accordion is open at a time;
- selector map tab renders Google map container and point markers from coordinates;
- map failure states keep List tab usable;
- InPost is not rendered as a map marker;
- source switching with non-empty cart prompts and clears cart after confirmation;
- canceling source switch keeps cart and source unchanged;
- clear-cart failure keeps current source;
- inactive cart items block checkout.

## Rollback

Rollback requires coordinated backend and frontend handling because this feature adds schema and API contracts.

Database rollback:

- `latitude` and `longitude` can remain nullable if code rollback is needed;
- `inpost_stock` can remain unused if InPost source is disabled;
- cart source migration requires a downgrade path back to `location_id` only for local carts;
- carts with `source_type = inpost` cannot be downgraded without either clearing those carts or preserving an explicit disabled state.

Operational rollback:

- disable InPost source first if warehouse stock or checkout validation is unstable;
- keep Local Point selector working independently;
- if Google geocoding causes production issues, disable point create/update behind a clear admin error rather than allowing invalid coordinates;
- if Google Maps fails on the frontend, keep selector List tab as the functional fallback.

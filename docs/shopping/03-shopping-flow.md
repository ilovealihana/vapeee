# 03 - Shopping Flow

**Version:** 1.1.0
**Status:** Approved

## Entry

Before entering a catalog, the customer chooses one catalog source:

- Local Point
- InPost

The selected source defines the visible catalog, inventory source, active cart and fulfillment options.

## Local flow

```text
Choose catalog
    ->
Choose a Local Point
    ->
Open that point's catalog
```

A point entry displays:

- point name;
- address;
- product count;
- working-hours text;
- status;
- action to select its catalog.

The selected point supports pickup and local fulfillment rules owned by checkout docs.

## InPost flow

```text
Choose catalog
    ->
Choose InPost
    ->
Open warehouse catalog
```

No city or local point is selected for InPost. InPost uses separate warehouse stock.

## Context switching

Manual source switching changes the visible catalog and active cart source.

If the current cart is empty, switching applies immediately.

If the current cart has items, switching requires explicit confirmation. After confirmation, the current cart is cleared and the new source is applied.

Backend-driven source or stock unavailability must not automatically delete the cart. Instead, affected cart items become inactive and checkout is blocked until availability returns or the customer changes/clears the cart.

## Checkout

One order is created from exactly one active source cart.

Local Point and InPost products cannot be combined in one order.

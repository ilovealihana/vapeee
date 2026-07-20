# 03 — Shopping Flow

**Version:** 1.0.0  
**Status:** Approved

## Entry

Before entering a catalog, the customer chooses:

- Local Points
- InPost

The selected mode defines the catalog source, inventory source, active cart and fulfillment options.

## Local flow

```text
Choose Local Points
    ↓
Choose city
    ↓
View points in that city
    ↓
Choose one point
    ↓
Open that point's catalog
```

A point card displays:

- point name;
- address;
- product count;
- last sale information;
- button to open its catalog;
- button to contact its curator.

The selected point supports pickup and local door delivery.

## InPost flow

```text
Choose InPost
    ↓
Open warehouse catalog
```

No city or local point is selected.

## Context switching

Switching mode or local point changes the visible catalog and active cart.

It must not delete previously built carts.

## Checkout

One order is created from exactly one active source cart.

Local and InPost products cannot be combined in one order.

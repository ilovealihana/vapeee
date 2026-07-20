# Vape Shop Telegram Mini App — Documentation

**Documentation Version:** 1.0.0  
**Status:** In Development

## Start here

Read in this order:

1. [`MASTER_PROMPT.md`](./MASTER_PROMPT.md)
2. [`ARCHITECTURE.md`](./ARCHITECTURE.md)
3. [`core/00-project-rules.md`](./core/00-project-rules.md)
4. The README of the relevant module
5. The specialized files for the task

The folder structure is approved and must not be reorganized without an explicit architecture decision.

## Documentation map

- `core/` — foundation, roles and roadmap
- `shopping/` — user purchase flow
- `shopping/local-points/` — cities, stores, local catalog, pickup and door delivery
- `shopping/inpost/` — warehouse catalog and InPost fulfillment
- `shopping/carts/` — independent source-specific carts
- `products/` — product data and lifecycle
- `admin/` — curator and administrator interfaces
- `backend/` — server contracts and infrastructure
- `ui/` — interface behavior
- `testing/` — quality strategy
- `deployment/` — environments and releases

## Rules

- Documentation is the source of truth for approved business behavior.
- One detailed rule belongs in one file.
- Update documentation together with code.
- Do not invent missing business behavior.
- Backend validation is mandatory for permissions, inventory, prices, carts and orders.

# Point Manager Catalog Availability Design

## Goal

Make staff assignments the single source of truth for Local Point managers and customer catalog availability.

## Decisions

- A Local Point manager is an active `staff_members` row with role `point_manager` and a `staff_assignments.location_id` pointing to the Local Point.
- The legacy `locations.curator_tg_username` field is not used for catalog availability and is removed from the admin UI.
- `locations.is_active = false` hides the Local Point from customers completely.
- `locations.is_active = true` and no active point manager keeps the Local Point visible to customers, but marks it as coming soon and blocks catalog opening.
- `locations.is_active = true` and one active point manager makes the Local Point catalog available.
- Only one active `point_manager` can be assigned to a Local Point at a time.
- Existing Local Points without staff managers become coming soon immediately after deployment.

## Backend Contract

`LocationSchema` exposes computed availability fields:

- `has_manager: bool`
- `manager_tg_id: int | None`
- `catalog_available: bool`

Customer location list endpoints return active Local Points even when `catalog_available` is false. Product catalog endpoints reject a `location_id` without an active manager with the existing inactive-location style error so products cannot be browsed or ordered for that Local Point.

Staff create/update endpoints reject assigning an active second `point_manager` to a Local Point that already has another active point manager.

## Frontend Contract

Admin Cities removes the Telegram manager input from Local Point create/edit modals. The Local Point row shows `Менеджер: ID <tg_id>` when assigned and `Нет менеджера` otherwise.

Customer Locations shows Local Points without a manager as `Скоро открытие`; the catalog button is disabled and does not navigate.

## Testing

Backend tests cover computed schema fields, customer list behavior, catalog blocking without manager, and duplicate active point manager rejection.

Frontend tests cover removed admin manager input, admin manager status text, and customer coming-soon behavior.

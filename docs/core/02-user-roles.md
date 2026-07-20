# 02 — User Roles

**Version:** 1.0.0  
**Status:** Draft

## Customer

Uses the Telegram Mini App to browse source-specific catalogs, manage carts, create orders and view personal order information.

The customer has no administrative access.

## City Curator

A curator operates only within assigned cities and local points.

The curator can:

- access the curator panel;
- create complete product-addition requests;
- choose only existing categories;
- submit requests for a permitted local point or other explicitly granted source;
- view own requests;
- edit rejected requests;
- resubmit corrected requests;
- delete rejected or draft requests when allowed;
- view permitted point inventory and operational information.

The curator cannot:

- approve or publish products;
- manage categories;
- access unrelated cities or points;
- manage roles or administrators.

## Administrator

The administrator can:

- view all product requests;
- edit requests;
- approve requests;
- reject requests with an optional comment;
- manage published products;
- create and manage categories;
- manage cities and local points;
- manage operational users;
- view system-wide analytics and inventory.

Approval publishes the product immediately to the selected catalog.

Rejection returns the request to its curator. After correction, the curator must submit it for review again.

## Super Administrator

The highest role can perform administrator actions and additionally manage administrator roles, global security-sensitive settings and system-level integrations.

## Enforcement

Frontend controls may be hidden based on role, but every protected action must be verified by the backend.

Curator scope must be validated per city, point and resource, not only by role name.

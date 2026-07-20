# 01 — Introduction

**Version:** 1.0.0  
**Status:** Approved

## Product

The project is a Telegram Mini App and administrative platform for a vape-shop network.

Customers purchase through one of two independent modes:

- Local Points
- InPost warehouse

Curators prepare complete product-addition requests. Administrators review, edit, approve or reject those requests.

## Core principles

### Independent purchase modes

Local Points and InPost use independent catalogs, inventory, carts and fulfillment rules.

### Source-specific local shopping

A customer chooses a city and then a specific local point. The catalog and cart belong to that point.

### Source-specific carts

The customer has:

- one independent cart for every local point;
- one separate InPost cart.

Switching context changes the visible cart but does not erase other carts.

### Interface localization

Language switching affects interface text only. Product names and product descriptions are not automatically translated by interface language selection.

## Main entities

- Customer
- City curator
- Administrator
- Super administrator
- City
- Local point
- InPost warehouse
- Category
- Product request
- Product
- Product variant
- Inventory
- Cart
- Cart item
- Order

## Product lifecycle

A curator selects a source and fills a complete product request.

For a local source:

1. select Local;
2. select city;
3. select one local point.

For InPost:

1. select InPost warehouse.

The curator then provides category, product data, price, media, optional variants and inventory.

The administrator reviews the request. Approval publishes the product immediately to the selected catalog. Rejection returns the request to the curator for correction or deletion.

## Long-term goal

The platform should scale to additional cities, points, categories, roles, integrations and fulfillment methods without replacing the fundamental architecture.

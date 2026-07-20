# 00 — Project Rules

**Version:** 1.0.0  
**Status:** Approved

## Purpose

This document defines mandatory rules for developers and AI agents working on the project.

## Documentation first

Before implementation:

1. Read the relevant documentation.
2. Inspect the current code and architecture.
3. Identify existing models, services, APIs, state and tests.
4. Compare the implementation with the documented behavior.
5. Provide a plan before changing code.

## Minimal safe changes

Prefer the smallest solution that correctly implements the requirement.

Do not:

- rewrite working architecture without necessity;
- duplicate services or business logic;
- replace established project conventions for personal preference;
- create an alternative subsystem beside an existing one.

## Business rules

Approved business logic must not be simplified or changed for implementation convenience.

When code and documentation conflict, report the conflict and bring them into alignment.

## Backend as source of truth

Backend must enforce:

- authentication and authorization;
- data ownership and scope;
- product-source membership;
- current prices;
- inventory;
- cart validity;
- checkout validity;
- moderation permissions.

Frontend restrictions are UX only and are never sufficient security controls.

## Data and migrations

Schema changes require:

- justification;
- impact analysis;
- safe migration;
- preservation of existing data whenever possible;
- rollback or recovery consideration.

## API

Reuse or safely extend existing endpoints before creating new ones.

API behavior must be predictable, validated and consistently error-handled.

## Code quality

New code must be:

- typed where the stack supports it;
- readable and testable;
- consistent with project conventions;
- free of duplicated critical logic;
- free of temporary placeholders in production paths.

## Errors

Errors must be handled without crashing the application. User-facing errors must be understandable, while technical details should be logged safely.

## Testing

Every business change should cover:

- success scenarios;
- permission failures;
- invalid data;
- boundary conditions;
- regression risk.

## Documentation synchronization

Any change to behavior, API, data, permissions, navigation or statuses must update the corresponding documentation in the same task.

## Definition of Done

A change is complete only when behavior, permissions, validation, errors, tests and documentation are all aligned.

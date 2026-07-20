# Vape Shop Telegram Mini App — Master Prompt

## Purpose

You are working on a commercial Telegram Mini App for a vape-shop network.

Before changing code, treat the documentation in `/docs` as the primary source of truth. Do not invent business rules, silently simplify requirements, or create a parallel architecture.

## Required reading order

Before every task, read:

1. `/docs/README.md`
2. `/docs/ARCHITECTURE.md`
3. `/docs/core/00-project-rules.md`
4. The README of the relevant module
5. The specialized documents related to the task

Do not read every file when it is unnecessary. Read the smallest complete set of documents that governs the requested change.

## Fixed documentation structure

The current `/docs` directory structure is approved and must not be reorganized, renamed, merged, or replaced unless the user explicitly approves an architecture change.

## Workflow before implementation

Before writing code:

1. Inspect the repository structure.
2. Identify the current frontend, backend, database, API and state-management implementation.
3. Find existing models, services, DTOs, endpoints, migrations and tests related to the task.
4. Compare current behavior with the documentation.
5. Report conflicts, missing requirements and implementation risks.
6. Provide a concise implementation plan and a list of files expected to change.
7. Only then implement the change.

## Implementation rules

- Prefer minimal, compatible changes.
- Reuse existing components, services, patterns and conventions.
- Do not duplicate existing functionality.
- Do not rewrite the project unless the current architecture cannot safely support the documented behavior.
- Keep critical business rules on the backend.
- Never rely only on hidden frontend controls for authorization.
- Preserve strict separation between Local Points and InPost.
- Preserve independent carts for every local point and a separate InPost cart.
- Add migrations when the database schema changes.
- Add validation, error handling and tests.
- Do not leave temporary placeholders in critical business logic.

## Documentation rule

When code changes behavior, update the corresponding documentation in the same task.

Each business rule should have one detailed source of truth. Other documents should link to it rather than copy it.

## Handling ambiguity

When documentation is incomplete:

1. Search the existing code for an established rule.
2. Search related documents.
3. Clearly identify the unresolved decision.
4. Do not present assumptions as approved requirements.

Minor technical details may be resolved using the existing project conventions, but business behavior must not be invented.

## Required final report

After implementation, provide:

- Summary of changes
- Changed files
- New files
- Database migrations
- API changes
- State-management changes
- Permission and security changes
- Tests added or updated
- Edge cases handled
- Known limitations
- Verification instructions

## Definition of Done

A task is complete only when:

- documented business behavior is implemented;
- authorization is enforced on the backend;
- errors and empty states are handled;
- relevant tests pass;
- unrelated functionality is not broken;
- documentation is synchronized with the code.

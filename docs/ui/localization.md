# Localization

**Version:** 1.1.0  
**Status:** Approved

## Purpose

This document defines localization rules for the Telegram Mini App frontend and admin UI.

The full user interface must be translatable. Product content is business data and must not be automatically translated as interface text.

## Scope

In scope:

- frontend UI localization;
- admin UI localization;
- frontend language selection;
- backend user profile language persistence;
- translation file structure;
- status, role, source and error-code labels;
- automated checks against hardcoded UI text.

Out of scope:

- automatic translation of product content;
- external translation management systems;
- adding full English, Polish or Ukrainian UI translations in the first slice.

## Related documents

- `docs/MASTER_PROMPT.md`
- `docs/core/00-project-rules.md`
- `docs/backend/error-handling.md`
- `docs/ui/design-system.md`
- `docs/ui/navigation.md`
- `docs/admin/product-requests.md`
- `docs/products/product-model.md`

## Supported language codes

Backend profile may store these language codes:

- `ru` - Russian;
- `en` - English;
- `pl` - Polish;
- `uk` - Ukrainian.

Active frontend dictionaries in the first implementation slice:

- `ru` only.

Fallback language:

- `ru`.

If backend or Telegram provides `en`, `pl` or `uk` before those dictionaries are available, the frontend must render the Russian dictionary and visually treat `ru` as the active UI language.

## Language source priority

Frontend language preference is resolved in this order:

1. `user.language_code` returned by backend profile/auth APIs.
2. Local storage fallback from the current device.
3. Telegram WebApp `initDataUnsafe.user.language_code`.
4. Fallback `ru`.

The active dictionary is then resolved from the preference:

1. If the preferred language has a frontend dictionary, use it.
2. Otherwise use `ru`.

When a user changes language in Profile:

1. Frontend immediately updates the visible UI if the selected language is active.
2. Frontend saves the selected code to local storage.
3. Frontend sends the selected code to the backend profile endpoint.
4. Backend persists `user.language_code`.

In the first implementation slice, Profile must show `RU`, `EN`, `PL` and `UK`, but only `RU` is enabled. `EN`, `PL` and `UK` are visible disabled options.

## Translation technology

Frontend must use a lightweight project-owned i18n layer without adding a third-party i18n dependency.

The translation API should expose a hook or equivalent helper:

```ts
t("cart.empty.title")
```

Translation dictionaries must be TypeScript namespace objects. The first implementation slice must include a complete Russian dictionary. Future dictionaries can be added without changing component call sites.

Suggested structure:

```text
frontend/src/i18n/index.ts
frontend/src/i18n/locales/ru.ts
```

Suggested namespaces:

- `common`;
- `nav`;
- `home`;
- `catalog`;
- `cart`;
- `checkout`;
- `profile`;
- `admin`;
- `errors`;
- `validation`.

Missing translation keys must render the key itself. Example: missing `cart.empty.title` renders `cart.empty.title`.

## What must be translated

All visible interface text must be moved to translation keys:

- navigation labels;
- page titles;
- tabs;
- buttons;
- form labels;
- placeholders;
- helper text;
- empty states;
- loading states;
- error messages;
- confirmation dialogs;
- status labels;
- role labels;
- source labels;
- admin UI text;
- product request UI text;
- staff/settings UI text.

The first implementation slice includes both:

- customer Mini App UI;
- admin panel UI.

## What must not be auto-translated

The following are content data and must not be translated through UI localization:

- product names;
- product descriptions;
- variant names;
- variant descriptions;
- category names when they are stored as catalog content;
- curator/admin comments;
- rejection comments;
- customer-entered names, addresses, emails and comments.

If product content is stored in multiple language-specific fields, frontend may choose which stored field to display. It must not generate translations on its own.

## Technical labels

Backend should return technical values and frontend should translate labels.

Examples:

- product request statuses: `pending_review`, `need_changes`, `approved`, `rejected`, `cancelled`;
- roles: `admin`, `city_curator`, `point_manager`;
- sources: `LOCAL`, `INPOST`;
- product state: `active`, `inactive`;
- variant state: `active`, `inactive`;
- order statuses: `new`, `confirmed`, `ready`, `completed`, `cancelled`.

Frontend displays translated labels through i18n keys.

## Backend errors

Backend API errors must use the global error envelope defined in `docs/backend/error-handling.md`.

Frontend error handling rules:

1. If `code` exists and a translation exists, show the translated message.
2. If `code` is unknown, show the generic localized fallback.
3. If the response is a legacy FastAPI text-only error, show the generic localized fallback unless the current compatibility layer explicitly maps it.
4. Do not show backend `message` as primary user-facing UI copy.

`message` is an English developer fallback for debugging, not the localized UI string.

## Frontend i18n migration rules

The frontend i18n migration must:

- migrate all current visible UI strings to translation keys;
- provide a complete `ru` dictionary;
- avoid adding new hardcoded UI text;
- keep product content as data;
- keep technical constants, route paths, CSS classes and test ids out of translation files;
- keep the existing visual design and existing Profile language selector surface.

Existing hardcoded UI strings must be removed from:

- pages;
- admin pages;
- shared components;
- navigation helpers;
- stores only when they contain user-facing messages;
- API clients only when they construct user-facing fallback errors.

## Automated checks

The project must include a lightweight static check for hardcoded UI strings in `frontend/src`.

Rules:

- The check is exposed as a separate npm script in the first implementation slice.
- The check is not part of the default `npm test` workflow initially.
- It should flag obvious visible hardcoded strings in JSX/TSX.
- It may use a pragmatic whitelist for technical strings.

The check must exclude or allowlist:

- translation dictionaries;
- route paths;
- CSS class names;
- icon names;
- API paths;
- test ids;
- intentional product/content data;
- comments if the implementation cannot safely distinguish comments from UI strings.

## Backend profile language requirements

Backend must persist a user profile language code.

Rules:

- accepted values: `ru`, `en`, `pl`, `uk`;
- invalid values return the standardized validation error envelope;
- backend must not localize UI copy;
- frontend remains responsible for rendering the active dictionary.

## Edge cases

- User language is unsupported: fallback to `ru`.
- Backend stores `en`, `pl` or `uk` before dictionaries exist: UI renders `ru`, Profile selected state shows `RU`, and future languages remain disabled.
- Backend user profile loads after initial render: UI may initially render fallback language, then resolve from profile.
- Translation key is missing: render the key itself.
- Product content has only one language field: display the stored content as-is.
- Backend returns unknown error code: frontend shows a generic localized error.

## Test plan

Frontend tests/checks:

- i18n initializes with fallback `ru`;
- backend profile language overrides local storage and Telegram language;
- local storage is used before backend profile is available;
- Profile shows `RU`, `EN`, `PL`, `UK`;
- only `RU` is enabled in the first implementation slice;
- representative customer and admin pages render Russian translation values;
- known backend `code` values map to localized messages;
- unknown backend `code` values render a generic localized error;
- hardcoded string npm script flags obvious UI strings outside translation dictionaries.

Backend tests:

- user profile accepts `ru`, `en`, `pl`, `uk`;
- user profile rejects invalid language codes with standardized validation envelope;
- profile language is persisted and returned.

Manual verification:

- open Mini App through Telegram;
- verify navigation, Profile, Cart, Checkout and Admin UI labels are Russian;
- verify `EN`, `PL`, `UK` are visible but disabled in Profile;
- verify product names/descriptions are not auto-translated;
- verify backend validation/API errors render user-facing Russian messages from frontend translations.

## Definition of Done

Localization is complete when:

- frontend uses the project-owned `t("namespace.key")` i18n layer;
- all visible customer and admin frontend UI strings are moved to translation keys;
- `ru` is the complete active dictionary;
- Profile language selector shows `RU`, `EN`, `PL`, `UK` with only `RU` enabled;
- backend persists `language_code` and accepts `ru`, `en`, `pl`, `uk`;
- backend error envelopes are translated in frontend through `code`;
- product content remains untranslated by UI i18n;
- automated hardcoded-text check exists as a separate npm script;
- build and relevant backend/frontend tests pass.

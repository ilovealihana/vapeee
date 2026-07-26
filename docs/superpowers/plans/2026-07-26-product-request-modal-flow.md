# Product Request Modal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move product request creation and review verdict controls into modals so the admin request page stays usable on smartphone screens.

**Architecture:** Keep the backend unchanged. Update `AdminProductRequests.tsx` state and rendering so point managers open a create modal, and reviewers open a review modal after locking a request. Preserve the existing API client and action helper, and add static/frontend tests that prevent row-level verdict controls and always-visible create forms from returning.

**Tech Stack:** React, Vite, TypeScript, node:test, existing admin CMS components.

---

## Files

Modify:

- `frontend/src/pages/admin/AdminProductRequests.tsx` - create modal state, review modal state, release-on-close flow, row action placement.
- `frontend/tests/adminCms.test.mjs` - static contract tests for modal flow.
- `frontend/src/i18n/locales/ru.ts` - add any missing modal/action labels if current keys are insufficient.

No backend files, migrations or API schemas should change.

## Task 1: Static Contract Tests

**Files:**
- Modify: `frontend/tests/adminCms.test.mjs`

- [ ] Add static assertions to `admin product requests page is routed and uses cms/i18n patterns`.

Add these assertions near the existing `AdminProductRequests` checks:

```js
assert.match(productRequestsSource, /const \[creating,\s*setCreating\] = useState\(false\)/);
assert.match(productRequestsSource, /const \[reviewing,\s*setReviewing\] = useState<AdminProductRequest \| null>\(null\)/);
assert.match(productRequestsSource, /openCreateModal/);
assert.match(productRequestsSource, /closeReviewModal/);
assert.match(productRequestsSource, /adminApi\.releaseProductRequest\(reviewing\.id\)/);
assert.match(productRequestsSource, /setReviewing\(locked\)/);
assert.match(productRequestsSource, /t\('admin\.productRequests\.openCreate'\)/);
assert.match(productRequestsSource, /t\('admin\.productRequests\.reviewTitle'\)/);
```

- [ ] Add a dedicated static test proving row verdict controls are not rendered inline.

Add:

```js
test('admin product request page keeps create and verdict actions in modals', () => {
  assert.match(productRequestsSource, /creating && \(/);
  assert.match(productRequestsSource, /reviewing && \(/);
  assert.match(productRequestsSource, /className="admin-request-review-actions"/);
  assert.doesNotMatch(productRequestsSource, /\{canCreate && \(\s*<div className="admin-cms-section">/);
  assert.doesNotMatch(productRequestsSource, /actions\.canApprove[\s\S]{0,400}<button className="admin-icon-button"/);
  assert.doesNotMatch(productRequestsSource, /actions\.canReject[\s\S]{0,400}<button className="admin-icon-button"/);
  assert.doesNotMatch(productRequestsSource, /actions\.canRequestChanges[\s\S]{0,400}<button className="admin-icon-button"/);
});
```

- [ ] Run frontend tests and confirm they fail.

Run from `frontend/`:

```powershell
npm test -- tests/adminCms.test.mjs
```

Expected before implementation: FAIL because create/review modal state and `closeReviewModal` do not exist.

## Task 2: Create Modal

**Files:**
- Modify: `frontend/src/pages/admin/AdminProductRequests.tsx`
- Modify: `frontend/src/i18n/locales/ru.ts` if `admin.productRequests.openCreate` is missing.

- [ ] Add create modal state.

In `AdminProductRequests`, add:

```ts
const [creating, setCreating] = useState(false);
```

- [ ] Add open/close helpers.

Add:

```ts
const openCreateModal = () => {
  setError('');
  setSuccess('');
  setCreating(true);
};

const closeCreateModal = () => {
  setCreating(false);
};
```

- [ ] Update successful submit behavior.

In `submit`, after successful `adminApi.createProductRequest(payload)` and form reset, add:

```ts
setCreating(false);
```

Keep failed create behavior unchanged so the modal remains open and displays `error`.

- [ ] Replace the always-visible create section.

Replace the current `{canCreate && (<div className="admin-cms-section">...` block with:

```tsx
{canCreate && (
  <div className="admin-page-actions">
    <button className="admin-button admin-button-primary" type="button" onClick={openCreateModal}>
      <Icon name="plus" size={16} /> {t('admin.productRequests.openCreate')}
    </button>
  </div>
)}
```

- [ ] Render the existing create form inside `AdminModal`.

Move the same form markup into:

```tsx
{creating && (
  <AdminModal
    title={t('admin.productRequests.newTitle')}
    subtitle={t('admin.productRequests.newSubtitle')}
    onClose={closeCreateModal}
    footer={(
      <>
        <button className="admin-button admin-button-secondary" type="button" onClick={closeCreateModal}>{t('admin.common.cancel')}</button>
        <button className="admin-button admin-button-primary" type="button" disabled={!canSubmit || saving} onClick={submit}>
          <Icon name="plus" size={16} /> {saving ? t('admin.productRequests.saving') : t('admin.productRequests.create')}
        </button>
      </>
    )}
  >
    <div className="admin-form-grid">
      {/* existing create fields */}
    </div>
  </AdminModal>
)}
```

- [ ] Add missing i18n key if needed.

In `frontend/src/i18n/locales/ru.ts`, under `admin.productRequests`, add:

```ts
openCreate: 'Создать заявку',
```

Use the existing `create`, `newTitle`, and `newSubtitle` keys if already present.

- [ ] Run frontend tests.

Run from `frontend/`:

```powershell
npm test -- tests/adminCms.test.mjs
```

Expected after this task: tests may still fail on review modal assertions until Task 3 is implemented.

## Task 3: Review Modal and Release-On-Close

**Files:**
- Modify: `frontend/src/pages/admin/AdminProductRequests.tsx`
- Modify: `frontend/src/i18n/locales/ru.ts` if review modal keys are missing.

- [ ] Add review modal state.

Add:

```ts
const [reviewing, setReviewing] = useState<AdminProductRequest | null>(null);
const [reviewCloseError, setReviewCloseError] = useState('');
```

- [ ] Add helper to refresh a request from the list.

Add:

```ts
const findRequest = (requestId: number, fallback: AdminProductRequest) =>
  requests.find((request) => request.id === requestId) || fallback;
```

- [ ] Update lock and takeover row actions to open review modal.

Where the row currently calls `runAction(request, 'lock', () => adminApi.lockProductRequest(request.id), ...)`, replace with a dedicated function:

```ts
const lockForReview = async (request: AdminProductRequest, action = 'lock') => {
  setPendingActionId(`${request.id}:${action}`);
  setError('');
  setSuccess('');
  try {
    const locked = await adminApi.lockProductRequest(request.id);
    setReviewCloseError('');
    setReviewing(locked || findRequest(request.id, request));
    await load();
  } catch (e: any) {
    setError(e.message);
  }
  setPendingActionId(null);
};
```

Use `lockForReview(request, 'lock')` for take-review and `lockForReview(request, 'takeover')` for project-admin takeover.

- [ ] Add `closeReviewModal`.

Add:

```ts
const closeReviewModal = async () => {
  if (!reviewing) return;
  setReviewCloseError('');
  setPendingActionId(`${reviewing.id}:release`);
  try {
    await adminApi.releaseProductRequest(reviewing.id);
    setReviewing(null);
    await load();
  } catch (e: any) {
    setReviewCloseError(e.message);
  }
  setPendingActionId(null);
};
```

This function intentionally keeps the modal open when release fails.

- [ ] Update verdict success behavior.

After approve, reject, or request changes succeeds:

```ts
setReviewing(null);
```

Keep existing list reload and comment reset behavior.

- [ ] Keep only row-safe actions in each request row.

Rows may show:

- lock;
- takeover;
- edit;
- lock state text.

Rows must not show approve, reject, request-changes, or release buttons.

- [ ] Render review modal.

Add:

```tsx
{reviewing && (
  <AdminModal
    title={t('admin.productRequests.reviewTitle')}
    subtitle={reviewing.product_name || t('admin.productRequests.productFallback')}
    onClose={closeReviewModal}
    footer={(
      <div className="admin-request-review-actions">
        <button className="admin-button admin-button-primary" type="button" disabled={pendingActionId === `${reviewing.id}:approve`} onClick={() => approve(reviewing)}>
          <Icon name="check" size={16} /> {t('admin.productRequests.approve')}
        </button>
        <button className="admin-button admin-button-secondary" type="button" onClick={() => setRequestingChanges(reviewing)}>
          {t('admin.productRequests.needChanges')}
        </button>
        <button className="admin-button admin-button-danger" type="button" onClick={() => setRejecting(reviewing)}>
          <Icon name="x" size={16} /> {t('admin.productRequests.reject')}
        </button>
        <button className="admin-button admin-button-secondary" type="button" disabled={pendingActionId === `${reviewing.id}:release`} onClick={closeReviewModal}>
          {t('admin.productRequests.release')}
        </button>
      </div>
    )}
  >
    {reviewCloseError && <p className="admin-message admin-message-error">{reviewCloseError}</p>}
    <div className="admin-request-review-details">
      <p><strong>{t('admin.productRequests.fields.location')}</strong><span>{reviewing.location_name || t('admin.productRequests.locationFallback')}</span></p>
      <p><strong>{t('admin.productRequests.fields.type')}</strong><span>{requestTypeLabel(reviewing.request_type)}</span></p>
      <p><strong>{t('admin.productRequests.fields.variant')}</strong><span>{reviewing.variant_name || reviewing.variant_name_ru || t('admin.productRequests.variantFallback')}</span></p>
      <p><strong>{t('admin.productRequests.fields.quantity')}</strong><span>{String(reviewing.quantity)}</span></p>
      {reviewing.review_comment && <p><strong>{t('admin.productRequests.fields.lastComment')}</strong><span>{reviewing.review_comment}</span></p>}
    </div>
  </AdminModal>
)}
```

If `approve`, `needChanges`, `reject`, `release`, `reviewTitle`, or `fields.lastComment` keys are missing, add them to `ru.ts`.

- [ ] Add CSS only if the existing modal footer layout is cramped.

If needed, add to `frontend/src/index.css`:

```css
.admin-request-review-actions {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.admin-request-review-details {
  display: grid;
  gap: 10px;
}

.admin-request-review-details p {
  display: grid;
  gap: 4px;
  margin: 0;
}

.admin-request-review-details span {
  color: var(--secondary);
  overflow-wrap: anywhere;
}

@media (max-width: 420px) {
  .admin-request-review-actions {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] Run frontend tests.

Run from `frontend/`:

```powershell
npm test -- tests/adminCms.test.mjs
```

Expected after this task: PASS.

## Task 4: Full Verification and Review

**Files:**
- Modify only files changed by Tasks 1-3.

- [ ] Run frontend verification.

Run from `frontend/`:

```powershell
npm test
npm run check:ui-strings
npm run build
```

Expected: all PASS.

- [ ] Run repository whitespace check.

Run from repo root:

```powershell
git diff --check
```

Expected: no whitespace errors; CRLF warnings are acceptable.

- [ ] Check git status.

Run from repo root:

```powershell
git status --short
```

Expected: only intended frontend/spec/plan files are changed.

- [ ] Request subagent review.

Review focus:

- create form is not always visible;
- review verdict buttons are not row-level on mobile;
- any review modal close releases lock;
- release failure keeps modal open;
- no backend/API changes were introduced.

- [ ] Fix reviewer findings and rerun affected checks.

Expected: no P1/P2 findings remain.

- [ ] Commit implementation.

Run from repo root:

```powershell
git add frontend/src/pages/admin/AdminProductRequests.tsx frontend/src/i18n/locales/ru.ts frontend/src/index.css frontend/tests/adminCms.test.mjs docs/superpowers/plans/2026-07-26-product-request-modal-flow.md
git commit -m "Move product request actions into modals"
```

## Task 5: Push and Deploy

**Files:**
- No source changes.

- [ ] Push `main`.

Run:

```powershell
git push origin main
```

- [ ] Deploy frontend only.

Backend did not change.

Run from `frontend/`:

```powershell
vercel deploy --prod --scope team_JYm3nRKRyxalcSjDepIQDMgy --yes
vercel alias set <new-deployment-host>.vercel.app frontend-vapebot.vercel.app --scope team_JYm3nRKRyxalcSjDepIQDMgy
```

- [ ] Verify clean status.

Run from repo root:

```powershell
git status --short --branch
```

Expected: `main...origin/main` and no changed files.

## Acceptance Criteria

- Point manager sees a compact "create request" action instead of the full create form.
- Create request form opens in a modal.
- Failed create keeps the modal open and shows the error.
- Successful create closes modal and reloads list.
- Reviewer row actions fit on smartphone width.
- Taking a request for review opens a review modal.
- Approve, request changes, reject and release are in the review modal.
- Any review modal close path releases the lock before closing.
- Failed release keeps the review modal open and shows an error.
- Backend behavior and schemas are unchanged.

## Rollback

Rollback is frontend-only:

```powershell
git revert <modal-flow-commit>
git push origin main
```

No Alembic downgrade or Railway deployment is required.

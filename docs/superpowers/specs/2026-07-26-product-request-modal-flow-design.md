# Product Request Modal Flow Design

## Goal

Fix mobile usability issues in the product request admin page by moving review verdict actions into a dedicated review modal and moving point-manager request creation into a create modal. The change is frontend-focused and must preserve the current backend review-loop behavior.

## Scope

In scope:

- replace the always-visible point-manager create form with a "create request" button;
- open the existing create form inside an admin modal;
- after successful create, close the modal, reset the form and reload the list;
- move approve, request changes, reject and release actions out of the request row into a review modal;
- keep the row compact on mobile;
- after taking a request for review, open the review modal;
- any review modal close attempt releases the lock first;
- if release fails during close, keep the modal open and show the error;
- keep edit and existing reject/request-changes modals as needed, but reachable from the review modal;
- add frontend tests for modal flow and action placement.

Out of scope:

- backend schema changes;
- database migrations;
- changing lock ownership rules;
- changing status transitions;
- sending Telegram notifications;
- adding a separate request detail route.

## Review Modal Behavior

Rows should show compact request information and only row-safe actions:

- free `pending_review`: show take-review action for eligible reviewers;
- `need_changes`: show edit action for eligible editors;
- locked by another reviewer: show lock state and project-admin takeover action if allowed;
- final statuses: no lifecycle actions.

When the user clicks take-review:

1. call `adminApi.lockProductRequest(request.id)`;
2. reload or use the returned locked request;
3. open a review modal for that request;
4. show request details and verdict actions inside the modal.

Review modal actions:

- approve;
- request changes;
- reject;
- release.

Closing the review modal:

- clicking overlay, close button, or release action must call `adminApi.releaseProductRequest(request.id)`;
- on success, close the modal and reload the list;
- on failure, keep the modal open and show the error.

After approve, reject or request changes succeeds:

- close the review modal;
- clear related comment state;
- reload the list.

Project-admin takeover may continue to be a row action. If takeover succeeds, it should open the review modal in the same way as take-review.

## Create Modal Behavior

For `point_manager`, the product request page should show a compact create button rather than the full form.

When clicked:

- open a create modal;
- render the existing create fields in the modal;
- keep current validation and backend error handling;
- after successful create, close the modal, reset the form and reload the list;
- if create fails, keep the modal open and show the error.

Non-point-manager roles should not see the create button.

## Frontend Testing

Static/frontend tests should cover:

- page has create modal state and no always-visible create section;
- page opens create modal through a create button;
- page has review modal state;
- lock success opens review modal;
- review modal close path calls release;
- release failure keeps modal state;
- approve, reject and request-changes actions are rendered in review modal rather than row;
- mobile request row remains compact and readable.

## Rollback

Rollback is frontend-only: revert the modal-flow commit. No migration or backend rollback is required.

import type { AdminProductRequest, AdminStaffRole } from '../../api/admin';

export type ProductRequestActionState = {
  canLock: boolean;
  canTakeover: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRequestChanges: boolean;
  canRelease: boolean;
  canEdit: boolean;
};

export function getProductRequestActions({
  role,
  currentTgId,
  request,
  isOwnEditableRequest,
}: {
  role: AdminStaffRole | undefined;
  currentTgId: number | undefined;
  request: AdminProductRequest;
  isOwnEditableRequest: boolean;
}): ProductRequestActionState {
  const isReviewer = role === 'project_admin' || role === 'city_curator';
  const isProjectAdmin = role === 'project_admin';
  const isPending = request.status === 'pending_review';
  const isNeedChanges = request.status === 'need_changes';
  const isFinal = request.status === 'approved' || request.status === 'rejected';
  const lockOwner = request.locked_by_tg_id;
  const hasLock = lockOwner !== undefined && lockOwner !== null;
  const ownsLock = hasLock && currentTgId !== undefined && lockOwner === currentTgId;
  const lockedByAnother = hasLock && !ownsLock;

  if (isFinal) {
    return {
      canLock: false,
      canTakeover: false,
      canApprove: false,
      canReject: false,
      canRequestChanges: false,
      canRelease: false,
      canEdit: false,
    };
  }

  return {
    canLock: isReviewer && isPending && !hasLock,
    canTakeover: isProjectAdmin && isPending && lockedByAnother,
    canApprove: isReviewer && isPending && ownsLock,
    canReject: isReviewer && isPending && ownsLock,
    canRequestChanges: isReviewer && isPending && ownsLock,
    canRelease: isPending && (ownsLock || (isProjectAdmin && hasLock)),
    canEdit: isNeedChanges && isOwnEditableRequest && !hasLock,
  };
}

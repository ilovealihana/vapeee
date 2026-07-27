import { useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  type AdminProductRequest,
  type AdminStaffRole,
  type ProductRequestOptions,
  type ProductRequestPayload,
  type ProductRequestSourceType,
  type ProductRequestStatus,
  type ProductRequestType,
  type ProductRequestUpdatePayload,
} from '../../api/admin';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';
import { AdminEmptyState, AdminModal, AdminPageHeader, AdminStatusBadge } from './AdminUI';
import { getProductRequestActions } from './productRequestActions';

type FormState = {
  source_type: ProductRequestSourceType;
  request_type: ProductRequestType;
  location_id: string;
  product_id: string;
  variant_id: string;
  variant_name: string;
  price_override: string;
  quantity: string;
};

type EditFormState = {
  variant_name_ru: string;
  variant_name_pl: string;
  variant_name_uk: string;
  price_override: string;
  quantity: string;
};

type RequestMode = 'active' | 'archive';
type ActiveFilter = 'all' | 'pending_review' | 'need_changes';
type ArchiveFilter = 'all' | 'approved' | 'rejected';
type SourceFilter = 'all' | 'local_point' | 'inpost';

const initialForm: FormState = {
  source_type: 'local_point',
  request_type: 'ADD_VARIANT',
  location_id: '',
  product_id: '',
  variant_id: '',
  variant_name: '',
  price_override: '',
  quantity: '1',
};

function editFormFromRequest(request: AdminProductRequest): EditFormState {
  const fallbackName = request.variant_name || request.variant_name_ru || '';
  return {
    variant_name_ru: request.variant_name_ru || fallbackName,
    variant_name_pl: request.variant_name_pl || fallbackName,
    variant_name_uk: request.variant_name_uk || fallbackName,
    price_override: request.price_override || '',
    quantity: String(request.quantity || 1),
  };
}

export default function AdminProductRequests() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const user = useUserStore((state) => state.user);
  const { t } = useI18n(activeLocale);
  const [adminRole, setAdminRole] = useState<AdminStaffRole | undefined>();
  const [requests, setRequests] = useState<AdminProductRequest[]>([]);
  const [options, setOptions] = useState<ProductRequestOptions>({ sources: [], locations: [], products: [] });
  const [form, setForm] = useState<FormState>(initialForm);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<RequestMode>('active');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejecting, setRejecting] = useState<AdminProductRequest | null>(null);
  const [requestingChanges, setRequestingChanges] = useState<AdminProductRequest | null>(null);
  const [reviewing, setReviewing] = useState<AdminProductRequest | null>(null);
  const [reviewCloseError, setReviewCloseError] = useState('');
  const [editing, setEditing] = useState<AdminProductRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [changesComment, setChangesComment] = useState('');
  const [editForm, setEditForm] = useState<EditFormState | null>(null);

  const selectedStatus: ProductRequestStatus | undefined = mode === 'active'
    ? (activeFilter === 'all' ? undefined : activeFilter)
    : (archiveFilter === 'all' ? undefined : archiveFilter);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [access, nextRequests, nextOptions] = await Promise.all([
        adminApi.getAccess(),
        adminApi.getProductRequests({ mode, status: selectedStatus, source: sourceFilter }),
        adminApi.getProductRequestOptions(),
      ]);
      setAdminRole(access.role);
      setRequests(nextRequests);
      setOptions(nextOptions);
      setForm((current) => {
        const nextSource = nextOptions.sources.some((source) => source.source_type === current.source_type)
          ? current.source_type
          : (nextOptions.sources[0]?.source_type ?? 'local_point');
        return {
          ...current,
          source_type: nextSource,
          location_id: nextSource === 'inpost'
            ? ''
            : (current.location_id || String(nextOptions.locations[0]?.id ?? '')),
          product_id: current.product_id || String(nextOptions.products[0]?.id ?? ''),
        };
      });
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [mode, selectedStatus, sourceFilter]);

  const selectedProduct = useMemo(
    () => options.products.find((product) => product.id === Number(form.product_id)),
    [form.product_id, options.products],
  );
  const selectedVariants = selectedProduct?.variants ?? [];
  const currentTgId = user?.tg_id;
  const sourceCounts = useMemo(() => ({
    all: requests.length,
    inpost: requests.filter((request) => request.source_type === 'inpost').length,
    local_point: requests.filter((request) => request.source_type === 'local_point').length,
  }), [requests]);

  useEffect(() => {
    if (form.request_type !== 'ADD_STOCK') return;
    if (form.variant_id || selectedVariants.length === 0) return;
    setForm((current) => ({ ...current, variant_id: String(selectedVariants[0].id) }));
  }, [form.request_type, form.variant_id, selectedVariants]);

  const requestTypeLabel = (type: ProductRequestType) => t(`admin.productRequests.types.${type}`);
  const statusLabel = (status: string) => t(`admin.productRequests.status.${status}`);
  const sourceLabel = (sourceType: ProductRequestSourceType) => t(`admin.productRequests.sourceLabels.${sourceType === 'inpost' ? 'inpost' : 'localPoint'}`);
  const targetLabel = (request: AdminProductRequest) => request.source_type === 'inpost'
    ? t('admin.productRequests.sourceLabels.inpost')
    : `${request.city_name || t('admin.productRequests.cityFallback')} - ${request.location_name || t('admin.productRequests.locationFallback')}`;
  const canCreate = options.sources.length > 0;
  const canReview = adminRole === 'project_admin' || adminRole === 'city_curator';
  const isEditableRequest = (request: AdminProductRequest) => (
    adminRole === 'project_admin'
    || (request.source_type === 'inpost' && adminRole === 'inpost_curator')
    || (request.source_type !== 'inpost' && (adminRole === 'city_curator' || request.requester_tg_id === currentTgId))
  );
  const reviewingOwnEditable = Boolean(reviewing) && (
    reviewing ? isEditableRequest(reviewing) : false
  );
  const reviewActions = reviewing
    ? getProductRequestActions({ role: adminRole, currentTgId, request: reviewing, isOwnEditableRequest: reviewingOwnEditable })
    : null;
  const isReviewVerdictPending = Boolean(
    reviewing
    && (
      pendingActionId === `${reviewing.id}:approve`
      || pendingActionId === `${reviewing.id}:reject`
      || pendingActionId === `${reviewing.id}:need_changes`
    ),
  );

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'source_type' && value === 'inpost' ? { location_id: '' } : {}),
      ...(key === 'source_type' && value === 'local_point' ? { location_id: current.location_id || String(options.locations[0]?.id ?? '') } : {}),
      ...(key === 'product_id' ? { variant_id: '' } : {}),
    }));
  };

  const runAction = async (request: AdminProductRequest, action: string, call: () => Promise<unknown>, messageKey: string) => {
    setPendingActionId(`${request.id}:${action}`);
    setError('');
    setSuccess('');
    try {
      await call();
      setSuccess(t(messageKey));
      await load();
      setPendingActionId(null);
      return true;
    } catch (e: any) {
      setError(e.message);
      setPendingActionId(null);
      return false;
    }
  };

  const openCreateModal = () => {
    setError('');
    setSuccess('');
    setCreating(true);
  };

  const closeCreateModal = () => {
    setCreating(false);
  };

  const findRequest = (requestId: number, fallback: AdminProductRequest) =>
    requests.find((request) => request.id === requestId) || fallback;

  const lockForReview = async (request: AdminProductRequest, action = 'lock') => {
    setPendingActionId(`${request.id}:${action}`);
    setError('');
    setSuccess('');
    try {
      const locked = await adminApi.lockProductRequest(request.id);
      setReviewCloseError('');
      setReviewing(locked);
      setReviewing((current) => current || findRequest(request.id, request));
      await load();
    } catch (e: any) {
      setError(e.message);
    }
    setPendingActionId(null);
  };

  const closeReviewModal = async () => {
    if (!reviewing) return;
    if (isReviewVerdictPending) return;
    if (pendingActionId === `${reviewing.id}:release`) return;
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

  const submit = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    const payload: ProductRequestPayload = {
      source_type: form.source_type,
      request_type: form.request_type,
      location_id: form.source_type === 'inpost' ? null : Number(form.location_id),
      product_id: Number(form.product_id),
      quantity: Math.max(1, Number(form.quantity) || 1),
    };
    if (form.request_type === 'ADD_VARIANT') {
      payload.variant_name_ru = form.variant_name.trim();
      payload.variant_name_pl = form.variant_name.trim();
      payload.variant_name_uk = form.variant_name.trim();
      if (form.price_override.trim()) payload.price_override = form.price_override.trim();
    } else {
      payload.variant_id = Number(form.variant_id);
    }

    try {
      await adminApi.createProductRequest(payload);
      setForm((current) => ({
        ...initialForm,
        source_type: current.source_type,
        location_id: current.source_type === 'inpost' ? '' : current.location_id,
        product_id: current.product_id,
      }));
      setCreating(false);
      setSuccess(t('admin.productRequests.created'));
      await load();
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const reject = async () => {
    if (!rejecting || !rejectReason.trim()) return;
    const ok = await runAction(
      rejecting,
      'reject',
      () => adminApi.rejectProductRequest(rejecting.id, rejectReason.trim()),
      'admin.productRequests.rejected',
    );
    if (!ok) return;
    setReviewing(null);
    setRejecting(null);
    setRejectReason('');
  };

  const requestChanges = async () => {
    if (!requestingChanges || !changesComment.trim()) return;
    const ok = await runAction(
      requestingChanges,
      'need_changes',
      () => adminApi.needChangesProductRequest(requestingChanges.id, changesComment.trim()),
      'admin.productRequests.changesRequested',
    );
    if (!ok) return;
    setReviewing(null);
    setRequestingChanges(null);
    setChangesComment('');
  };

  const approve = async (request: AdminProductRequest) => {
    const ok = await runAction(
      request,
      'approve',
      () => adminApi.approveProductRequest(request.id),
      'admin.productRequests.approved',
    );
    if (!ok) return;
    setReviewing(null);
  };

  const openEdit = (request: AdminProductRequest) => {
    setEditing(request);
    setEditForm(editFormFromRequest(request));
  };

  const updateRequest = async () => {
    if (!editing || !editForm) return;
    const payload: ProductRequestUpdatePayload = {
      quantity: Math.max(1, Number(editForm.quantity) || 1),
    };
    if (editing.request_type === 'ADD_VARIANT') {
      payload.variant_name_ru = editForm.variant_name_ru.trim();
      payload.variant_name_pl = editForm.variant_name_pl.trim();
      payload.variant_name_uk = editForm.variant_name_uk.trim();
      payload.price_override = editForm.price_override.trim() ? editForm.price_override.trim() : null;
    }
    const ok = await runAction(
      editing,
      'update',
      () => adminApi.updateProductRequest(editing.id, payload),
      'admin.productRequests.updated',
    );
    if (!ok) return;
    setEditing(null);
    setEditForm(null);
  };

  const canSubmit = (form.source_type === 'inpost' || form.location_id) && form.product_id && form.quantity && (
    form.request_type === 'ADD_VARIANT' ? form.variant_name.trim() : form.variant_id
  );

  const activeFilters: { value: ActiveFilter; label: string }[] = [
    { value: 'all', label: t('admin.productRequests.filters.allActive') },
    { value: 'pending_review', label: t('admin.productRequests.filters.pendingReview') },
    { value: 'need_changes', label: t('admin.productRequests.filters.needsChanges') },
  ];
  const archiveFilters: { value: ArchiveFilter; label: string }[] = [
    { value: 'all', label: t('admin.productRequests.filters.allArchive') },
    { value: 'approved', label: t('admin.productRequests.filters.approved') },
    { value: 'rejected', label: t('admin.productRequests.filters.rejected') },
  ];
  const sourceFilters: { value: SourceFilter; label: string }[] = [
    { value: 'all', label: t('admin.productRequests.sourceFilters.all') },
    { value: 'inpost', label: t('admin.productRequests.sourceFilters.inpost') },
    { value: 'local_point', label: t('admin.productRequests.sourceFilters.localPoint') },
  ];
  const visibleSourceFilters = sourceFilters.filter((filter) => (
    adminRole === 'project_admin'
    || filter.value === 'all'
    || (adminRole === 'inpost_curator' && filter.value === 'inpost')
    || ((adminRole === 'city_curator' || adminRole === 'point_manager') && filter.value === 'local_point')
  ));

  return (
    <section>
      <AdminPageHeader
        title={t('admin.productRequests.title')}
        subtitle={t('admin.productRequests.subtitle')}
        meta={<span>{t('admin.productRequests.meta').replace('{count}', String(requests.length))}</span>}
        actions={(
          <div className="admin-filter-bar">
            <button className={`admin-button ${mode === 'active' ? 'admin-button-primary' : 'admin-button-secondary'}`} type="button" onClick={() => setMode('active')}>
              {t('admin.productRequests.modes.active')}
            </button>
            <button className={`admin-button ${mode === 'archive' ? 'admin-button-primary' : 'admin-button-secondary'}`} type="button" onClick={() => setMode('archive')}>
              {t('admin.productRequests.modes.archive')}
            </button>
          </div>
        )}
      />

      <div className="admin-product-request-filter-divider" aria-hidden="true" />

      <div className="admin-filter-bar">
        {(mode === 'active' ? activeFilters : archiveFilters).map((filter) => (
          <button
            key={filter.value}
            className={`admin-button ${(mode === 'active' ? activeFilter : archiveFilter) === filter.value ? 'admin-button-primary' : 'admin-button-secondary'}`}
            type="button"
            onClick={() => (mode === 'active' ? setActiveFilter(filter.value as ActiveFilter) : setArchiveFilter(filter.value as ArchiveFilter))}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="admin-product-request-filter-divider" aria-hidden="true" />

      <div className="admin-product-request-source-switch">
        <span className="admin-filter-label">{t('admin.productRequests.sourceFilters.title')}</span>
        <div className="admin-filter-bar">
          {visibleSourceFilters.map((filter) => (
            <button
              key={filter.value}
              className={`admin-button ${sourceFilter === filter.value ? 'admin-button-primary' : 'admin-button-secondary'}`}
              type="button"
              onClick={() => setSourceFilter(filter.value)}
            >
              {filter.label}<span className="admin-filter-count">{sourceCounts[filter.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {canCreate && (
        <div className="admin-page-actions admin-product-request-create-actions">
          <button className="admin-button admin-button-primary" type="button" onClick={openCreateModal}>
            <Icon name="plus" size={16} /> {t('admin.productRequests.openCreate')}
          </button>
        </div>
      )}

      {error && <p className="admin-message admin-message-error">{error}</p>}
      {success && <p className="admin-message admin-message-success">{success}</p>}
      {loading && <div className="spinner" />}
      {!loading && requests.length === 0 && <AdminEmptyState title={t('admin.productRequests.emptyTitle')} description={t('admin.productRequests.emptyDescription')} />}
      {!loading && requests.length > 0 && (
        <div className="admin-cms-table">
          {requests.map((request) => {
            const isOwnEditableRequest = isEditableRequest(request);
            const actions = getProductRequestActions({ role: adminRole, currentTgId, request, isOwnEditableRequest });
            const isBusy = (action: string) => pendingActionId === `${request.id}:${action}`;
            return (
              <div key={request.id} className="admin-cms-row admin-request-row">
                <span className="admin-cms-cell-main">
                  <strong>{request.product_name || t('admin.productRequests.productFallback')}</strong>
                  <span>{sourceLabel(request.source_type)} - {targetLabel(request)}</span>
                </span>
                <div className="admin-request-meta">
                  <span>{requestTypeLabel(request.request_type)}</span>
                  <span>{request.variant_name || request.variant_name_ru || t('admin.productRequests.variantFallback')}</span>
                  <span>{t('admin.productRequests.quantity').replace('{count}', String(request.quantity))}</span>
                  {request.review_comment && <span>{t('admin.productRequests.fields.latestComment')}: {request.review_comment}</span>}
                  {request.locked_by_tg_id && <span>{t('admin.productRequests.lockedBy').replace('{id}', String(request.locked_by_tg_id))}</span>}
                  <AdminStatusBadge status={request.status} label={statusLabel(request.status)} />
                </div>
                {((canReview && (actions.canLock || actions.canTakeover)) || actions.canEdit) && (
                  <div className="admin-request-actions admin-row-actions">
                    {actions.canLock && (
                      <button className="admin-button admin-button-secondary" type="button" disabled={isBusy('lock')} onClick={() => lockForReview(request, 'lock')}>
                        <Icon name="shield" size={16} /> {t('admin.productRequests.actions.takeReview')}
                      </button>
                    )}
                    {actions.canTakeover && (
                      <button className="admin-button admin-button-secondary" type="button" disabled={isBusy('takeover')} onClick={() => lockForReview(request, 'takeover')}>
                        <Icon name="shield" size={16} /> {t('admin.productRequests.actions.takeover')}
                      </button>
                    )}
                    {actions.canEdit && request.status === 'need_changes' && (
                      <button className="admin-button admin-button-secondary" type="button" disabled={isBusy('update')} onClick={() => openEdit(request)}>
                        <Icon name="edit" size={16} /> {t('admin.productRequests.actions.edit')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
            <div className="input-group">
              <label className="input-label">{t('admin.productRequests.fields.source')}</label>
              <select className="input" value={form.source_type} onChange={event => setField('source_type', event.target.value as ProductRequestSourceType)}>
                {options.sources.map((source) => (
                  <option key={source.source_type} value={source.source_type}>{sourceLabel(source.source_type)}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">{t('admin.productRequests.fields.type')}</label>
              <select className="input" value={form.request_type} onChange={event => setField('request_type', event.target.value as ProductRequestType)}>
                <option value="ADD_VARIANT">{requestTypeLabel('ADD_VARIANT')}</option>
                <option value="ADD_STOCK">{requestTypeLabel('ADD_STOCK')}</option>
              </select>
            </div>
            {form.source_type === 'local_point' && (
              <div className="input-group">
                <label className="input-label">{t('admin.productRequests.fields.location')}</label>
                <select className="input" value={form.location_id} onChange={event => setField('location_id', event.target.value)}>
                  {options.locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.city_name} - {location.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="input-group">
              <label className="input-label">{t('admin.productRequests.fields.product')}</label>
              <select className="input" value={form.product_id} onChange={event => setField('product_id', event.target.value)}>
                {options.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name_ru}</option>
                ))}
              </select>
            </div>
            {form.request_type === 'ADD_STOCK' ? (
              <div className="input-group">
                <label className="input-label">{t('admin.productRequests.fields.variant')}</label>
                <select className="input" value={form.variant_id} onChange={event => setField('variant_id', event.target.value)}>
                  {selectedVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>{variant.name_ru}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="input-group">
                <label className="input-label">{t('admin.productRequests.fields.variantName')}</label>
                <input className="input" value={form.variant_name} onChange={event => setField('variant_name', event.target.value)} placeholder={t('admin.productRequests.placeholders.variantName')} />
              </div>
            )}
            <div className="input-group">
              <label className="input-label">{t('admin.productRequests.fields.quantity')}</label>
              <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" value={form.quantity} onChange={event => setField('quantity', event.target.value)} />
            </div>
            {form.request_type === 'ADD_VARIANT' && (
              <div className="input-group">
                <label className="input-label">{t('admin.productRequests.fields.price')}</label>
                <input className="input" type="text" inputMode="decimal" value={form.price_override} onChange={event => setField('price_override', event.target.value)} placeholder={t('admin.productRequests.placeholders.price')} />
              </div>
            )}
          </div>
        </AdminModal>
      )}

      {reviewing && (
        <AdminModal
          title={t('admin.productRequests.reviewTitle')}
          subtitle={reviewing.product_name || t('admin.productRequests.productFallback')}
          onClose={closeReviewModal}
          footer={(
            <div className="admin-request-review-actions">
              {reviewActions?.canApprove && (
                <button className="admin-button admin-button-primary" type="button" disabled={pendingActionId === `${reviewing.id}:approve`} onClick={() => approve(reviewing)}>
                  <Icon name="check" size={16} /> {t('admin.productRequests.approve')}
                </button>
              )}
              {reviewActions?.canRequestChanges && (
                <button className="admin-button admin-button-secondary" type="button" disabled={pendingActionId === `${reviewing.id}:need_changes`} onClick={() => setRequestingChanges(reviewing)}>
                  <Icon name="edit" size={16} /> {t('admin.productRequests.actions.needChanges')}
                </button>
              )}
              {reviewActions?.canReject && (
                <button className="admin-button admin-button-danger" type="button" disabled={pendingActionId === `${reviewing.id}:reject`} onClick={() => setRejecting(reviewing)}>
                  <Icon name="x" size={16} /> {t('admin.productRequests.reject')}
                </button>
              )}
              <button className="admin-button admin-button-secondary" type="button" disabled={isReviewVerdictPending || pendingActionId === `${reviewing.id}:release`} onClick={closeReviewModal}>
                <Icon name="x" size={16} /> {t('admin.productRequests.release')}
              </button>
            </div>
          )}
        >
          {reviewCloseError && <p className="admin-message admin-message-error">{reviewCloseError}</p>}
          <div className="admin-request-review-details">
            <p><strong>{t('admin.productRequests.fields.source')}</strong><span>{sourceLabel(reviewing.source_type)}</span></p>
            <p><strong>{t('admin.productRequests.fields.location')}</strong><span>{targetLabel(reviewing)}</span></p>
            <p><strong>{t('admin.productRequests.fields.type')}</strong><span>{requestTypeLabel(reviewing.request_type)}</span></p>
            <p><strong>{t('admin.productRequests.fields.variant')}</strong><span>{reviewing.variant_name || reviewing.variant_name_ru || t('admin.productRequests.variantFallback')}</span></p>
            <p><strong>{t('admin.productRequests.fields.quantity')}</strong><span>{String(reviewing.quantity)}</span></p>
            {reviewing.review_comment && <p><strong>{t('admin.productRequests.fields.latestComment')}</strong><span>{reviewing.review_comment}</span></p>}
          </div>
        </AdminModal>
      )}

      {rejecting && (
        <AdminModal
          title={t('admin.productRequests.rejectTitle')}
          subtitle={t('admin.productRequests.rejectSubtitle')}
          onClose={() => setRejecting(null)}
          footer={(
            <>
              <button className="admin-button admin-button-secondary" type="button" onClick={() => setRejecting(null)}>{t('admin.common.cancel')}</button>
              <button className="admin-button admin-button-danger" type="button" disabled={!rejectReason.trim() || pendingActionId === `${rejecting.id}:reject`} onClick={reject}>{t('admin.productRequests.reject')}</button>
            </>
          )}
        >
          <div className="input-group">
            <label className="input-label">{t('admin.productRequests.fields.rejectReason')}</label>
            <textarea className="input" value={rejectReason} onChange={event => setRejectReason(event.target.value)} placeholder={t('admin.productRequests.placeholders.rejectReason')} />
          </div>
        </AdminModal>
      )}

      {requestingChanges && (
        <AdminModal
          title={t('admin.productRequests.needChangesTitle')}
          subtitle={t('admin.productRequests.needChangesSubtitle')}
          onClose={() => setRequestingChanges(null)}
          footer={(
            <>
              <button className="admin-button admin-button-secondary" type="button" onClick={() => setRequestingChanges(null)}>{t('admin.common.cancel')}</button>
              <button className="admin-button admin-button-primary" type="button" disabled={!changesComment.trim() || pendingActionId === `${requestingChanges.id}:need_changes`} onClick={requestChanges}>{t('admin.productRequests.actions.needChanges')}</button>
            </>
          )}
        >
          <div className="input-group">
            <label className="input-label">{t('admin.productRequests.fields.managerComment')}</label>
            <textarea className="input" value={changesComment} onChange={event => setChangesComment(event.target.value)} placeholder={t('admin.productRequests.placeholders.managerComment')} />
          </div>
        </AdminModal>
      )}

      {editing && editForm && (
        <AdminModal
          title={t('admin.productRequests.editTitle')}
          subtitle={t('admin.productRequests.editSubtitle')}
          onClose={() => { setEditing(null); setEditForm(null); }}
          footer={(
            <>
              <button className="admin-button admin-button-secondary" type="button" onClick={() => { setEditing(null); setEditForm(null); }}>{t('admin.common.cancel')}</button>
              <button className="admin-button admin-button-primary" type="button" disabled={pendingActionId === `${editing.id}:update`} onClick={updateRequest}>{t('admin.productRequests.actions.saveChanges')}</button>
            </>
          )}
        >
          {editing.review_comment && (
            <p className="admin-message">{t('admin.productRequests.fields.reviewComment')}: {editing.review_comment}</p>
          )}
          <div className="admin-form-grid">
            {editing.request_type === 'ADD_VARIANT' && (
              <>
                <div className="input-group">
                  <label className="input-label">{t('admin.fields.nameRu')}</label>
                  <input className="input" value={editForm.variant_name_ru} onChange={event => setEditForm((current) => current && ({ ...current, variant_name_ru: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">{t('admin.fields.namePl')}</label>
                  <input className="input" value={editForm.variant_name_pl} onChange={event => setEditForm((current) => current && ({ ...current, variant_name_pl: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">{t('admin.fields.nameUk')}</label>
                  <input className="input" value={editForm.variant_name_uk} onChange={event => setEditForm((current) => current && ({ ...current, variant_name_uk: event.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">{t('admin.productRequests.fields.price')}</label>
                  <input className="input" type="text" inputMode="decimal" value={editForm.price_override} onChange={event => setEditForm((current) => current && ({ ...current, price_override: event.target.value }))} placeholder={t('admin.productRequests.placeholders.price')} />
                </div>
              </>
            )}
            <div className="input-group">
              <label className="input-label">{t('admin.productRequests.fields.quantity')}</label>
              <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" value={editForm.quantity} onChange={event => setEditForm((current) => current && ({ ...current, quantity: event.target.value }))} />
            </div>
          </div>
        </AdminModal>
      )}
    </section>
  );
}

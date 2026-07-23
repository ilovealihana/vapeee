import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminProductRequest, type AdminStaffRole, type ProductRequestOptions, type ProductRequestPayload, type ProductRequestType } from '../../api/admin';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';
import { AdminEmptyState, AdminModal, AdminPageHeader, AdminStatusBadge } from './AdminUI';

type FormState = {
  request_type: ProductRequestType;
  location_id: string;
  product_id: string;
  variant_id: string;
  variant_name: string;
  price_override: string;
  quantity: string;
};

const initialForm: FormState = {
  request_type: 'ADD_VARIANT',
  location_id: '',
  product_id: '',
  variant_id: '',
  variant_name: '',
  price_override: '',
  quantity: '1',
};

export default function AdminProductRequests() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const [adminRole, setAdminRole] = useState<AdminStaffRole | undefined>();
  const [requests, setRequests] = useState<AdminProductRequest[]>([]);
  const [options, setOptions] = useState<ProductRequestOptions>({ locations: [], products: [] });
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejecting, setRejecting] = useState<AdminProductRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [access, nextRequests, nextOptions] = await Promise.all([
        adminApi.getAccess(),
        adminApi.getProductRequests(),
        adminApi.getProductRequestOptions(),
      ]);
      setAdminRole(access.role);
      setRequests(nextRequests);
      setOptions(nextOptions);
      setForm((current) => ({
        ...current,
        location_id: current.location_id || String(nextOptions.locations[0]?.id ?? ''),
        product_id: current.product_id || String(nextOptions.products[0]?.id ?? ''),
      }));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedProduct = useMemo(
    () => options.products.find((product) => product.id === Number(form.product_id)),
    [form.product_id, options.products],
  );
  const selectedVariants = selectedProduct?.variants ?? [];

  useEffect(() => {
    if (form.request_type !== 'ADD_STOCK') return;
    if (form.variant_id || selectedVariants.length === 0) return;
    setForm((current) => ({ ...current, variant_id: String(selectedVariants[0].id) }));
  }, [form.request_type, form.variant_id, selectedVariants]);

  const requestTypeLabel = (type: ProductRequestType) => t(`admin.productRequests.types.${type}`);
  const statusLabel = (status: string) => t(`admin.productRequests.status.${status}`);
  const canCreate = adminRole === 'point_manager';
  const canReview = adminRole === 'project_admin' || adminRole === 'city_curator';

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'product_id' ? { variant_id: '' } : {}),
    }));
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    const payload: ProductRequestPayload = {
      request_type: form.request_type,
      location_id: Number(form.location_id),
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
      setForm((current) => ({ ...initialForm, location_id: current.location_id, product_id: current.product_id }));
      setSuccess(t('admin.productRequests.created'));
      await load();
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const approve = async (request: AdminProductRequest) => {
    setError('');
    try {
      await adminApi.approveProductRequest(request.id);
      setSuccess(t('admin.productRequests.approved'));
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const reject = async () => {
    if (!rejecting || !rejectReason.trim()) return;
    setError('');
    try {
      await adminApi.rejectProductRequest(rejecting.id, rejectReason.trim());
      setRejecting(null);
      setRejectReason('');
      setSuccess(t('admin.productRequests.rejected'));
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const canSubmit = form.location_id && form.product_id && form.quantity && (
    form.request_type === 'ADD_VARIANT' ? form.variant_name.trim() : form.variant_id
  );

  return (
    <section>
      <AdminPageHeader
        title={t('admin.productRequests.title')}
        subtitle={t('admin.productRequests.subtitle')}
        meta={<span>{t('admin.productRequests.meta').replace('{count}', String(requests.length))}</span>}
      />

      {canCreate && (
        <div className="admin-cms-section">
        <div className="admin-cms-section-header">
          <h3>{t('admin.productRequests.newTitle')}</h3>
          <span>{t('admin.productRequests.newSubtitle')}</span>
        </div>
        <div className="admin-form-grid">
          <div className="input-group">
            <label className="input-label">{t('admin.productRequests.fields.type')}</label>
            <select className="input" value={form.request_type} onChange={event => setField('request_type', event.target.value as ProductRequestType)}>
              <option value="ADD_VARIANT">{requestTypeLabel('ADD_VARIANT')}</option>
              <option value="ADD_STOCK">{requestTypeLabel('ADD_STOCK')}</option>
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">{t('admin.productRequests.fields.location')}</label>
            <select className="input" value={form.location_id} onChange={event => setField('location_id', event.target.value)}>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.city_name} - {location.name}</option>
              ))}
            </select>
          </div>
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
        <button className="admin-button admin-button-primary" type="button" disabled={!canSubmit || saving} onClick={submit}>
          <Icon name="plus" size={16} /> {saving ? t('admin.productRequests.saving') : t('admin.productRequests.create')}
        </button>
        </div>
      )}

      {error && <p className="admin-message admin-message-error">{error}</p>}
      {success && <p className="admin-message admin-message-success">{success}</p>}
      {loading && <div className="spinner" />}
      {!loading && requests.length === 0 && <AdminEmptyState title={t('admin.productRequests.emptyTitle')} description={t('admin.productRequests.emptyDescription')} />}
      {!loading && requests.length > 0 && (
        <div className="admin-cms-table">
          {requests.map((request) => (
            <div key={request.id} className="admin-cms-row admin-request-row">
              <span className="admin-cms-cell-main">
                <strong>{request.product_name || t('admin.productRequests.productFallback')}</strong>
                <span>{requestTypeLabel(request.request_type)} - {request.location_name || t('admin.productRequests.locationFallback')}</span>
              </span>
              <div className="admin-request-meta">
                <span>{request.variant_name || request.variant_name_ru || t('admin.productRequests.variantFallback')}</span>
                <span>{t('admin.productRequests.quantity').replace('{count}', String(request.quantity))}</span>
                <AdminStatusBadge status={request.status} label={statusLabel(request.status)} />
              </div>
              {canReview && request.status === 'pending_review' && (
                <div className="admin-request-actions admin-row-actions">
                  <button className="admin-icon-button" type="button" onClick={() => approve(request)} aria-label={t('admin.productRequests.approveAria')}>
                    <Icon name="check" size={16} />
                  </button>
                  <button className="admin-icon-button" type="button" onClick={() => setRejecting(request)} aria-label={t('admin.productRequests.rejectAria')}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rejecting && (
        <AdminModal
          title={t('admin.productRequests.rejectTitle')}
          subtitle={t('admin.productRequests.rejectSubtitle')}
          onClose={() => setRejecting(null)}
          footer={(
            <>
              <button className="admin-button admin-button-secondary" type="button" onClick={() => setRejecting(null)}>{t('admin.common.cancel')}</button>
              <button className="admin-button admin-button-danger" type="button" disabled={!rejectReason.trim()} onClick={reject}>{t('admin.productRequests.reject')}</button>
            </>
          )}
        >
          <div className="input-group">
            <label className="input-label">{t('admin.productRequests.fields.rejectReason')}</label>
            <textarea className="input" value={rejectReason} onChange={event => setRejectReason(event.target.value)} placeholder={t('admin.productRequests.placeholders.rejectReason')} />
          </div>
        </AdminModal>
      )}
    </section>
  );
}

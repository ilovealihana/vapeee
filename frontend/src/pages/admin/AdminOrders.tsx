import { useEffect, useState } from 'react';
import { adminApi, type AdminOrder } from '../../api/admin';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';
import { AdminEmptyState, AdminModal, AdminPageHeader, AdminStatusBadge } from './AdminUI';

const STATUSES = [
  { id: '', labelKey: 'admin.orders.filters.all' },
  { id: 'new', labelKey: 'admin.orders.filters.new' },
  { id: 'confirmed', labelKey: 'admin.orders.filters.confirmed' },
  { id: 'ready', labelKey: 'admin.orders.filters.ready' },
  { id: 'completed', labelKey: 'admin.orders.filters.completed' },
  { id: 'cancelled', labelKey: 'admin.orders.filters.cancelled' },
];

const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'admin.orders.status.new',
  confirmed: 'admin.orders.status.confirmed',
  ready: 'admin.orders.status.ready',
  completed: 'admin.orders.status.completed',
  cancelled: 'admin.orders.status.cancelled',
};

const DELIVERY_LABEL_KEYS: Record<string, string> = {
  door_delivery: 'admin.orders.delivery.door',
  pickup: 'admin.orders.delivery.pickup',
  inpost: 'admin.orders.delivery.inpost',
};

export default function AdminOrders() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [error, setError] = useState('');

  const load = async (status = filter) => {
    setLoading(true);
    try {
      setOrders(await adminApi.getOrders(status || undefined));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const changeStatus = async (order: AdminOrder, status: string) => {
    try {
      const updated = await adminApi.updateOrderStatus(order.id, status);
      setOrders(current => current.map(item => item.id === updated.id ? updated : item));
      setSelected(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const nextStatuses = (current: string): string[] => ({
    new: ['confirmed', 'cancelled'],
    confirmed: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  }[current] || []);
  const statusLabel = (status: string) => STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status;
  const deliveryLabel = (deliveryType: string) => DELIVERY_LABEL_KEYS[deliveryType] ? t(DELIVERY_LABEL_KEYS[deliveryType]) : deliveryType;

  return (
    <section>
      <AdminPageHeader
        title={t('admin.orders.title')}
        subtitle={t('admin.orders.subtitle')}
        meta={<span>{t('admin.orders.meta').replace('{count}', String(orders.length))}</span>}
      />

      <div className="admin-filter-bar">
        {STATUSES.map(status => (
          <button
            key={status.id}
            className={`chip ${filter === status.id ? 'active' : ''}`}
            type="button"
            onClick={() => setFilter(status.id)}
          >
            {t(status.labelKey)}
          </button>
        ))}
      </div>

      {error && <p className="admin-message admin-message-error">{error}</p>}
      {loading && <div className="spinner" />}
      {!loading && orders.length === 0 && <AdminEmptyState title={t('admin.orders.emptyTitle')} description={t('admin.orders.emptyDescription')} />}
      {!loading && orders.length > 0 && (
        <div className="admin-cms-table">
          {orders.map(order => (
            <button key={order.id} className="admin-cms-row admin-order-row" type="button" onClick={() => setSelected(order)}>
              <strong>#{order.id}</strong>
              <span className="admin-cms-cell-main">
                <strong>{order.customer_name}</strong>
                <span>{order.customer_phone}</span>
              </span>
              <span className="muted">{deliveryLabel(order.delivery_type)}</span>
              <AdminStatusBadge status={order.status} label={statusLabel(order.status)} />
              <span className="price-small">{Number(order.total).toFixed(2)} zł</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <AdminModal
          title={t('admin.orders.orderTitle').replace('{id}', String(selected.id))}
          subtitle={selected.customer_name}
          onClose={() => setSelected(null)}
          footer={nextStatuses(selected.status).length > 0 && (
            <div className="admin-modal-actions">
              {nextStatuses(selected.status).map(status => (
                <button
                  key={status}
                  className={status === 'cancelled' ? 'admin-button admin-button-danger' : 'admin-button admin-button-primary'}
                  type="button"
                  onClick={() => changeStatus(selected, status)}
                >
                  {status === 'cancelled' ? <Icon name="x" size={16} /> : <Icon name="check" size={16} />}
                  {statusLabel(status)}
                </button>
              ))}
            </div>
          )}
        >
          <div className="admin-detail-grid">
            <div><span className="muted">{t('admin.orders.details.status')}</span><AdminStatusBadge status={selected.status} label={statusLabel(selected.status)} /></div>
            <div><span className="muted">{t('admin.orders.details.phone')}</span><strong>{selected.customer_phone}</strong></div>
            <div><span className="muted">{t('admin.orders.details.email')}</span><strong>{selected.customer_email || '-'}</strong></div>
            <div><span className="muted">{t('admin.orders.details.delivery')}</span><strong>{deliveryLabel(selected.delivery_type)}</strong></div>
            {selected.delivery_address && <div className="admin-detail-wide"><span className="muted">{t('admin.fields.address')}</span><strong>{selected.delivery_address}</strong></div>}
            {selected.scheduled_at && <div><span className="muted">{t('admin.orders.details.time')}</span><strong>{new Date(selected.scheduled_at).toLocaleString('ru-RU')}</strong></div>}
            <div><span className="muted">{t('admin.orders.details.payment')}</span><strong>{selected.payment_method}</strong></div>
            {selected.comment && <div className="admin-detail-wide"><span className="muted">{t('admin.orders.details.comment')}</span><strong>{selected.comment}</strong></div>}
          </div>

          {selected.items?.length > 0 && (
            <div className="admin-order-items">
              <h4>{t('admin.orders.itemsTitle')}</h4>
              {selected.items.map((item, index) => (
                <div key={item.id || index} className="admin-order-item-row">
                  <span>{item.product_name || item.name || t('admin.orders.itemFallback').replace('{index}', String(index + 1))}</span>
                  <span className="muted">{item.quantity || 1} {t('common.piecesShort')}</span>
                </div>
              ))}
            </div>
          )}

          <div className="admin-order-total">
            <span>{t('admin.orders.totals.products')}</span><strong>{Number(selected.products_total).toFixed(2)} zł</strong>
            <span>{t('admin.orders.totals.delivery')}</span><strong>{Number(selected.delivery_cost).toFixed(2)} zł</strong>
            <span>{t('admin.orders.totals.total')}</span><strong>{Number(selected.total).toFixed(2)} zł</strong>
          </div>
        </AdminModal>
      )}
    </section>
  );
}

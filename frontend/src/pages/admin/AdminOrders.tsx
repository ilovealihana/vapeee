import { useEffect, useState } from 'react';
import { adminApi, type AdminOrder } from '../../api/admin';

const STATUSES = [
  { id: '', label: 'Все' },
  { id: 'new', label: '🆕 Новые' },
  { id: 'confirmed', label: '✅ Подтверждены' },
  { id: 'ready', label: '📦 Готовы' },
  { id: 'completed', label: '✔️ Выполнены' },
  { id: 'cancelled', label: '❌ Отменены' },
];

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 Новый', confirmed: '✅ Подтверждён',
  ready: '📦 Готов', completed: '✔️ Выполнен', cancelled: '❌ Отменён',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [error, setError] = useState('');

  const load = async (status = filter) => {
    setLoading(true);
    try { setOrders(await adminApi.getOrders(status || undefined)); } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const changeStatus = async (order: AdminOrder, status: string) => {
    try {
      const updated = await adminApi.updateOrderStatus(order.id, status);
      setOrders(os => os.map(o => o.id === updated.id ? updated : o));
      setSelected(updated);
    } catch (e: any) { setError(e.message); }
  };

  const nextStatuses = (current: string): string[] => {
    const flow: Record<string, string[]> = {
      new: ['confirmed', 'cancelled'],
      confirmed: ['ready', 'cancelled'],
      ready: ['completed', 'cancelled'],
      completed: [], cancelled: [],
    };
    return flow[current] || [];
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Status filter */}
      <div className="chip-row" style={{ padding: '12px 16px 8px' }}>
        {STATUSES.map(s => (
          <div
            key={s.id}
            className={`chip ${filter === s.id ? 'active' : ''}`}
            onClick={() => setFilter(s.id)}
          >{s.label}</div>
        ))}
      </div>

      <div className="container">
        {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}
        {loading && <div className="spinner" />}

        {!loading && orders.length === 0 && (
          <div className="empty-state">
            <div className="icon">📋</div>
            <h3>Нет заказов</h3>
          </div>
        )}

        {orders.map(order => (
          <div
            key={order.id}
            className="card"
            onClick={() => setSelected(order)}
            style={{ cursor: 'pointer', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>#{order.id} — {order.customer_name}</span>
              <span className={`status-badge status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>
              {order.customer_phone} · {order.payment_method}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {order.delivery_type === 'inpost' ? '📦 InPost' : '🏪 Самовывоз'}
              </span>
              <span className="price-small">{Number(order.total).toFixed(2)} zł</span>
            </div>
          </div>
        ))}
      </div>

      {/* Order detail bottom sheet */}
      {selected && (
        <div className="bottom-sheet-overlay" onClick={() => setSelected(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h2 style={{ fontWeight: 700, fontSize: 20 }}>Заказ #{selected.id}</h2>
              <span className={`status-badge status-${selected.status}`}>{STATUS_LABELS[selected.status]}</span>
            </div>

            <div style={{ fontSize: 14, marginBottom: 12 }}>
              <div>👤 {selected.customer_name}</div>
              <div>📱 {selected.customer_phone}</div>
              <div>📧 {selected.customer_email}</div>
              {selected.delivery_address && <div>📍 {selected.delivery_address}</div>}
              {selected.scheduled_at && <div>📅 {new Date(selected.scheduled_at).toLocaleString('ru-RU')}</div>}
              <div>💳 {selected.payment_method}</div>
              {selected.comment && <div>💬 {selected.comment}</div>}
            </div>

            <div className="divider" />
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              Итого: {Number(selected.total).toFixed(2)} zł
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Доставка: {Number(selected.delivery_cost).toFixed(2)} zł
            </div>

            {/* Status actions */}
            {nextStatuses(selected.status).length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Изменить статус:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {nextStatuses(selected.status).map(s => (
                    <button
                      key={s}
                      className={s === 'cancelled' ? 'btn btn-danger' : 'btn btn-primary'}
                      style={{ flex: 1, padding: '10px 8px', fontSize: 14 }}
                      onClick={() => changeStatus(selected, s)}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useUserStore } from '../store/user';
import { api, type Order } from '../api/client';

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 Новый',
  confirmed: '✅ Подтверждён',
  ready: '📦 Готов',
  completed: '✔️ Выполнен',
  cancelled: '❌ Отменён',
};

const LANGS = [
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'pl', flag: '🇵🇱', label: 'Polski' },
  { code: 'uk', flag: '🇺🇦', label: 'Українська' },
];

export default function Profile() {
  const { user, language, setLanguage } = useUserStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'profile' | 'orders' | 'language'>('profile');
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (tab === 'orders') {
      setLoadingOrders(true);
      api.orders.list().then(setOrders).finally(() => setLoadingOrders(false));
    }
  }, [tab]);

  if (!user) return <div className="spinner" />;

  return (
    <div className="page">
      <div style={{ padding: '32px 16px 16px', background: 'linear-gradient(180deg, rgba(124,58,237,0.15) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {user.first_name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>
              {user.first_name} {user.last_name || ''}
            </div>
            {user.username && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{user.username}</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'profile', label: '👤 Профиль' },
          { id: 'orders', label: '📋 Заказы' },
          { id: 'language', label: '🌐 Язык' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            style={{
              flex: 1, padding: '12px 4px', border: 'none', background: 'none',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 13, cursor: 'pointer',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="container" style={{ paddingTop: 16 }}>
        {/* Profile tab */}
        {tab === 'profile' && (
          <div>
            {[
              { label: 'Имя', value: `${user.first_name} ${user.last_name || ''}`.trim() },
              { label: 'Username', value: user.username ? `@${user.username}` : '—' },
              { label: 'Телефон', value: user.phone || '—' },
              { label: 'Email', value: user.email || '—' },
              { label: 'Язык', value: LANGS.find(l => l.code === language)?.label || language },
              { label: 'В боте с', value: new Date(user.created_at).toLocaleDateString('ru-RU') },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{label}</span>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Orders tab */}
        {tab === 'orders' && (
          <div>
            {loadingOrders && <div className="spinner" />}
            {!loadingOrders && orders.length === 0 && (
              <div className="empty-state">
                <div className="icon">📦</div>
                <h3>Нет заказов</h3>
                <p>Твои заказы появятся здесь</p>
              </div>
            )}
            {orders.map((order) => (
              <div key={order.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>Заказ #{order.id}</span>
                  <span className={`status-badge status-${order.status}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {new Date(order.created_at).toLocaleDateString('ru-RU')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {order.delivery_type === 'inpost' ? '📦 InPost' : '🏪 Самовывоз'}
                  </span>
                  <span className="price-small">{Number(order.total).toFixed(2)} zł</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Language tab */}
        {tab === 'language' && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Выбери язык</h2>
            {LANGS.map((lang) => (
              <button
                key={lang.code}
                className="card"
                onClick={() => setLanguage(lang.code)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  border: `1.5px solid ${language === lang.code ? 'var(--accent)' : 'var(--border)'}`,
                  background: language === lang.code ? 'rgba(124,58,237,0.08)' : 'var(--surface)',
                }}
              >
                <span style={{ fontSize: 32 }}>{lang.flag}</span>
                <span style={{ fontWeight: language === lang.code ? 700 : 400, fontSize: 17 }}>{lang.label}</span>
                {language === lang.code && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

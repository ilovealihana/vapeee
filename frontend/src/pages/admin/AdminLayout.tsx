import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/user';

const ADMIN_IDS = (import.meta.env.VITE_ADMIN_IDS || '823810588')
  .split(',').map((s: string) => Number(s.trim()));

const tabs = [
  { path: '/admin/cities', label: '🏙 Города' },
  { path: '/admin/products', label: '📦 Товары' },
  { path: '/admin/stock', label: '📊 Остатки' },
  { path: '/admin/orders', label: '📋 Заказы' },
];

export default function AdminLayout() {
  const { user, fetchUser } = useUserStore();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      await fetchUser();
      setChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!checking && user && !ADMIN_IDS.includes(user.tg_id)) {
      navigate('/');
    }
  }, [checking, user]);

  if (checking) return <div className="spinner" />;
  if (!user || !ADMIN_IDS.includes(user.tg_id)) return null;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 70 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.1))',
        padding: '20px 16px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text)' }}
          >←</button>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 20 }}>🔧 Панель управления</h1>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>VapeShop Admin</div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={({ isActive }) => ({
              flex: 1,
              padding: '12px 4px',
              textAlign: 'center',
              textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: isActive ? 700 : 400,
              fontSize: 13,
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Page content */}
      <Outlet />
    </div>
  );
}

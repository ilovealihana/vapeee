import { useNavigate, useLocation } from 'react-router-dom';
import { useCartStore } from '../store/cart';

const tabs = [
  { path: '/', icon: '🏠', label: 'Главная' },
  { path: '/products', icon: '🛍', label: 'Каталог' },
  { path: '/cart', icon: '🛒', label: 'Корзина' },
  { path: '/profile', icon: '👤', label: 'Профиль' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const itemCount = useCartStore((s) => s.itemCount());

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
      zIndex: 50,
    }}>
      {tabs.map((tab) => {
        const active = tab.path === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 0',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, position: 'relative' }}>
              {tab.icon}
              {tab.path === '/cart' && itemCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}>
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </span>
            <span style={{
              fontSize: 11,
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: active ? 600 : 400,
              transition: 'color 0.15s',
            }}>
              {tab.label}
            </span>
            {active && (
              <span style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 24,
                height: 3,
                background: 'var(--accent)',
                borderRadius: '0 0 4px 4px',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}

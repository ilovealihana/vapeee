import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';

const ADMIN_IDS = (import.meta.env.VITE_ADMIN_IDS || '823810588').split(',').map((s: string) => Number(s.trim()));
const tabs = [
  { path: '/admin/cities', labelKey: 'admin.layout.tabs.cities', icon: 'mapPin' as const },
  { path: '/admin/products', labelKey: 'admin.layout.tabs.products', icon: 'package' as const },
  { path: '/admin/stock', labelKey: 'admin.layout.tabs.stock', icon: 'box' as const },
  { path: '/admin/orders', labelKey: 'admin.layout.tabs.orders', icon: 'orders' as const },
];

export default function AdminLayout() {
  const { user, fetchUser, error, activeLocale } = useUserStore();
  const { t } = useI18n(activeLocale);
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      await fetchUser();
      setChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!checking && user && !ADMIN_IDS.includes(user.tg_id)) navigate('/');
  }, [checking, user]);

  if (checking) return <div className="page admin-page"><div className="spinner" /></div>;
  if (!user || !ADMIN_IDS.includes(user.tg_id)) {
    return (
      <div className="admin-cms-shell">
        <section className="admin-access-state">
          <div className="admin-empty-icon">
            <Icon name="shield" size={22} />
          </div>
          <h1>{t('admin.layout.noAccessTitle')}</h1>
          <p>
            {!user
              ? t('admin.layout.noTelegramUser')
              : t('admin.layout.notInAdminList')}
          </p>
          {error && <span className="admin-access-error">{error}</span>}
          <button className="admin-button admin-button-secondary" type="button" onClick={() => navigate('/')}>
            <Icon name="chevronLeft" size={16} /> {t('admin.layout.backToApp')}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-cms-shell">
      <header className="admin-cms-header">
        <div className="admin-cms-titlebar">
          <button className="admin-icon-button" type="button" onClick={() => navigate('/')} aria-label={t('admin.layout.backToApp')}>
            <Icon name="chevronLeft" />
          </button>
          <div>
            <h1>{t('admin.layout.title')}</h1>
            <p>{t('admin.layout.subtitle')}</p>
          </div>
        </div>
        <div className="admin-cms-user">
          <span className="tag tag-accent"><Icon name="shield" size={14} /> Admin</span>
          <span className="muted">ID {user.tg_id}</span>
        </div>
      </header>
      <nav className="admin-cms-tabs">
        {tabs.map((tab) => (
          <NavLink key={tab.path} to={tab.path} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon name={tab.icon} size={16} /> {t(tab.labelKey)}
          </NavLink>
        ))}
      </nav>
      <main className="admin-cms-content">
        <Outlet />
      </main>
    </div>
  );
}

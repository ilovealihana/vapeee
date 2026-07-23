import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';

const tabs = [
  { path: '/admin/product-requests', labelKey: 'admin.layout.tabs.productRequests', icon: 'tag' as const, roles: ['project_admin', 'city_curator', 'point_manager'] },
  { path: '/admin/cities', labelKey: 'admin.layout.tabs.cities', icon: 'mapPin' as const, roles: ['project_admin'] },
  { path: '/admin/products', labelKey: 'admin.layout.tabs.products', icon: 'package' as const, roles: ['project_admin'] },
  { path: '/admin/stock', labelKey: 'admin.layout.tabs.stock', icon: 'box' as const, roles: ['project_admin'] },
  { path: '/admin/orders', labelKey: 'admin.layout.tabs.orders', icon: 'orders' as const, roles: ['project_admin'] },
  { path: '/admin/staff', labelKey: 'admin.layout.tabs.staff', icon: 'user' as const, roles: ['project_admin'] },
];

export default function AdminLayout() {
  const { user, fetchUser, error, activeLocale } = useUserStore();
  const { t } = useI18n(activeLocale);
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [adminRole, setAdminRole] = useState<string>('');
  const allowedTabs = tabs.filter((tab) => adminRole === 'project_admin' || tab.roles.includes(adminRole as any));

  useEffect(() => {
    (async () => {
      await fetchUser();
      try {
        const access = await adminApi.getAccess();
        setHasAdminAccess(access.has_access);
        setAdminRole(access.role || '');
      } catch {
        setHasAdminAccess(false);
        setAdminRole('');
      }
      setChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!checking && !hasAdminAccess) navigate('/');
  }, [checking, hasAdminAccess]);

  useEffect(() => {
    if (checking || !hasAdminAccess || !adminRole) return;
    if (!allowedTabs.some((tab) => tab.path === location.pathname)) {
      navigate('/admin/product-requests', { replace: true });
    }
  }, [checking, hasAdminAccess, adminRole, location.pathname]);

  if (checking) return <div className="page admin-page"><div className="spinner" /></div>;
  if (!user || !hasAdminAccess) {
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
          <span className="tag tag-accent"><Icon name="shield" size={14} /> {adminRole}</span>
          <span className="muted">ID {user.tg_id}</span>
        </div>
      </header>
      <nav className="admin-cms-tabs">
        {allowedTabs.map((tab) => (
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

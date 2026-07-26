import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { useUserStore } from '../store/user';
import Icon from './Icon';

const tabs = [
  { path: '/', icon: 'home' as const, labelKey: 'nav.home' },
  { path: '/products', icon: 'catalog' as const, labelKey: 'nav.catalog' },
  { path: '/cart', icon: 'cart' as const, labelKey: 'nav.cart' },
  { path: '/profile', icon: 'profile' as const, labelKey: 'nav.profile' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const itemCount = useCartStore((s) => s.itemCount());
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  return (
    <nav className="bottom-nav" aria-label={t('nav.primary')}>
      {tabs.map((tab) => {
        const active = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            className={active ? 'active' : ''}
            onClick={() => navigate(tab.path)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={21} />
            {tab.path === '/cart' && itemCount > 0 && (
              <span className="nav-badge">{itemCount > 9 ? '9+' : itemCount}</span>
            )}
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

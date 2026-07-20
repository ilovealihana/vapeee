import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';
import { COPIED_BOTTOM_NAV_ITEMS, type CopiedBottomNavTab } from '../utils/copiedBottomNav';

type CopiedBottomNavProps = {
  activeTab: CopiedBottomNavTab;
  cartCount?: number;
};

export default function CopiedBottomNav({ activeTab, cartCount = 0 }: CopiedBottomNavProps) {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  return (
    <nav className="copied-shared-bottom-nav fixed bottom-0 left-0 w-full z-50 bg-surface-container/90 dark:bg-surface-container/90 backdrop-blur-xl border-t border-outline-variant/30 px-4 pb-6 pt-3 flex justify-around items-center rounded-t-xl">
      {COPIED_BOTTOM_NAV_ITEMS.map((item) => {
        const isActive = item.id === activeTab;

        return (
          <Link
            key={item.id}
            className={[
              'relative flex flex-col items-center justify-center transition-transform duration-150 active:scale-95',
              isActive ? 'text-primary dark:text-primary font-medium' : 'text-on-surface-variant dark:text-on-surface-variant hover:text-primary/80',
            ].join(' ')}
            to={item.path}
          >
            <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: '"FILL" 1' } : undefined}>
              {item.icon}
            </span>
            {item.id === 'cart' && cartCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-primary text-on-primary text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
            <span className="text-label-sm font-label-sm mt-1">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';
import { COPIED_TOP_BAR_TITLE } from '../utils/copiedBottomNav';

export default function CopiedTopBar() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  return (
    <header className="copied-shared-topbar fixed top-0 left-0 w-full z-50 bg-surface/80 dark:bg-surface/80 backdrop-blur-md">
      <div className="flex justify-between items-center w-full px-margin-page py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <button className="text-on-surface active:scale-95 transition-transform" type="button" aria-label={t('nav.menu')}>
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="text-headline-sm font-headline-sm font-black tracking-tight text-on-surface dark:text-on-surface">
            {t(COPIED_TOP_BAR_TITLE)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-primary font-bold transition-colors hover:text-primary/80 active:scale-95" type="button" aria-label={t('nav.notifications')}>
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </div>
    </header>
  );
}

import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';
import { COPIED_PAGE_TITLES, type CopiedBottomNavTab } from '../utils/copiedBottomNav';

type CopiedPageTitleProps = {
  activeTab: CopiedBottomNavTab;
};

export default function CopiedPageTitle({ activeTab }: CopiedPageTitleProps) {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  return (
    <section className="copied-shared-page-title relative z-10 px-margin-page pt-20 pb-2">
      <h2 className="text-headline-md font-headline-md text-on-surface">{t(COPIED_PAGE_TITLES[activeTab])}</h2>
    </section>
  );
}

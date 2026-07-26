import { useNavigate } from 'react-router-dom';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { useCatalogSourceStore } from '../store/catalogSource';
import { useUserStore } from '../store/user';

export default function Home() {
  const navigate = useNavigate();
  const activeLocale = useUserStore((state) => state.activeLocale);
  const itemCount = useCartStore((state) => state.itemCount);
  const selectedSource = useCatalogSourceStore((state) => state.selectedSource);
  const { t } = useI18n(activeLocale);
  const selectedSourceLabel = selectedSource?.type === 'local_point' ? selectedSource.name : t('catalogSelector.inpost');
  const catalogTarget = selectedSource ? '/products' : '/catalog-selector';

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="home" />
      <div className="copied-home-shell font-body-md text-body-md min-h-screen pb-24 selection:bg-primary/30">
        <main className="pt-2 px-margin-page space-y-stack-lg relative overflow-hidden">
          <section className="relative z-10 space-y-1">
            <div className="home-title-row">
              <h2 className="text-headline-md font-headline-md text-on-surface">
                {t('home.greeting').replace('{name}', 'paranoia')}
              </h2>
              <button className="home-source-pill" type="button" onClick={() => navigate('/catalog-selector')}>
                <span className="material-symbols-outlined">location_on</span>
                <span>
                  {selectedSource
                    ? t('catalogSelector.homeSelectedSource').replace('{source}', selectedSourceLabel)
                    : t('catalogSelector.homeChooseSource')}
                </span>
              </button>
            </div>
            <p className="text-body-md font-body-md text-on-surface-variant">{t('home.searchPrompt')}</p>
          </section>

          <section className="grid grid-cols-2 gap-stack-md relative z-10">
            <button className="home-action-card active-scale" type="button" onClick={() => navigate(catalogTarget)}>
              <div className="home-action-icon">
                <span className="material-symbols-outlined text-primary">location_on</span>
              </div>
              <span>
                <strong>{t('home.pickupTitle')}</strong>
                <small>{t('home.pickupDescription')}</small>
              </span>
            </button>

            <button className="home-action-card active-scale" type="button" onClick={() => navigate(catalogTarget)}>
              <div className="home-action-icon">
                <span className="material-symbols-outlined text-primary">package</span>
              </div>
              <span>
                <strong>{t('home.deliveryTitle')}</strong>
                <small>{t('home.deliveryDescription')}</small>
              </span>
            </button>
          </section>

          <section className="space-y-stack-md relative z-10">
            <div className="flex justify-between items-end">
              <h2 className="text-label-lg font-label-lg text-on-surface uppercase tracking-wider">
                {t('home.categories')}
              </h2>
              <button className="text-label-sm font-label-sm text-primary" type="button" onClick={() => navigate(catalogTarget)}>
                {t('home.allCategories')}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-stack-md">
              {[
                ['water_drop', 'catalog.categories.liquids'],
                ['vaping_rooms', 'catalog.categories.pods'],
                ['air', 'catalog.categories.disposables'],
              ].map(([icon, labelKey]) => (
                <button key={labelKey} className="home-category-card active-scale" type="button" onClick={() => navigate(catalogTarget)}>
                  <span className="material-symbols-outlined text-[32px]">{icon}</span>
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="relative z-10">
            <button className="home-promo-card active-scale" type="button" onClick={() => navigate(catalogTarget)}>
              <div className="home-promo-icon">
                <span className="material-symbols-outlined">sell</span>
              </div>
              <span>
                <strong>{t('home.newArrivalsTitle')}</strong>
                <small>{t('home.newArrivalsDescription')}</small>
              </span>
              <span className="material-symbols-outlined text-primary">chevron_right</span>
            </button>
          </section>

          <section className="space-y-stack-md relative z-10">
            <h2 className="text-label-lg font-label-lg text-on-surface uppercase tracking-wider">{t('home.popular')}</h2>
            <button className="home-source-empty active-scale" type="button" onClick={() => navigate(catalogTarget)}>
              <span className="material-symbols-outlined">{selectedSource ? 'grid_view' : 'location_on'}</span>
              <strong>
                {selectedSource
                  ? t('catalogSelector.homeOpenSelectedCatalog').replace('{source}', selectedSourceLabel)
                  : t('catalogSelector.homeSelectSourcePrompt')}
              </strong>
            </button>
          </section>
        </main>
      </div>
      <CopiedBottomNav activeTab="home" cartCount={itemCount()} />
    </>
  );
}

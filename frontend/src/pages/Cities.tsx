import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type City } from '../api/client';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import Icon from '../components/Icon';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { useUserStore } from '../store/user';

export default function Cities() {
  const navigate = useNavigate();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const itemCount = useCartStore((state) => state.itemCount);
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  useEffect(() => {
    api.catalog.cities().then(setCities).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="catalog" />
      <div className="copied-catalog-shell dark overflow-x-hidden">
        <main className="copied-selection-main">
          <button className="back-btn" onClick={() => navigate('/')} aria-label={t('common.back')}><Icon name="chevronLeft" /></button>
          <section className="copied-selection-heading">
            <h1>{t('cities.title')}</h1>
            <p>{t('cities.subtitle')}</p>
          </section>
          {loading && <div className="spinner" />}
          {!loading && cities.length === 0 && (
            <div className="empty-state">
              <div className="empty-visual"><Icon name="mapPin" size={34} /></div>
              <h3>{t('cities.emptyTitle')}</h3>
              <p>{t('cities.emptyDescription')}</p>
            </div>
          )}
          <div className="copied-selection-list">
            {cities.map((city) => (
              <button key={city.id} className="copied-selection-card" onClick={() => navigate(`/cities/${city.id}/locations`)}>
                <Icon name="mapPin" />
                <span><strong>{city.name}</strong><small>{t('cities.viewLocations')}</small></span>
                <Icon name="chevronRight" />
              </button>
            ))}
          </div>
        </main>
      </div>
      <CopiedBottomNav activeTab="catalog" cartCount={itemCount()} />
    </>
  );
}

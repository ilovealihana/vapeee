import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type City } from '../api/client';
import Icon from '../components/Icon';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';

export default function Cities() {
  const navigate = useNavigate();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  useEffect(() => {
    api.catalog.cities().then(setCities).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}><Icon name="chevronLeft" /></button>
        <div>
          <h1 className="page-title">{t('cities.title')}</h1>
          <p className="page-subtitle">{t('cities.subtitle')}</p>
        </div>
      </div>
      <div className="container">
        {loading && <div className="spinner" />}
        {!loading && cities.length === 0 && (
          <div className="empty-state">
            <div className="empty-visual"><Icon name="mapPin" size={34} /></div>
            <h3>{t('cities.emptyTitle')}</h3>
            <p>{t('cities.emptyDescription')}</p>
          </div>
        )}
        <div style={{ display: 'grid', gap: 12 }}>
          {cities.map((city) => (
            <button key={city.id} className="card" onClick={() => navigate(`/cities/${city.id}/locations`)}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 14, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}>
              <Icon name="mapPin" />
              <span><strong>{city.name}</strong><br /><span className="muted">{t('cities.viewLocations')}</span></span>
              <Icon name="chevronRight" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Location } from '../api/client';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import Icon from '../components/Icon';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { useUserStore } from '../store/user';

function formatLastSold(dateStr: string | undefined, t: (key: string) => string): string {
  if (!dateStr) return t('locations.noSalesYet');
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return t('locations.lessThanHourAgo');
  if (h < 24) return t('locations.hoursAgo').replace('{count}', String(h));
  return t('locations.daysAgo').replace('{count}', String(Math.floor(h / 24)));
}

export default function Locations() {
  const { cityId } = useParams<{ cityId: string }>();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const itemCount = useCartStore((state) => state.itemCount);
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  useEffect(() => {
    if (cityId) {
      api.catalog.locations(Number(cityId)).then(setLocations).finally(() => setLoading(false));
    }
  }, [cityId]);

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="catalog" />
      <div className="copied-catalog-shell dark overflow-x-hidden">
        <main className="copied-selection-main">
          <button className="back-btn" onClick={() => navigate('/cities')} aria-label={t('common.back')}><Icon name="chevronLeft" /></button>
          <section className="copied-selection-heading">
            <h1>{t('locations.title')}</h1>
            <p>{t('locations.subtitle')}</p>
          </section>
          {loading && <div className="spinner" />}
          <div className="copied-selection-list">
            {locations.map((loc) => (
              <button key={loc.id} className="copied-selection-card copied-location-card" onClick={() => setSelected(loc)}>
                <span>
                  <strong>{loc.name}</strong>
                  <small>{loc.address}</small>
                  <small>{t('locations.lastSale')}: {formatLastSold(loc.stock_summary?.last_sold, t)}</small>
                </span>
                <span className="tag tag-accent">{loc.stock_summary?.total_qty ?? 0} {t('common.piecesShort')}</span>
              </button>
            ))}
          </div>
        </main>
      </div>

      {selected && (
        <div className="bottom-sheet-overlay" onClick={() => setSelected(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>{selected.name}</h2>
            <p className="muted" style={{ marginBottom: 20 }}>{selected.address}</p>
            <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div><span className="muted">{t('locations.stock')}</span><br /><strong>{selected.stock_summary?.total_qty ?? 0} {t('common.piecesShort')}</strong></div>
              <div><span className="muted">{t('locations.activity')}</span><br /><strong>{formatLastSold(selected.stock_summary?.last_sold, t)}</strong></div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate(`/locations/${selected.id}/products`, { state: { cityId } })}>
              {t('locations.openCatalog')}
            </button>
            {selected.curator_tg_username && (
              <a className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} href={`https://t.me/${selected.curator_tg_username}`}>
                {t('locations.contactManager')}
              </a>
            )}
          </div>
        </div>
      )}
      <CopiedBottomNav activeTab="catalog" cartCount={itemCount()} />
    </>
  );
}

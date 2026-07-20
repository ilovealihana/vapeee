import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Location } from '../api/client';
import Icon from '../components/Icon';
import { useI18n } from '../i18n';
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
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  useEffect(() => {
    if (cityId) {
      api.catalog.locations(Number(cityId)).then(setLocations).finally(() => setLoading(false));
    }
  }, [cityId]);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/cities')}><Icon name="chevronLeft" /></button>
        <div>
          <h1 className="page-title">{t('locations.title')}</h1>
          <p className="page-subtitle">{t('locations.subtitle')}</p>
        </div>
      </div>
      <div className="container">
        {loading && <div className="spinner" />}
        <div style={{ display: 'grid', gap: 12 }}>
          {locations.map((loc) => (
            <button key={loc.id} className="card" onClick={() => setSelected(loc)} style={{ textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                <div>
                  <h2 style={{ fontSize: 18 }}>{loc.name}</h2>
                  <p className="muted" style={{ marginTop: 4 }}>{loc.address}</p>
                </div>
                <span className="tag tag-accent">{loc.stock_summary?.total_qty ?? 0} {t('common.piecesShort')}</span>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>{t('locations.lastSale')}: {formatLastSold(loc.stock_summary?.last_sold, t)}</p>
            </button>
          ))}
        </div>
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
            <button className="btn btn-primary" onClick={() => navigate(`/locations/${selected.id}/products`)}>
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
    </div>
  );
}

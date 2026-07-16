import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Location } from '../api/client';

function formatLastSold(dateStr?: string): string {
  if (!dateStr) return 'нет данных';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'менее часа назад';
  if (h < 24) return `${h}ч назад`;
  return `${Math.floor(h / 24)}д назад`;
}

export default function Locations() {
  const { cityId } = useParams<{ cityId: string }>();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cityId) {
      api.catalog.locations(Number(cityId))
        .then(setLocations)
        .finally(() => setLoading(false));
    }
  }, [cityId]);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/cities')}>←</button>
        <h1 className="page-title">Точки</h1>
      </div>
      <div className="accent-line" style={{ margin: '0 16px 16px' }} />

      <div className="container">
        {loading && <div className="spinner" />}
        {locations.map((loc) => (
          <div key={loc.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(loc)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>🏪 {loc.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>📍 {loc.address}</div>
              </div>
              <span className="tag tag-accent">
                {loc.stock_summary?.total_qty ?? 0} шт.
              </span>
            </div>
            {loc.description && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>{loc.description}</div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ⏱ Последняя продажа: {formatLastSold(loc.stock_summary?.last_sold)}
            </div>
          </div>
        ))}
      </div>

      {/* Location detail bottom sheet */}
      {selected && (
        <div className="bottom-sheet-overlay" onClick={() => setSelected(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{selected.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>📍 {selected.address}</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div className="card" style={{ flex: 1, textAlign: 'center', margin: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-2)' }}>
                  {selected.stock_summary?.total_qty ?? 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>позиций в наличии</div>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center', margin: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {formatLastSold(selected.stock_summary?.last_sold)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>последняя продажа</div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ marginBottom: 10 }}
              onClick={() => navigate(`/locations/${selected.id}/products`)}
            >
              🛍 Смотреть ассортимент
            </button>

            {selected.curator_tg_username && (
              <a
                href={`https://t.me/${selected.curator_tg_username}`}
                className="btn btn-secondary"
                style={{ display: 'flex', textDecoration: 'none' }}
              >
                💬 Связаться с куратором
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

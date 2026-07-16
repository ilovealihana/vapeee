import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type City } from '../api/client';

export default function Cities() {
  const navigate = useNavigate();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.catalog.cities().then(setCities).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1 className="page-title">Города</h1>
      </div>
      <div className="accent-line" style={{ margin: '0 16px 16px' }} />

      <div className="container">
        {loading && <div className="spinner" />}
        {!loading && cities.length === 0 && (
          <div className="empty-state">
            <div className="icon">🏙</div>
            <h3>Нет доступных городов</h3>
            <p>Скоро откроемся в вашем городе!</p>
          </div>
        )}
        {cities.map((city) => (
          <button
            key={city.id}
            className="card"
            onClick={() => navigate(`/cities/${city.id}/locations`)}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <span style={{ fontSize: 32 }}>🌆</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{city.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Посмотреть точки →</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

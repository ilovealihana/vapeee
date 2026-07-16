import { useEffect, useState } from 'react';
import { adminApi, type AdminCity, type AdminLocation } from '../../api/admin';

function Modal({ title, onClose, children }: any) {
  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function AdminCities() {
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [locations, setLocations] = useState<Record<number, AdminLocation[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // City modal
  const [showCityModal, setShowCityModal] = useState(false);
  const [editCity, setEditCity] = useState<AdminCity | null>(null);
  const [cityForm, setCityForm] = useState({ name: '', slug: '' });

  // Location modal
  const [showLocModal, setShowLocModal] = useState(false);
  const [locCityId, setLocCityId] = useState<number>(0);
  const [editLoc, setEditLoc] = useState<AdminLocation | null>(null);
  const [locForm, setLocForm] = useState({ name: '', address: '', description: '', curator_tg_username: '' });

  const load = async () => {
    setLoading(true);
    try { setCities(await adminApi.getCities()); } catch(e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadLocations = async (cityId: number) => {
    try {
      const locs = await adminApi.getLocations(cityId);
      setLocations(prev => ({ ...prev, [cityId]: locs }));
    } catch {}
  };

  const toggleCity = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!locations[id]) await loadLocations(id);
  };

  const saveCity = async () => {
    try {
      if (editCity) {
        await adminApi.updateCity(editCity.id, cityForm);
      } else {
        await adminApi.createCity({ ...cityForm });
      }
      setShowCityModal(false); setEditCity(null);
      setCityForm({ name: '', slug: '' });
      await load();
    } catch (e: any) { setError(e.message); }
  };

  const deleteCity = async (id: number) => {
    if (!confirm('Удалить город?')) return;
    try { await adminApi.deleteCity(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const saveLoc = async () => {
    try {
      if (editLoc) {
        await adminApi.updateLocation(editLoc.id, locForm);
      } else {
        await adminApi.createLocation(locCityId, locForm);
      }
      setShowLocModal(false); setEditLoc(null);
      setLocForm({ name: '', address: '', description: '', curator_tg_username: '' });
      await loadLocations(locCityId);
    } catch (e: any) { setError(e.message); }
  };

  const deleteLoc = async (id: number, cityId: number) => {
    if (!confirm('Удалить точку?')) return;
    try { await adminApi.deleteLocation(id); await loadLocations(cityId); } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="container" style={{ paddingTop: 16 }}>
      {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

      <button
        className="btn btn-primary"
        style={{ marginBottom: 16 }}
        onClick={() => { setEditCity(null); setCityForm({ name: '', slug: '' }); setShowCityModal(true); }}
      >
        ➕ Добавить город
      </button>

      {loading && <div className="spinner" />}

      {cities.map(city => (
        <div key={city.id} className="card" style={{ marginBottom: 8 }}>
          {/* City row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleCity(city.id)}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {expanded === city.id ? '▼' : '▶'} 🌆 {city.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {city.slug} · {city.is_active ? '✅ активен' : '❌ скрыт'}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={() => { setEditCity(city); setCityForm({ name: city.name, slug: city.slug }); setShowCityModal(true); }}
            >✏️</button>
            <button
              className="btn btn-danger"
              style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={() => deleteCity(city.id)}
            >🗑</button>
          </div>

          {/* Locations */}
          {expanded === city.id && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px', marginBottom: 10 }}
                onClick={() => { setLocCityId(city.id); setEditLoc(null); setLocForm({ name: '', address: '', description: '', curator_tg_username: '' }); setShowLocModal(true); }}
              >➕ Добавить точку</button>

              {(locations[city.id] || []).map(loc => (
                <div key={loc.id} style={{
                  background: 'var(--surface-2)', borderRadius: 8,
                  padding: '10px 12px', marginBottom: 8, display: 'flex', gap: 8,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>🏪 {loc.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loc.address}</div>
                    {loc.curator_tg_username && (
                      <div style={{ fontSize: 12, color: 'var(--accent-2)' }}>@{loc.curator_tg_username}</div>
                    )}
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                    onClick={() => { setLocCityId(city.id); setEditLoc(loc); setLocForm({ name: loc.name, address: loc.address, description: loc.description || '', curator_tg_username: loc.curator_tg_username || '' }); setShowLocModal(true); }}
                  >✏️</button>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                    onClick={() => deleteLoc(loc.id, city.id)}
                  >🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* City modal */}
      {showCityModal && (
        <Modal title={editCity ? 'Редактировать город' : 'Новый город'} onClose={() => setShowCityModal(false)}>
          <div className="input-group">
            <label className="input-label">Название</label>
            <input className="input" value={cityForm.name} onChange={e => setCityForm(f => ({ ...f, name: e.target.value }))} placeholder="Wrocław" />
          </div>
          <div className="input-group">
            <label className="input-label">Slug (латиница)</label>
            <input className="input" value={cityForm.slug} onChange={e => setCityForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="wroclaw" />
          </div>
          <button className="btn btn-primary" onClick={saveCity}>Сохранить</button>
        </Modal>
      )}

      {/* Location modal */}
      {showLocModal && (
        <Modal title={editLoc ? 'Редактировать точку' : 'Новая точка'} onClose={() => setShowLocModal(false)}>
          <div className="input-group">
            <label className="input-label">Название</label>
            <input className="input" value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} placeholder="Centrum" />
          </div>
          <div className="input-group">
            <label className="input-label">Адрес</label>
            <input className="input" value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} placeholder="ul. Świdnicka 1" />
          </div>
          <div className="input-group">
            <label className="input-label">Описание (опционально)</label>
            <input className="input" value={locForm.description} onChange={e => setLocForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Куратор @username (без @)</label>
            <input className="input" value={locForm.curator_tg_username} onChange={e => setLocForm(f => ({ ...f, curator_tg_username: e.target.value }))} placeholder="curator_name" />
          </div>
          <button className="btn btn-primary" onClick={saveLoc}>Сохранить</button>
        </Modal>
      )}
    </div>
  );
}

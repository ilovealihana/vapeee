import { useEffect, useState } from 'react';
import { adminApi, type StockRow } from '../../api/admin';

export default function AdminStock() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [edited, setEdited] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try { setRows(await adminApi.getStock()); } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const key = (r: StockRow) => `${r.location_id}_${r.variant_id}`;
  const qty = (r: StockRow) => edited[key(r)] ?? r.quantity;

  const saveAll = async () => {
    setSaving(true);
    const items = rows
      .filter(r => edited[key(r)] !== undefined)
      .map(r => ({ location_id: r.location_id, variant_id: r.variant_id, quantity: edited[key(r)] }));
    try {
      await adminApi.updateStock(items);
      setEdited({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const filtered = rows.filter(r =>
    r.product_name.toLowerCase().includes(search.toLowerCase()) ||
    r.variant_name.toLowerCase().includes(search.toLowerCase()) ||
    r.city_name.toLowerCase().includes(search.toLowerCase()) ||
    r.location_name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, row) => {
    const k = `${row.city_name} — ${row.location_name}`;
    if (!acc[k]) acc[k] = [];
    acc[k].push(row);
    return acc;
  }, {} as Record<string, StockRow[]>);

  const hasChanges = Object.keys(edited).length > 0;

  return (
    <div className="container" style={{ paddingTop: 16 }}>
      {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}
      {success && <p style={{ color: 'var(--success)', marginBottom: 12 }}>✅ Остатки обновлены!</p>}

      <input
        className="input"
        placeholder="🔍 Поиск по товару, городу, точке..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {hasChanges && (
        <button className="btn btn-primary" style={{ marginBottom: 12 }} onClick={saveAll} disabled={saving}>
          {saving ? '⏳ Сохраняю...' : `💾 Сохранить изменения (${Object.keys(edited).length})`}
        </button>
      )}

      {loading && <div className="spinner" />}

      {Object.entries(grouped).map(([groupName, groupRows]) => (
        <div key={groupName} className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: 'var(--accent-2)' }}>
            📍 {groupName}
          </div>
          {groupRows.map(row => (
            <div key={key(row)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.product_name}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.variant_name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setEdited(e => ({ ...e, [key(row)]: Math.max(0, qty(row) - 1) }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 16 }}
                >−</button>
                <input
                  type="number"
                  min={0}
                  value={qty(row)}
                  onChange={e => setEdited(ev => ({ ...ev, [key(row)]: Number(e.target.value) }))}
                  style={{
                    width: 52, textAlign: 'center', background: 'var(--surface-2)',
                    border: `1px solid ${edited[key(row)] !== undefined ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6, color: 'var(--text)', padding: '4px 0', fontSize: 15, fontWeight: 700,
                  }}
                />
                <button
                  onClick={() => setEdited(e => ({ ...e, [key(row)]: qty(row) + 1 }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16 }}
                >+</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="icon">📊</div>
          <h3>Нет остатков</h3>
          <p>Сначала добавь товары и точки,<br/>потом их можно будет связать здесь.</p>
        </div>
      )}
    </div>
  );
}

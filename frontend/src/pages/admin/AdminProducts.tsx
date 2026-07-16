import { useEffect, useState } from 'react';
import { adminApi, type AdminProduct, type AdminVariant } from '../../api/admin';

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

const emptyProduct = { name_ru: '', name_pl: '', name_uk: '', base_price: '', description_ru: '' };
const emptyVariant = { name_ru: '', name_pl: '', name_uk: '', price_override: '' };

export default function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [showProdModal, setShowProdModal] = useState(false);
  const [editProd, setEditProd] = useState<AdminProduct | null>(null);
  const [prodForm, setProdForm] = useState(emptyProduct);

  const [showVarModal, setShowVarModal] = useState(false);
  const [varProductId, setVarProductId] = useState(0);
  const [editVar, setEditVar] = useState<AdminVariant | null>(null);
  const [varForm, setVarForm] = useState(emptyVariant);

  const load = async () => {
    setLoading(true);
    try { setProducts(await adminApi.getProducts()); } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveProd = async () => {
    try {
      if (editProd) {
        await adminApi.updateProduct(editProd.id, { ...prodForm, base_price: prodForm.base_price as any });
      } else {
        await adminApi.createProduct(prodForm as any);
      }
      setShowProdModal(false); setProdForm(emptyProduct); setEditProd(null);
      await load();
    } catch (e: any) { setError(e.message); }
  };

  const deleteProd = async (id: number) => {
    if (!confirm('Скрыть товар?')) return;
    try { await adminApi.deleteProduct(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const saveVar = async () => {
    try {
      const data = { ...varForm, price_override: varForm.price_override || undefined };
      if (editVar) {
        await adminApi.updateVariant(editVar.id, data as any);
      } else {
        await adminApi.createVariant(varProductId, data as any);
      }
      setShowVarModal(false); setVarForm(emptyVariant); setEditVar(null);
      await load();
    } catch (e: any) { setError(e.message); }
  };

  const deleteVar = async (id: number) => {
    if (!confirm('Удалить вариант?')) return;
    try { await adminApi.deleteVariant(id); await load(); } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="container" style={{ paddingTop: 16 }}>
      {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

      <button
        className="btn btn-primary"
        style={{ marginBottom: 16 }}
        onClick={() => { setEditProd(null); setProdForm(emptyProduct); setShowProdModal(true); }}
      >➕ Добавить товар</button>

      {loading && <div className="spinner" />}

      {products.map(prod => (
        <div key={prod.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(expanded === prod.id ? null : prod.id)}>
              <div style={{ fontWeight: 700 }}>
                {expanded === prod.id ? '▼' : '▶'} {prod.name_ru}
                {!prod.is_active && <span style={{ color: 'var(--danger)', fontSize: 12, marginLeft: 6 }}>скрыт</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--accent-2)' }}>{Number(prod.base_price).toFixed(2)} zł · {prod.variants.length} вар.</div>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              onClick={() => { setEditProd(prod); setProdForm({ name_ru: prod.name_ru, name_pl: prod.name_pl, name_uk: prod.name_uk, base_price: prod.base_price, description_ru: prod.description_ru || '' }); setShowProdModal(true); }}>✏️</button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              onClick={() => deleteProd(prod.id)}>🗑</button>
          </div>

          {expanded === prod.id && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px', marginBottom: 8 }}
                onClick={() => { setVarProductId(prod.id); setEditVar(null); setVarForm(emptyVariant); setShowVarModal(true); }}>
                ➕ Добавить вкус/цвет
              </button>
              {prod.variants.map(v => (
                <div key={v.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name_ru}</div>
                    {v.price_override && <div style={{ fontSize: 12, color: 'var(--accent-2)' }}>{Number(v.price_override).toFixed(2)} zł</div>}
                  </div>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                    onClick={() => { setVarProductId(prod.id); setEditVar(v); setVarForm({ name_ru: v.name_ru, name_pl: v.name_pl, name_uk: v.name_uk, price_override: v.price_override || '' }); setShowVarModal(true); }}>✏️</button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                    onClick={() => deleteVar(v.id)}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {showProdModal && (
        <Modal title={editProd ? 'Редактировать товар' : 'Новый товар'} onClose={() => setShowProdModal(false)}>
          {(['name_ru', 'name_pl', 'name_uk'] as const).map(f => (
            <div key={f} className="input-group">
              <label className="input-label">{f === 'name_ru' ? 'Название RU' : f === 'name_pl' ? 'Название PL' : 'Название UK'}</label>
              <input className="input" value={prodForm[f as keyof typeof prodForm]} onChange={e => setProdForm(p => ({ ...p, [f]: e.target.value }))} />
            </div>
          ))}
          <div className="input-group">
            <label className="input-label">Цена (zł)</label>
            <input className="input" type="number" step="0.01" value={prodForm.base_price} onChange={e => setProdForm(p => ({ ...p, base_price: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Описание RU (опционально)</label>
            <textarea className="input" rows={2} style={{ resize: 'none' }} value={prodForm.description_ru} onChange={e => setProdForm(p => ({ ...p, description_ru: e.target.value }))} />
          </div>
          <button className="btn btn-primary" onClick={saveProd}>Сохранить</button>
        </Modal>
      )}

      {showVarModal && (
        <Modal title={editVar ? 'Редактировать вариант' : 'Новый вкус/цвет'} onClose={() => setShowVarModal(false)}>
          {(['name_ru', 'name_pl', 'name_uk'] as const).map(f => (
            <div key={f} className="input-group">
              <label className="input-label">{f === 'name_ru' ? 'Название RU' : f === 'name_pl' ? 'PL' : 'UK'}</label>
              <input className="input" value={varForm[f as keyof typeof varForm]} onChange={e => setVarForm(v => ({ ...v, [f]: e.target.value }))} />
            </div>
          ))}
          <div className="input-group">
            <label className="input-label">Цена (если отличается от базовой)</label>
            <input className="input" type="number" step="0.01" value={varForm.price_override} onChange={e => setVarForm(v => ({ ...v, price_override: e.target.value }))} placeholder="оставь пустым = базовая цена" />
          </div>
          <button className="btn btn-primary" onClick={saveVar}>Сохранить</button>
        </Modal>
      )}
    </div>
  );
}

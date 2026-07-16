import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Category, type Product } from '../api/client';

export default function Products() {
  const navigate = useNavigate();
  const { locationId } = useParams<{ locationId?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const lang = 'ru';

  const PAGE_SIZE = 20;

  useEffect(() => {
    api.catalog.categories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.catalog.products({ category_id: activeCat, page })
      .then((data) => {
        setProducts(data);
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
      });
  }, [activeCat, page]);

  const getName = (p: Product) =>
    lang === 'ru' ? p.name_ru : lang === 'pl' ? p.name_pl : p.name_uk;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1 className="page-title">Каталог</h1>
      </div>
      <div className="accent-line" style={{ margin: '0 16px 8px' }} />

      {/* Category filter */}
      <div className="chip-row">
        <div
          className={`chip ${activeCat === undefined ? 'active' : ''}`}
          onClick={() => { setActiveCat(undefined); setPage(0); }}
        >
          Все
        </div>
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`chip ${activeCat === cat.id ? 'active' : ''}`}
            onClick={() => { setActiveCat(cat.id); setPage(0); }}
          >
            {lang === 'ru' ? cat.name_ru : cat.name_pl}
          </div>
        ))}
      </div>

      <div className="container" style={{ paddingTop: 12 }}>
        {loading && <div className="spinner" />}

        {!loading && products.length === 0 && (
          <div className="empty-state">
            <div className="icon">🔍</div>
            <h3>Товары не найдены</h3>
          </div>
        )}

        {/* Product grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => navigate(`/products/${product.id}`, { state: { locationId } })}
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Product image placeholder */}
              <div style={{
                aspectRatio: '1',
                background: 'linear-gradient(135deg, #1a0a2e, #1a1a1a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
              }}>
                {product.image_file_id ? (
                  <span style={{ fontSize: 32 }}>🖼</span>
                ) : '💨'}
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>
                  {getName(product)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="price-small">{Number(product.base_price).toFixed(2)} zł</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {product.variants.length} вкус{product.variants.length !== 1 ? 'а' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {page > 0 && (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPage(p => p - 1)}>
              ← Назад
            </button>
          )}
          {hasMore && (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPage(p => p + 1)}>
              Ещё →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

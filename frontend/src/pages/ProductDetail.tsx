import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, type Product, type Variant } from '../api/client';
import { useCartStore } from '../store/cart';

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const locationId = state?.locationId;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const { addItem } = useCartStore();
  const lang = 'ru';

  useEffect(() => {
    if (productId) {
      api.catalog.product(Number(productId)).then((p) => {
        setProduct(p);
        if (p.variants.length === 1) setSelectedVariant(p.variants[0]);
      });
    }
  }, [productId]);

  if (!product) return <div className="spinner" />;

  const getName = (field: 'name' | 'description') => {
    if (field === 'name') return lang === 'ru' ? product.name_ru : lang === 'pl' ? product.name_pl : product.name_uk;
    return lang === 'ru' ? product.description_ru : lang === 'pl' ? product.description_pl : product.description_uk;
  };

  const getVariantName = (v: Variant) =>
    lang === 'ru' ? v.name_ru : lang === 'pl' ? v.name_pl : v.name_uk;

  const price = selectedVariant?.price_override
    ? Number(selectedVariant.price_override)
    : Number(product.base_price);

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    setAdding(true);
    try {
      await addItem(selectedVariant.id, qty, locationId ? Number(locationId) : undefined);
      setAdded(true);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1 className="page-title" style={{ fontSize: 18 }}>{getName('name')}</h1>
      </div>

      {/* Product image */}
      <div style={{
        height: 240,
        background: 'linear-gradient(135deg, #1a0a2e 0%, #0d1a2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 80,
        marginBottom: 4,
      }}>
        💨
      </div>

      <div className="container" style={{ paddingTop: 16 }}>
        {/* Price & name */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{getName('name')}</h2>
          <span className="price">{(price * qty).toFixed(2)} zł</span>
          {qty > 1 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 8 }}>
              ({price.toFixed(2)} × {qty})
            </span>
          )}
        </div>

        {/* Description */}
        {getName('description') && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
            {getName('description')}
          </p>
        )}

        {/* Variant picker */}
        {product.variants.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Выбери вкус / цвет:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 20,
                    border: `1.5px solid ${selectedVariant?.id === v.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedVariant?.id === v.id ? 'rgba(124,58,237,0.15)' : 'var(--surface)',
                    color: selectedVariant?.id === v.id ? 'var(--accent)' : 'var(--text)',
                    fontWeight: selectedVariant?.id === v.id ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: 14,
                    transition: 'all 0.15s',
                  }}
                >
                  {getVariantName(v)}
                  {v.price_override && (
                    <span style={{ marginLeft: 6, color: 'var(--accent-2)', fontSize: 12 }}>
                      {Number(v.price_override).toFixed(0)} zł
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Количество:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--surface)', border: '1px solid var(--border)',
                fontSize: 20, cursor: 'pointer', color: 'var(--text)',
              }}
            >−</button>
            <span style={{ fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{qty}</span>
            <button
              onClick={() => setQty(q => q + 1)}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--accent)', border: 'none',
                fontSize: 20, cursor: 'pointer', color: '#fff',
              }}
            >+</button>
          </div>
        </div>

        {/* Add to cart */}
        <button
          className="btn btn-primary"
          onClick={handleAddToCart}
          disabled={!selectedVariant || adding}
          style={{
            marginBottom: 12,
            background: added ? 'var(--success)' : undefined,
            opacity: !selectedVariant ? 0.5 : 1,
          }}
        >
          {added ? '✅ Добавлено в корзину!' : adding ? '⏳...' : '🛒 В корзину'}
        </button>

        {!selectedVariant && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            Выбери вкус/цвет чтобы добавить в корзину
          </p>
        )}
      </div>
    </div>
  );
}

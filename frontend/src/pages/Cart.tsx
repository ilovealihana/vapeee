import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cart';

export default function Cart() {
  const navigate = useNavigate();
  const { cart, removeItem, updateItem, clearCart } = useCartStore();
  const lang = 'ru';

  const getVariantName = (item: any) => {
    if (!item.variant) return '?';
    return lang === 'ru' ? item.variant.name_ru : lang === 'pl' ? item.variant.name_pl : item.variant.name_uk;
  };

  const getProductName = (item: any) => {
    if (!item.product) return '';
    return lang === 'ru' ? item.product.name_ru : lang === 'pl' ? item.product.name_pl : item.product.name_uk;
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Корзина</h1>
        </div>
        <div className="empty-state">
          <div className="icon">🛒</div>
          <h3>Корзина пуста</h3>
          <p>Добавь товары из каталога</p>
          <button className="btn btn-primary" style={{ marginTop: 20, maxWidth: 200, margin: '20px auto 0' }}
            onClick={() => navigate('/products')}>
            Перейти в каталог
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Корзина</h1>
        <button
          className="btn-ghost btn"
          style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--danger)' }}
          onClick={clearCart}
        >
          Очистить
        </button>
      </div>
      <div className="accent-line" style={{ margin: '0 16px 12px' }} />

      <div className="container">
        {cart.items.map((item) => (
          <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 10,
              background: 'linear-gradient(135deg, #1a0a2e, #1a1a1a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, flexShrink: 0,
            }}>💨</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                {getProductName(item)}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {getVariantName(item)}
              </div>
              <div className="price-small" style={{ marginTop: 2 }}>
                {Number(item.subtotal || item.price || 0).toFixed(2)} zł
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => item.quantity > 1 ? updateItem(item.id, item.quantity - 1) : removeItem(item.id)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}
              >−</button>
              <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
              <button
                onClick={() => updateItem(item.id, item.quantity + 1)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff' }}
              >+</button>
            </div>
          </div>
        ))}

        {/* Total */}
        <div className="card" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Итого:</span>
            <span className="price">{Number(cart.total).toFixed(2)} zł</span>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={() => navigate('/checkout')}
        >
          Оформить заказ →
        </button>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/user';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const name = user?.first_name || 'Друг';

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a2e 0%, #0d0d0d 60%)',
        padding: '48px 20px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 52, marginBottom: 8 }}>💨</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, letterSpacing: -0.5 }}>
          VapeShop
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Привет, {name}! Что ищешь?
        </p>
      </div>

      <div className="container" style={{ paddingTop: 24 }}>
        {/* Main actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <button
            className="card"
            onClick={() => navigate('/cities')}
            style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Самовывоз</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Выбери точку в своём городе</div>
          </button>

          <button
            className="card"
            onClick={() => navigate('/products')}
            style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(124,58,237,0.4)' }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>InPost</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Доставка в постомат</div>
          </button>
        </div>

        {/* Categories quick access */}
        <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 14 }}>Категории</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { emoji: '💨', name: 'Жижи', q: '' },
            { emoji: '🔋', name: 'Поды', q: '' },
            { emoji: '✨', name: 'Одноразки', q: '' },
          ].map((cat) => (
            <button
              key={cat.name}
              onClick={() => navigate('/products')}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '14px 8px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>{cat.emoji}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{cat.name}</div>
            </button>
          ))}
        </div>

        {/* Promo banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <span style={{ fontSize: 32 }}>🎁</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Новые поступления!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Elf Bar, Lost Mary, Vozol и другие
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

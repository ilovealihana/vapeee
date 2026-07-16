import { useNavigate, useParams } from 'react-router-dom';

export default function OrderSuccess() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', padding: '20px' }}>
      <div style={{ fontSize: 80, marginBottom: 16, animation: 'none' }}>🎉</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Заказ принят!</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
        Заказ <strong style={{ color: 'var(--accent-2)' }}>#{orderId}</strong> успешно оформлен.
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
        Мы свяжемся с тобой для подтверждения. Спасибо за покупку! 😊
      </p>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 'var(--radius)',
        padding: '16px 24px',
        marginBottom: 32,
        width: '100%',
        maxWidth: 320,
      }}>
        <div style={{ color: 'var(--success)', fontWeight: 700, marginBottom: 4 }}>✅ Что дальше?</div>
        <ul style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'left', paddingLeft: 18, lineHeight: 2 }}>
          <li>Ждём подтверждения от менеджера</li>
          <li>Статус обновится в истории заказов</li>
          <li>Следи за уведомлениями в боте</li>
        </ul>
      </div>

      <button className="btn btn-primary" style={{ maxWidth: 280, marginBottom: 12 }} onClick={() => navigate('/')}>
        На главную
      </button>
      <button className="btn btn-secondary" style={{ maxWidth: 280 }} onClick={() => navigate('/profile', { state: { tab: 'orders' } })}>
        Мои заказы
      </button>
    </div>
  );
}

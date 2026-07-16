import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type CreateOrderRequest } from '../api/client';
import { useCartStore } from '../store/cart';

const STEPS = ['Доставка', 'Контакты', 'Дата и время', 'Оплата'];
const PAYMENT_METHODS = [
  { id: 'cash', icon: '💵', label: 'Наличные', desc: 'Оплата при получении' },
  { id: 'blik', icon: '⚡', label: 'Blik', desc: 'Быстрый перевод' },
  { id: 'monobank', icon: '💳', label: 'Monobank', desc: 'Украинская карта' },
];

const TIME_SLOTS = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
const DOOR_DELIVERY_COST = 15;

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first + 6) % 7;
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, fetchCart } = useCartStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    delivery_type: 'pickup' as 'pickup' | 'door_delivery',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_address: '',
    comment: '',
    payment_method: '',
    scheduled_date: '',
    scheduled_time: '',
  });

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const canNext = () => {
    if (step === 0) return !!form.delivery_type;
    if (step === 1) return form.customer_name && form.customer_phone && form.customer_email &&
      (form.delivery_type !== 'door_delivery' || form.delivery_address);
    if (step === 2) return form.scheduled_date && form.scheduled_time;
    if (step === 3) return !!form.payment_method;
    return false;
  };

  const handleSubmit = async () => {
    if (!cart) return;
    setSubmitting(true);
    setError('');
    try {
      const body: CreateOrderRequest = {
        delivery_type: form.delivery_type,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        delivery_address: form.delivery_type === 'door_delivery' ? form.delivery_address : undefined,
        location_id: cart.location_id || undefined,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
        payment_method: form.payment_method,
        comment: form.comment || undefined,
      };
      const order = await api.orders.create(body);
      await fetchCart();
      navigate(`/order-success/${order.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cells = buildCalendar(calYear, calMonth);
  const deliveryCost = form.delivery_type === 'door_delivery' ? DOOR_DELIVERY_COST : 0;
  const total = Number(cart?.total || 0) + deliveryCost;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/cart')}>←</button>
        <h1 className="page-title">Оформление</h1>
      </div>

      <div className="steps">
        {STEPS.map((_, i) => (
          <div key={i} className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
        ))}
      </div>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
        {STEPS[step]}
      </div>

      <div className="container">
        {step === 0 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Как получить заказ?</h2>
            {[
              { id: 'pickup', icon: '🏬', label: 'Самовывоз', desc: 'Забрать заказ в выбранной точке' },
              { id: 'door_delivery', icon: '🚚', label: 'Доставка к двери', desc: `+${DOOR_DELIVERY_COST} zł, менеджер привезет товар по адресу` },
            ].map((opt) => (
              <div
                key={opt.id}
                className="card"
                onClick={() => set('delivery_type', opt.id)}
                style={{
                  cursor: 'pointer',
                  border: `1.5px solid ${form.delivery_type === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.delivery_type === opt.id ? 'rgba(124,58,237,0.08)' : 'var(--surface)',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}
              >
                <span style={{ fontSize: 32 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{opt.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{opt.desc}</div>
                </div>
                {form.delivery_type === opt.id && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Контактные данные</h2>
            <div className="input-group">
              <label className="input-label">Имя *</label>
              <input className="input" placeholder="Алексей" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Телефон *</label>
              <input className="input" placeholder="+48 500 123 456" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} type="tel" />
            </div>
            <div className="input-group">
              <label className="input-label">Email *</label>
              <input className="input" placeholder="you@example.com" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} type="email" />
            </div>
            {form.delivery_type === 'door_delivery' && (
              <div className="input-group">
                <label className="input-label">Адрес доставки *</label>
                <input className="input" placeholder="ul. Przykladowa 1, m. 5, Wroclaw" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Дата и время</h2>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>←</button>
                <span style={{ fontWeight: 700 }}>{MONTHS[calMonth]} {calYear}</span>
                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>→</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', paddingBottom: 4 }}>{d}</div>)}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const isPast = new Date(calYear, calMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const isSelected = form.scheduled_date === dateStr;
                  return (
                    <button
                      key={i}
                      disabled={isPast}
                      onClick={() => set('scheduled_date', dateStr)}
                      style={{
                        aspectRatio: '1', borderRadius: 8, border: 'none', cursor: isPast ? 'default' : 'pointer',
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        color: isPast ? 'var(--border)' : isSelected ? '#fff' : 'var(--text)',
                        fontWeight: isSelected ? 700 : 400, fontSize: 14,
                      }}
                    >{day}</button>
                  );
                })}
              </div>
            </div>

            {form.scheduled_date && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Время:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {TIME_SLOTS.map(slot => (
                    <button
                      key={slot}
                      onClick={() => set('scheduled_time', slot)}
                      style={{
                        padding: '10px 4px', borderRadius: 8, border: `1px solid ${form.scheduled_time === slot ? 'var(--accent)' : 'var(--border)'}`,
                        background: form.scheduled_time === slot ? 'rgba(124,58,237,0.15)' : 'var(--surface)',
                        color: form.scheduled_time === slot ? 'var(--accent)' : 'var(--text)',
                        fontWeight: form.scheduled_time === slot ? 700 : 400,
                        cursor: 'pointer', fontSize: 14,
                      }}
                    >{slot}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="card" style={{ marginBottom: 16, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Итог заказа</div>
              {cart?.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 14 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {item.variant?.name_ru || '?'} × {item.quantity}
                  </span>
                  <span>{Number(item.subtotal || 0).toFixed(2)} zł</span>
                </div>
              ))}
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Доставка</span>
                <span>{deliveryCost > 0 ? `${deliveryCost} zł` : 'Бесплатно'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17 }}>
                <span>Итого</span>
                <span className="price">{total.toFixed(2)} zł</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                📅 {form.scheduled_date} в {form.scheduled_time}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Комментарий</label>
              <textarea
                className="input"
                placeholder="Например: позвонить за 30 минут"
                value={form.comment}
                onChange={e => set('comment', e.target.value)}
                rows={3}
                style={{ resize: 'none' }}
              />
            </div>

            <div style={{ fontWeight: 700, marginBottom: 10 }}>Способ оплаты:</div>
            {PAYMENT_METHODS.map(pm => (
              <div
                key={pm.id}
                className="card"
                onClick={() => set('payment_method', pm.id)}
                style={{
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  border: `1.5px solid ${form.payment_method === pm.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.payment_method === pm.id ? 'rgba(124,58,237,0.08)' : 'var(--surface)',
                }}
              >
                <span style={{ fontSize: 24 }}>{pm.icon}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{pm.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{pm.desc}</div>
                </div>
                {form.payment_method === pm.id && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
              </div>
            ))}

            {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 8 }}>{error}</p>}

            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              disabled={!canNext() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Оформляем...' : 'Подтвердить заказ'}
            </button>
          </div>
        )}

        {step < 3 && (
          <button
            className="btn btn-primary"
            style={{ marginTop: 24 }}
            disabled={!canNext()}
            onClick={() => setStep(s => s + 1)}
          >
            Далее
          </button>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatApiError } from '../api/errors';
import { api, type CreateOrderRequest } from '../api/client';
import Icon from '../components/Icon';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { useUserStore } from '../store/user';

const STEPS = [
  'checkout.steps.delivery',
  'checkout.steps.contacts',
  'checkout.steps.time',
  'checkout.steps.payment',
] as const;
const PAYMENT_METHODS = [
  { id: 'cash', labelKey: 'checkout.paymentMethods.cash.label', descKey: 'checkout.paymentMethods.cash.description' },
  { id: 'blik', labelKey: 'checkout.paymentMethods.blik.label', descKey: 'checkout.paymentMethods.blik.description' },
  { id: 'monobank', labelKey: 'checkout.paymentMethods.monobank.label', descKey: 'checkout.paymentMethods.monobank.description' },
] as const;
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
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
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
  const MONTHS = [
    t('checkout.months.january'),
    t('checkout.months.february'),
    t('checkout.months.march'),
    t('checkout.months.april'),
    t('checkout.months.may'),
    t('checkout.months.june'),
    t('checkout.months.july'),
    t('checkout.months.august'),
    t('checkout.months.september'),
    t('checkout.months.october'),
    t('checkout.months.november'),
    t('checkout.months.december'),
  ];
  const DAYS = [
    t('checkout.weekdays.mon'),
    t('checkout.weekdays.tue'),
    t('checkout.weekdays.wed'),
    t('checkout.weekdays.thu'),
    t('checkout.weekdays.fri'),
    t('checkout.weekdays.sat'),
    t('checkout.weekdays.sun'),
  ];
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const canNext = () => {
    if (step === 0) return !!form.delivery_type;
    if (step === 1) return form.customer_name && form.customer_phone && form.customer_email && (form.delivery_type !== 'door_delivery' || form.delivery_address);
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
      setError(formatApiError(e, t));
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
        <button className="back-btn" onClick={() => step > 0 ? setStep((s) => s - 1) : navigate('/cart')}><Icon name="chevronLeft" /></button>
        <div>
          <h1 className="page-title">{t('checkout.title')}</h1>
          <p className="page-subtitle">{t(STEPS[step])}</p>
        </div>
      </div>
      <div className="steps">{STEPS.map((_, i) => <div key={i} className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />)}</div>

      <div className="container">
        {step === 0 && (
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {[
              { id: 'pickup', icon: 'mapPin' as const, label: t('checkout.deliveryOptions.pickup.label'), desc: t('checkout.deliveryOptions.pickup.description') },
              { id: 'door_delivery', icon: 'truck' as const, label: t('checkout.deliveryOptions.door.label'), desc: t('checkout.deliveryOptions.door.description').replace('{cost}', String(DOOR_DELIVERY_COST)) },
            ].map((opt) => (
              <button key={opt.id} className="card" onClick={() => set('delivery_type', opt.id)} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 14, alignItems: 'center', textAlign: 'left',
                borderColor: form.delivery_type === opt.id ? 'var(--primary)' : 'var(--border)', cursor: 'pointer'
              }}>
                <Icon name={opt.icon} />
                <span><strong>{opt.label}</strong><br /><span className="muted">{opt.desc}</span></span>
                {form.delivery_type === opt.id && <Icon name="check" />}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div style={{ marginTop: 18 }}>
            <div className="input-group"><label className="input-label">{t('checkout.fields.name')}</label><input className="input" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
            <div className="input-group"><label className="input-label">{t('checkout.fields.phone')}</label><input className="input" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} type="text" placeholder="+48 500 123 456" /></div>
            <div className="input-group"><label className="input-label">{t('checkout.fields.email')}</label><input className="input" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} type="text" /></div>
            {form.delivery_type === 'door_delivery' && (
              <div className="input-group"><label className="input-label">{t('checkout.fields.deliveryAddress')}</label><input className="input" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} placeholder={t('checkout.placeholders.deliveryAddress')} /></div>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ marginTop: 18 }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <button className="icon-btn" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}><Icon name="chevronLeft" /></button>
                <strong>{MONTHS[calMonth]} {calYear}</strong>
                <button className="icon-btn" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}><Icon name="chevronRight" /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {DAYS.map(d => <div key={d} className="muted" style={{ textAlign: 'center', fontSize: 12 }}>{d}</div>)}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const isPast = new Date(calYear, calMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const isSelected = form.scheduled_date === dateStr;
                  return <button key={i} disabled={isPast} onClick={() => set('scheduled_date', dateStr)} className={isSelected ? 'btn btn-primary' : 'btn btn-ghost'} style={{ minHeight: 38, padding: 0 }}>{day}</button>;
                })}
              </div>
            </div>
            {form.scheduled_date && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
                {TIME_SLOTS.map(slot => <button key={slot} className={form.scheduled_time === slot ? 'btn btn-primary' : 'btn btn-secondary'} style={{ minHeight: 40, padding: 0 }} onClick={() => set('scheduled_time', slot)}>{slot}</button>)}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ marginTop: 18 }}>
            <div className="card">
              <h2 style={{ fontSize: 18, marginBottom: 14 }}>{t('checkout.summary.title')}</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span className="muted">{t('checkout.summary.products')}</span><span>{Number(cart?.total || 0).toFixed(2)} zł</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span className="muted">{t('checkout.summary.delivery')}</span><span>{deliveryCost ? `${deliveryCost} zł` : '0 zł'}</span></div>
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{t('checkout.summary.total')}</strong><span className="price">{total.toFixed(2)} zł</span></div>
            </div>
            <div className="section-heading"><h2>{t('checkout.payment')}</h2></div>
            {PAYMENT_METHODS.map(pm => (
              <button key={pm.id} className="card" onClick={() => set('payment_method', pm.id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer', borderColor: form.payment_method === pm.id ? 'var(--primary)' : 'var(--border)' }}>
                <span><strong>{t(pm.labelKey)}</strong><br /><span className="muted">{t(pm.descKey)}</span></span>
                {form.payment_method === pm.id && <Icon name="check" />}
              </button>
            ))}
            <div className="input-group" style={{ marginTop: 16 }}><label className="input-label">{t('checkout.fields.comment')}</label><textarea className="input" value={form.comment} onChange={e => set('comment', e.target.value)} /></div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary" disabled={!canNext() || submitting} onClick={handleSubmit}>{submitting ? t('checkout.submitting') : t('checkout.submit')}</button>
          </div>
        )}

        {step < 3 && <button className="btn btn-primary" style={{ marginTop: 24 }} disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>{t('checkout.continue')}</button>}
      </div>
    </div>
  );
}

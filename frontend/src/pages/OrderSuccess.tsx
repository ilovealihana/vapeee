import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';

export default function OrderSuccess() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  return (
    <div className="page">
      <div className="empty-state" style={{ paddingTop: 110 }}>
        <div className="empty-visual"><Icon name="check" size={38} /></div>
        <h3>{t('orderSuccess.title')}</h3>
        <p>{t('orderSuccess.description').replace('{orderId}', orderId ?? '')}</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 28 }}>
          <button className="btn btn-primary" onClick={() => navigate('/')}>{t('orderSuccess.home')}</button>
          <button className="btn btn-secondary" onClick={() => navigate('/profile', { state: { tab: 'orders' } })}>{t('orderSuccess.orders')}</button>
        </div>
      </div>
    </div>
  );
}

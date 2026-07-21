import { useEffect, useState } from 'react';
import { adminApi, type StockRow } from '../../api/admin';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';
import { AdminEmptyState, AdminPageHeader } from './AdminUI';

export default function AdminStock() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [edited, setEdited] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminApi.getStock());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const key = (row: StockRow) => `${row.location_id}_${row.variant_id}`;
  const qty = (row: StockRow) => edited[key(row)] ?? row.quantity;
  const editedCount = Object.keys(edited).length;

  const saveAll = async () => {
    setSaving(true);
    const items = rows
      .filter(row => edited[key(row)] !== undefined)
      .map(row => ({ location_id: row.location_id, variant_id: row.variant_id, quantity: edited[key(row)] }));

    try {
      await adminApi.updateStock(items);
      setEdited({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const filtered = rows.filter(row => [row.product_name, row.variant_name, row.city_name, row.location_name]
    .some(value => value.toLowerCase().includes(search.toLowerCase())));

  return (
    <section>
      <AdminPageHeader
        title={t('admin.stock.title')}
        subtitle={t('admin.stock.subtitle')}
        meta={<span>{t('admin.stock.meta').replace('{count}', String(filtered.length))}</span>}
      />

      <div className="admin-toolbar">
        <label className="admin-search-field">
          <Icon name="search" size={18} />
          <input
            className="input"
            placeholder={t('admin.stock.searchPlaceholder')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </label>
      </div>

      {error && <p className="admin-message admin-message-error">{error}</p>}
      {success && <p className="admin-message admin-message-success">{t('admin.stock.saved')}</p>}
      {loading && <div className="spinner" />}
      {!loading && filtered.length === 0 && <AdminEmptyState title={t('admin.stock.emptyTitle')} description={t('admin.stock.emptyDescription')} />}
      {!loading && filtered.length > 0 && (
        <div className="admin-cms-table">
          {filtered.map(row => (
            <div key={key(row)} className="admin-cms-row admin-stock-row">
              <span className="admin-cms-cell-main">
                <strong>{row.product_name}</strong>
                <span>{row.variant_name}</span>
              </span>
              <span>{row.city_name}</span>
              <span className="muted">{row.location_name}</span>
              <div className="admin-qty-control">
                <button className="admin-icon-button" type="button" onClick={() => setEdited(prev => ({ ...prev, [key(row)]: Math.max(0, qty(row) - 1) }))} aria-label={t('admin.stock.decreaseAria')}>
                  <Icon name="minus" size={16} />
                </button>
                <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" value={qty(row)} onChange={event => setEdited(prev => ({ ...prev, [key(row)]: Math.max(0, Number(event.target.value) || 0) }))} />
                <button className="admin-icon-button" type="button" onClick={() => setEdited(prev => ({ ...prev, [key(row)]: qty(row) + 1 }))} aria-label={t('admin.stock.increaseAria')}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editedCount > 0 && (
        <div className="admin-stock-savebar">
          <span>{t('admin.stock.unsavedChanges').replace('{count}', String(editedCount))}</span>
          <button className="admin-button admin-button-primary" type="button" onClick={saveAll} disabled={saving}>
            {saving ? t('admin.stock.saving') : t('admin.common.save')}
          </button>
        </div>
      )}
    </section>
  );
}

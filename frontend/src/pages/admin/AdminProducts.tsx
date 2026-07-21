import { useEffect, useState } from 'react';
import { adminApi, type AdminProduct, type AdminVariant } from '../../api/admin';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';
import { AdminConfirmDialog, AdminEmptyState, AdminModal, AdminPageHeader, AdminStatusBadge } from './AdminUI';

type ConfirmAction = {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
};

const emptyProduct = { name_ru: '', name_pl: '', name_uk: '', base_price: '', description_ru: '' };
const emptyVariant = { name_ru: '', name_pl: '', name_uk: '', price_override: '' };
const PRODUCT_NAME_FIELD_LABEL_KEYS = {
  name_ru: 'admin.fields.nameRu',
  name_pl: 'admin.fields.namePl',
  name_uk: 'admin.fields.nameUk',
} as const;

function withNameFallback<T extends { name_ru: string; name_pl: string; name_uk: string }>(data: T): T {
  const name = data.name_ru.trim();
  return {
    ...data,
    name_ru: name,
    name_pl: data.name_pl.trim() || name,
    name_uk: data.name_uk.trim() || name,
  };
}

export default function AdminProducts() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setProducts(await adminApi.getProducts());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveProd = async () => {
    try {
      const data = withNameFallback({ ...prodForm, base_price: prodForm.base_price as any });
      if (editProd) await adminApi.updateProduct(editProd.id, data);
      else {
        const product = await adminApi.createProduct(data);
        await adminApi.createVariant(product.id, {
          name_ru: data.name_ru,
          name_pl: data.name_pl,
          name_uk: data.name_uk,
        });
      }
      setShowProdModal(false);
      setProdForm(emptyProduct);
      setEditProd(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteProd = async (id: number) => {
    try {
      await adminApi.deleteProduct(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const saveVar = async () => {
    try {
      const data = withNameFallback({ ...varForm, price_override: varForm.price_override || undefined });
      if (editVar) await adminApi.updateVariant(editVar.id, data as any);
      else await adminApi.createVariant(varProductId, data as any);
      setShowVarModal(false);
      setVarForm(emptyVariant);
      setEditVar(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteVar = async (id: number) => {
    try {
      await adminApi.deleteVariant(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openProductModal = (product?: AdminProduct) => {
    setEditProd(product || null);
    setProdForm(product ? {
      name_ru: product.name_ru,
      name_pl: product.name_pl,
      name_uk: product.name_uk,
      base_price: product.base_price,
      description_ru: product.description_ru || '',
    } : emptyProduct);
    setShowProdModal(true);
  };

  const openVariantModal = (productId: number, variant?: AdminVariant) => {
    setVarProductId(productId);
    setEditVar(variant || null);
    setVarForm(variant ? {
      name_ru: variant.name_ru,
      name_pl: variant.name_pl,
      name_uk: variant.name_uk,
      price_override: variant.price_override || '',
    } : emptyVariant);
    setShowVarModal(true);
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    await confirmAction.onConfirm();
    setConfirmAction(null);
  };

  return (
    <section>
      <AdminPageHeader
        title={t('admin.products.title')}
        subtitle={t('admin.products.subtitle')}
        meta={<span>{t('admin.products.meta').replace('{count}', String(products.length))}</span>}
        actions={(
          <button className="admin-button admin-button-primary" type="button" onClick={() => openProductModal()}>
            <Icon name="plus" size={16} /> {t('admin.products.addProduct')}
          </button>
        )}
      />

      {error && <p className="admin-message admin-message-error">{error}</p>}
      {loading && <div className="spinner" />}
      {!loading && products.length === 0 && <AdminEmptyState title={t('admin.products.emptyTitle')} description={t('admin.products.emptyDescription')} />}
      {!loading && products.length > 0 && (
        <div className="admin-cms-table">
          {products.map(product => (
            <div key={product.id} className="admin-cms-group">
              <div className="admin-cms-row admin-product-row">
                <button className="admin-row-toggle" type="button" onClick={() => setExpanded(expanded === product.id ? null : product.id)}>
                  <span className="admin-cms-cell-main">
                    <strong>{product.name_ru}</strong>
                    <span>{product.name_pl || product.name_uk}</span>
                  </span>
                </button>
                <span className="price-small">{Number(product.base_price).toFixed(2)} zł</span>
                <span className="muted">{t('admin.products.variantsCount').replace('{count}', String(product.variants.length))}</span>
                <AdminStatusBadge status={product.is_active ? 'active' : 'hidden'} label={product.is_active ? t('admin.status.active') : t('admin.status.hidden')} />
                <div className="admin-row-actions">
                  <button className="admin-icon-button" type="button" onClick={() => openVariantModal(product.id)} aria-label={t('admin.products.addVariant')}>
                    <Icon name="plus" size={16} />
                  </button>
                  <button className="admin-icon-button" type="button" onClick={() => openProductModal(product)} aria-label={t('admin.products.editProductAria')}>
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    className="admin-icon-button admin-icon-button-danger"
                    type="button"
                    onClick={() => setConfirmAction({
                      title: t('admin.products.deleteProductTitle'),
                      message: t('admin.products.deleteProductMessage').replace('{name}', product.name_ru),
                      onConfirm: () => deleteProd(product.id),
                    })}
                    aria-label={t('admin.products.deleteProductAria')}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>

              {expanded === product.id && (
                <div className="admin-nested-list">
                  <div className="admin-nested-header">
                    <span>{t('admin.products.variantsHeading')}</span>
                    <button className="admin-button admin-button-secondary" type="button" onClick={() => openVariantModal(product.id)}>
                      <Icon name="plus" size={15} /> {t('admin.products.addVariant')}
                    </button>
                  </div>
                  {product.variants.length === 0 && <AdminEmptyState title={t('admin.products.variantsEmptyTitle')} description={t('admin.products.variantsEmptyDescription')} />}
                  {product.variants.map(variant => (
                    <div key={variant.id} className="admin-cms-row admin-variant-row">
                      <span className="admin-cms-cell-main">
                        <strong>{variant.name_ru}</strong>
                        <span>{variant.name_pl || variant.name_uk}</span>
                      </span>
                      <span className="price-small">{variant.price_override ? `${Number(variant.price_override).toFixed(2)} zł` : t('admin.products.basePrice')}</span>
                      <div className="admin-row-actions">
                        <button className="admin-icon-button" type="button" onClick={() => openVariantModal(product.id, variant)} aria-label={t('admin.products.editVariantAria')}>
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          className="admin-icon-button admin-icon-button-danger"
                          type="button"
                          onClick={() => setConfirmAction({
                            title: t('admin.products.deleteVariantTitle'),
                            message: t('admin.products.deleteVariantMessage').replace('{variant}', variant.name_ru).replace('{product}', product.name_ru),
                            onConfirm: () => deleteVar(variant.id),
                          })}
                          aria-label={t('admin.products.deleteVariantAria')}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showProdModal && (
        <AdminModal
          title={editProd ? t('admin.products.editProductTitle') : t('admin.products.newProductTitle')}
          subtitle={t('admin.products.productModalSubtitle')}
          onClose={() => setShowProdModal(false)}
          footer={<button className="admin-button admin-button-primary" type="button" onClick={saveProd}>{t('admin.common.save')}</button>}
        >
          {(['name_ru', 'name_pl', 'name_uk'] as const).map(field => (
            <div key={field} className="input-group">
              <label className="input-label">{t(PRODUCT_NAME_FIELD_LABEL_KEYS[field])}</label>
              <input className="input" value={prodForm[field]} onChange={e => setProdForm(product => ({ ...product, [field]: e.target.value }))} />
            </div>
          ))}
          <div className="input-group"><label className="input-label">{t('admin.fields.price')}</label><input className="input" type="text" value={prodForm.base_price} onChange={e => setProdForm(product => ({ ...product, base_price: e.target.value }))} /></div>
          <div className="input-group"><label className="input-label">{t('admin.fields.descriptionRu')}</label><textarea className="input" value={prodForm.description_ru} onChange={e => setProdForm(product => ({ ...product, description_ru: e.target.value }))} /></div>
        </AdminModal>
      )}

      {showVarModal && (
        <AdminModal
          title={editVar ? t('admin.products.editVariantTitle') : t('admin.products.newVariantTitle')}
          subtitle={t('admin.products.variantModalSubtitle')}
          onClose={() => setShowVarModal(false)}
          footer={<button className="admin-button admin-button-primary" type="button" onClick={saveVar}>{t('admin.common.save')}</button>}
        >
          {(['name_ru', 'name_pl', 'name_uk'] as const).map(field => (
            <div key={field} className="input-group">
              <label className="input-label">{t(PRODUCT_NAME_FIELD_LABEL_KEYS[field])}</label>
              <input className="input" value={varForm[field]} onChange={e => setVarForm(variant => ({ ...variant, [field]: e.target.value }))} />
            </div>
          ))}
          <div className="input-group"><label className="input-label">{t('admin.fields.variantPrice')}</label><input className="input" type="text" value={varForm.price_override} onChange={e => setVarForm(variant => ({ ...variant, price_override: e.target.value }))} /></div>
        </AdminModal>
      )}

      {confirmAction && (
        <AdminConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          onCancel={() => setConfirmAction(null)}
          onConfirm={runConfirmAction}
        />
      )}
    </section>
  );
}

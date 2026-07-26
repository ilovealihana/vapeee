import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatApiError } from '../api/errors';
import { api, type Product, type Variant } from '../api/client';
import Icon from '../components/Icon';
import ProductMedia from '../components/ProductMedia';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { findLocationSource, useCatalogSourceStore, type SelectedCatalog } from '../store/catalogSource';
import { useUserStore } from '../store/user';

function flavorLabel(count: number, t: (key: string) => string): string {
  if (count === 1) return t('product.flavor.one');
  if (count > 1 && count < 5) return t('product.flavor.few');
  return t('product.flavor.many');
}

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const locationId = state?.locationId || searchParams.get('location_id') || undefined;
  const querySource = searchParams.get('source') || undefined;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [addError, setAddError] = useState('');
  const { addItem, fetchCart, cart, clearCart } = useCartStore();
  const {
    sources,
    selectedSource,
    loading: sourcesLoading,
    loadSources,
    selectSource,
  } = useCatalogSourceStore();
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const lang = 'ru';

  useEffect(() => {
    if (!sources && !sourcesLoading) loadSources();
  }, [loadSources, sources, sourcesLoading]);

  useEffect(() => {
    if (!sources || selectedSource) return;
    let target: SelectedCatalog | null = null;
    const numericLocationId = locationId ? Number(locationId) : NaN;
    if (Number.isFinite(numericLocationId)) target = findLocationSource(sources, numericLocationId);
    if (querySource === 'inpost') target = { type: 'inpost', status: sources.inpost.status };
    if (!target || target.status !== 'available') {
      navigate('/catalog-selector', { replace: true });
      return;
    }
    if (cart?.items?.length) {
      navigate('/catalog-selector', { replace: true });
      return;
    }
    selectSource(target, cart, clearCart).catch(() => navigate('/catalog-selector', { replace: true }));
  }, [cart, clearCart, locationId, navigate, querySource, selectedSource, selectSource, sources]);

  useEffect(() => {
    if (!productId) return;
    if (!selectedSource) {
      if (!sourcesLoading && sources) navigate('/catalog-selector', { replace: true });
      return;
    }
    const requestParams = selectedSource.type === 'local_point'
      ? { location_id: selectedSource.locationId }
      : { source: 'inpost' as const };
    api.catalog.product(Number(productId), requestParams)
      .then((p) => {
        setProduct(p);
        setSelectedVariant(p.variants[0] || null);
      })
      .catch((e) => setLoadError(formatApiError(e, t)));
  }, [navigate, productId, selectedSource, sources, sourcesLoading, t]);

  if (loadError) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-visual"><Icon name="package" size={32} /></div>
          <h3>{t('productDetail.unavailable')}</h3>
          <p>{loadError}</p>
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate(-1)}>{t('common.back')}</button>
        </div>
      </div>
    );
  }

  if (!product) return <div className="page"><div className="spinner" /></div>;

  const name = lang === 'ru' ? product.name_ru : lang === 'pl' ? product.name_pl : product.name_uk;
  const desc = lang === 'ru' ? product.description_ru : lang === 'pl' ? product.description_pl : product.description_uk;
  const variantName = (v: Variant) => lang === 'ru' ? v.name_ru : lang === 'pl' ? v.name_pl : v.name_uk;
  const price = selectedVariant?.price_override ? Number(selectedVariant.price_override) : Number(product.base_price);

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    setAdding(true);
    setAddError('');
    try {
      if (!selectedSource) {
        navigate('/catalog-selector', { replace: true });
        return;
      }
      await addItem(
        selectedVariant.id,
        qty,
        selectedSource.type === 'local_point' ? selectedSource.locationId : undefined,
        selectedSource.type,
      );
      await fetchCart();
      navigate('/cart');
    } catch (e: any) {
      setAddError(formatApiError(e, t));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label={t('common.back')}><Icon name="chevronLeft" /></button>
        <h1 className="page-title" style={{ fontSize: 20 }}>{name}</h1>
      </div>

      <div className="container">
        <ProductMedia />

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
            <div>
              <h2 style={{ fontSize: 28, letterSpacing: '-0.02em', marginBottom: 8 }}>{name}</h2>
              <p className="muted">{product.variants.length || 1} {flavorLabel(product.variants.length || 1, t)}</p>
            </div>
            <span className="price">{(price * qty).toFixed(2)} zł</span>
          </div>

          {desc && <p style={{ color: 'var(--secondary)', marginTop: 18 }}>{desc}</p>}

          <div className="section-heading"><h2>{t('productDetail.flavor')}</h2><span>{t('productDetail.chooseVariant')}</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {product.variants.map((v) => (
              <button key={v.id} className={`chip ${selectedVariant?.id === v.id ? 'active' : ''}`} onClick={() => setSelectedVariant(v)}>
                {variantName(v)}
              </button>
            ))}
          </div>

          <div className="section-heading"><h2>{t('productDetail.quantity')}</h2></div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="muted">{t('productDetail.toCart')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))}><Icon name="minus" /></button>
              <strong style={{ minWidth: 24, textAlign: 'center' }}>{qty}</strong>
              <button className="icon-btn" onClick={() => setQty((q) => q + 1)}><Icon name="plus" /></button>
            </div>
          </div>

          {addError && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{addError}</p>}
          <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={!selectedVariant || adding} onClick={handleAddToCart}>
            {adding ? t('productDetail.adding') : t('productDetail.addToCart')}
          </button>
        </div>
      </div>
    </div>
  );
}

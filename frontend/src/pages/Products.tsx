import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type Category, type Product } from '../api/client';
import { formatApiError } from '../api/errors';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import Icon from '../components/Icon';
import ProductMedia from '../components/ProductMedia';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { useUserStore } from '../store/user';

function flavorLabel(count: number, t: (key: string) => string) {
  if (count === 1) return t('product.flavor.one');
  if (count > 1 && count < 5) return t('product.flavor.few');
  return t('product.flavor.many');
}

function parseLocationId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const id = Number(value);
  return Number.isFinite(id) ? id : undefined;
}

export default function Products() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { locationId: routeLocationId } = useParams<{ locationId: string }>();
  const [searchParams] = useSearchParams();
  const queryLocationId = searchParams.get('location_id') || undefined;
  const locationId = routeLocationId || queryLocationId;
  const numericLocationId = parseLocationId(locationId);
  const returnCityId = (state as { cityId?: string } | null)?.cityId;
  const backTarget = returnCityId ? `/cities/${returnCityId}/locations` : '/cities';
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const { addItem, fetchCart, itemCount } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [layout, setLayout] = useState<'two' | 'three'>('two');
  const [loading, setLoading] = useState(true);
  const [busyProduct, setBusyProduct] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.catalog.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.catalog.products({
      category_id: categoryId,
      location_id: numericLocationId,
    })
      .then(setProducts)
      .catch((e) => setError(formatApiError(e, t)))
      .finally(() => setLoading(false));
  }, [categoryId, numericLocationId, t]);

  const addProduct = async (product: Product) => {
    const variant = product.variants[0];
    if (!variant) return;
    setBusyProduct(product.id);
    setError('');
    try {
      await addItem(variant.id, 1, numericLocationId);
      await fetchCart();
    } catch (e) {
      setError(formatApiError(e, t));
    } finally {
      setBusyProduct(null);
    }
  };

  const categoryButtons = useMemo(() => [
    { id: undefined, label: t('catalog.filters.all') },
    ...categories.map((category) => ({ id: category.id, label: category.name_ru })),
  ], [categories, t]);

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="catalog" />
      <div className="copied-catalog-shell dark overflow-x-hidden" data-catalog-layout={layout}>
        <div className="relative z-10 flex flex-col min-h-screen w-full">
          <div className="catalog-filter-bar px-margin-page py-3 relative z-10">
            <button className="back-btn" onClick={() => navigate(backTarget)} aria-label={t('common.back')}><Icon name="chevronLeft" /></button>
            <div className={`catalog-view-toggle ${layout === 'two' ? 'is-two' : 'is-three'}`} role="group" aria-label={t('catalog.viewToggle')}>
              <button
                className={`catalog-view-option ${layout === 'two' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setLayout('two')}
                aria-label={t('catalog.viewTwoColumns')}
                aria-pressed={layout === 'two'}
              >
                <span className="catalog-view-icon catalog-view-icon-two" aria-hidden="true">
                  <span></span><span></span><span></span><span></span>
                </span>
              </button>
              <button
                className={`catalog-view-option ${layout === 'three' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setLayout('three')}
                aria-label={t('catalog.viewThreeColumns')}
                aria-pressed={layout === 'three'}
              >
                <span className="catalog-view-icon catalog-view-icon-three" aria-hidden="true">
                  <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                </span>
              </button>
            </div>
            <nav className="catalog-filter-scroll flex overflow-x-auto gap-3 custom-scrollbar" aria-label={t('catalog.categoriesLabel')}>
              {categoryButtons.map((category) => (
                <button
                  key={category.id ?? 'all'}
                  className={[
                    'px-6 py-2 rounded-full font-label-lg text-label-lg whitespace-nowrap transition-all',
                    categoryId === category.id ? 'active-filter' : 'bg-surface-container text-on-surface-variant hover:text-primary',
                  ].join(' ')}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </nav>
          </div>

          <main className="flex-1 px-margin-page pt-2 pb-32">
            {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}
            {loading && <div className="spinner" />}
            {!loading && products.length === 0 && (
              <section className="empty-state" style={{ paddingTop: 80 }}>
                <h3>{t('catalog.empty')}</h3>
              </section>
            )}
            {!loading && products.length > 0 && (
              <div className="catalog-product-grid grid grid-cols-2 gap-4">
                {products.map((product) => {
                  const variantCount = Math.max(product.variants.length, 1);
                  const firstVariant = product.variants[0];
                  const price = firstVariant?.price_override ? Number(firstVariant.price_override) : Number(product.base_price);

                  return (
                    <article
                      key={product.id}
                      className="product-card flex flex-col bg-surface-container rounded-xl overflow-hidden group"
                      onClick={() => navigate(`/products/${product.id}${locationId ? `?location_id=${locationId}` : ''}`, { state: { locationId } })}
                    >
                      <div className="relative w-full aspect-square bg-surface-container-low flex items-center justify-center p-4">
                        <ProductMedia label={product.name_ru.slice(0, 4).toUpperCase()} />
                      </div>
                      <div className="p-4 flex flex-col gap-1">
                        <h3 className="text-label-lg font-label-lg text-on-surface font-semibold">{product.name_ru}</h3>
                        <p className="text-label-sm font-label-sm text-on-surface-variant">{firstVariant?.name_ru || product.description_ru || ''}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-primary font-bold">{price.toFixed(2)} zl</span>
                          <span className="text-[10px] bg-surface-variant px-2 py-1 rounded text-on-surface-variant">
                            {variantCount} {flavorLabel(variantCount, t)}
                          </span>
                        </div>
                        <button
                          className="bg-secondary-container text-on-secondary-container rounded-lg px-3 py-2 mt-3 font-label-lg"
                          type="button"
                          disabled={!firstVariant || busyProduct === product.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            addProduct(product);
                          }}
                        >
                          {busyProduct === product.id ? t('productDetail.adding') : t('product.add')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
      <CopiedBottomNav activeTab="catalog" cartCount={itemCount()} />
    </>
  );
}

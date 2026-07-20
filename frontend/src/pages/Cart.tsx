import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CopiedBottomNav from '../components/CopiedBottomNav';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import ProductMedia from '../components/ProductMedia';
import { formatApiError } from '../api/errors';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { useUserStore } from '../store/user';

function itemTitle(item: NonNullable<ReturnType<typeof useCartStore.getState>['cart']>['items'][number]) {
  return item.product?.name_ru || item.variant?.name_ru || `#${item.variant_id}`;
}

function itemSubtitle(item: NonNullable<ReturnType<typeof useCartStore.getState>['cart']>['items'][number]) {
  if (item.product?.name_ru && item.variant?.name_ru) return item.variant.name_ru;
  return '';
}

export default function Cart() {
  const navigate = useNavigate();
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const { cart, loading, error: cartError, fetchCart, updateItem, removeItem, itemCount } = useCartStore();
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const changeQuantity = async (itemId: number, nextQuantity: number) => {
    setBusyItem(itemId);
    setActionError('');
    try {
      if (nextQuantity <= 0) await removeItem(itemId);
      else await updateItem(itemId, nextQuantity);
    } catch (e) {
      setActionError(formatApiError(e, t));
    } finally {
      setBusyItem(null);
    }
  };

  const items = cart?.items ?? [];
  const total = Number(cart?.total || 0);
  const displayError = actionError || (cartError ? formatApiError(cartError, t) : '');

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="cart" />
      <div className="copied-cart-shell min-h-screen flex flex-col overflow-x-hidden custom-scroll">
        <main className="flex-1 mt-2 px-margin-page pb-32 w-full relative z-10">
          {loading && <div className="spinner" />}

          {!loading && displayError && items.length === 0 && (
            <section className="empty-state" style={{ paddingTop: 80 }}>
              <div className="empty-visual">
                <span className="material-symbols-outlined">error</span>
              </div>
              <h3>{displayError}</h3>
            </section>
          )}

          {!loading && !displayError && items.length === 0 && (
            <section className="empty-state" style={{ paddingTop: 80 }}>
              <div className="empty-visual">
                <span className="material-symbols-outlined">shopping_cart</span>
              </div>
              <h3>{t('cart.empty')}</h3>
              <button className="btn btn-primary" type="button" onClick={() => navigate('/products')}>
                {t('nav.catalog')}
              </button>
            </section>
          )}

          {items.length > 0 && (
            <>
              <div className="space-y-stack-md">
                {items.map((item) => {
                  const price = Number(item.price || item.product?.base_price || 0);
                  const disabled = busyItem === item.id;

                  return (
                    <div key={item.id} className="cart-card p-4 rounded-xl flex items-center gap-4 border border-outline-variant/10">
                      <ProductMedia compact label={itemTitle(item).slice(0, 4).toUpperCase()} />
                      <div className="flex-1">
                        <h3 className="text-label-lg font-label-lg text-on-surface">{itemTitle(item)}</h3>
                        {itemSubtitle(item) && <p className="text-label-sm font-label-sm text-on-surface-variant">{itemSubtitle(item)}</p>}
                        <p className="text-label-lg font-label-lg text-primary mt-1">{price.toFixed(2)} zl</p>
                      </div>
                      <div className="flex items-center bg-surface-container rounded-full px-2 py-1 gap-3">
                        <button
                          className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                          type="button"
                          disabled={disabled}
                          onClick={() => changeQuantity(item.id, item.quantity - 1)}
                          aria-label={item.quantity <= 1 ? t('cart.remove') : 'minus'}
                        >
                          <span className="material-symbols-outlined text-[18px]">{item.quantity <= 1 ? 'delete' : 'remove'}</span>
                        </button>
                        <span className="text-label-lg font-label-lg text-on-surface w-4 text-center">{item.quantity}</span>
                        <button
                          className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                          type="button"
                          disabled={disabled}
                          onClick={() => changeQuantity(item.id, item.quantity + 1)}
                          aria-label={t('product.add')}
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-stack-lg pt-6 border-t border-outline-variant/20">
                <div className="flex justify-between items-center mb-8">
                  <span className="text-headline-sm font-headline-sm text-on-surface">{t('cart.total')}</span>
                  <span className="text-headline-sm font-headline-sm text-primary">{total.toFixed(2)} zl</span>
                </div>
                {displayError && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{displayError}</p>}
                <button
                  className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline-sm flex justify-center items-center gap-2 active:scale-95 transition-transform duration-150"
                  type="button"
                  onClick={() => navigate('/checkout')}
                >
                  <span>{t('cart.checkout')}</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </>
          )}
        </main>
      </div>
      <CopiedBottomNav activeTab="cart" cartCount={itemCount()} />
    </>
  );
}

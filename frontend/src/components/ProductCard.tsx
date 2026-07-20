import { useNavigate } from 'react-router-dom';
import type { Product } from '../api/client';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';
import ProductMedia from './ProductMedia';

type Props = {
  product: Product;
  locationId?: string;
  mode?: 'grid' | 'wide';
};

function flavorLabel(count: number, t: (key: string) => string) {
  if (count === 1) return t('product.flavor.one');
  if (count > 1 && count < 5) return t('product.flavor.few');
  return t('product.flavor.many');
}

export default function ProductCard({ product, locationId, mode = 'grid' }: Props) {
  const navigate = useNavigate();
  const href = `/products/${product.id}${locationId ? `?location_id=${locationId}` : ''}`;
  const variantCount = Math.max(product.variants.length, 1);
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  const openProduct = () => navigate(href, { state: { locationId } });

  return (
    <article className={`product-card ${mode === 'wide' ? 'wide' : ''}`} onClick={openProduct}>
      <ProductMedia compact={mode === 'wide'} label={product.name_ru.slice(0, 4).toUpperCase()} />
      <div className="product-card-body">
        <div className="product-card-top">
          <h3>{product.name_ru}</h3>
          <span className="stock-dot">{t('product.inStock')}</span>
        </div>
        <p>20 mg · {variantCount} {flavorLabel(variantCount, t)}</p>
        <div className="product-card-bottom">
          <strong>{Number(product.base_price).toFixed(2)} zł</strong>
          <button
            onClick={(event) => {
              event.stopPropagation();
              openProduct();
            }}
          >
            {t('product.add')}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card skeleton-card">
      <div className="skeleton product-media-skeleton" />
      <div className="product-card-body">
        <div className="skeleton skeleton-line wide" />
        <div className="skeleton skeleton-line" />
        <div className="product-card-bottom">
          <div className="skeleton skeleton-price" />
          <div className="skeleton skeleton-button" />
        </div>
      </div>
    </div>
  );
}

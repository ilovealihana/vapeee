import Smoke from './Smoke';

export default function ProductMedia({ compact = false, label = 'VAPE' }: { compact?: boolean; label?: string }) {
  return (
    <div className={`product-media ${compact ? 'compact' : ''}`}>
      <Smoke className="product-smoke" />
      <div className="product-bottle">
        <div className="product-cap" />
        <div className="product-label">
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

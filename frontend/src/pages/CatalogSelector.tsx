import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CatalogSourceLocation } from '../api/client';
import CopiedBottomNav from '../components/CopiedBottomNav';
import GoogleMapSelector from '../components/GoogleMapSelector';
import CopiedPageTitle from '../components/CopiedPageTitle';
import CopiedSmokeBackground from '../components/CopiedSmokeBackground';
import CopiedTopBar from '../components/CopiedTopBar';
import Icon from '../components/Icon';
import { useI18n } from '../i18n';
import { useCartStore } from '../store/cart';
import { sourceFromApiLocation, type SelectedCatalog, useCatalogSourceStore } from '../store/catalogSource';
import { useUserStore } from '../store/user';

type SelectorTab = 'list' | 'map';

function statusKey(status: CatalogSourceLocation['status'] | 'inactive') {
  if (status === 'available') return 'catalogSelector.status.available';
  if (status === 'coming_soon') return 'catalogSelector.status.comingSoon';
  return 'catalogSelector.status.inactive';
}

function isSameSource(a: SelectedCatalog | null, b: SelectedCatalog) {
  if (!a) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'inpost') return true;
  return b.type === 'local_point' && a.locationId === b.locationId;
}

export default function CatalogSelector() {
  const navigate = useNavigate();
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const { cart, clearCart, itemCount } = useCartStore();
  const {
    sources,
    selectedSource,
    loading,
    error,
    loadSources,
    selectSource,
  } = useCatalogSourceStore();
  const [activeTab, setActiveTab] = useState<SelectorTab>('list');
  const [expandedCityId, setExpandedCityId] = useState<number | null>(null);
  const [selectingKey, setSelectingKey] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!sources && !loading) loadSources();
  }, [loadSources, loading, sources]);

  const selectedKey = selectedSource?.type === 'local_point'
    ? `local-${selectedSource.locationId}`
    : selectedSource?.type ?? '';

  const localPointCount = useMemo(
    () => sources?.cities.reduce((sum, city) => sum + city.locations.length, 0) ?? 0,
    [sources],
  );

  const chooseSource = async (target: SelectedCatalog, key: string) => {
    if (target.status !== 'available') return;
    if (isSameSource(selectedSource, target)) {
      navigate('/products');
      return;
    }
    if (cart?.items?.length) {
      const confirmed = window.confirm(t('catalogSelector.switchConfirm'));
      if (!confirmed) return;
    }
    setSelectingKey(key);
    setMessage('');
    try {
      await selectSource(target, cart, clearCart);
      navigate('/products');
    } catch {
      setMessage(t('catalogSelector.switchFailed'));
    } finally {
      setSelectingKey('');
    }
  };

  const renderPoint = (point: CatalogSourceLocation) => {
    const target = sourceFromApiLocation(point);
    const key = `local-${point.id}`;
    const disabled = point.status !== 'available';
    const active = selectedKey === key;

    return (
      <button
        key={point.id}
        className={`source-selector-point ${active ? 'is-selected' : ''}`}
        type="button"
        disabled={disabled || selectingKey === key}
        onClick={() => chooseSource(target, key)}
      >
        <span className="source-selector-point-icon">
          <Icon name="mapPin" size={18} />
        </span>
        <span className="source-selector-point-body">
          <strong>{point.name}</strong>
          <small>{point.address}</small>
          <small>{t('catalogSelector.stock').replace('{count}', String(point.stock_count))}</small>
          <small>{t('catalogSelector.workingHoursFallback')}</small>
        </span>
        <span className={`source-selector-status is-${point.status}`}>{t(statusKey(point.status))}</span>
      </button>
    );
  };

  return (
    <>
      <CopiedSmokeBackground />
      <CopiedTopBar />
      <CopiedPageTitle activeTab="catalog" />
      <div className="copied-catalog-shell dark overflow-x-hidden">
        <main className="source-selector-main">
          <header className="source-selector-header">
            <button className="back-btn" type="button" onClick={() => navigate('/')} aria-label={t('common.back')}>
              <Icon name="chevronLeft" />
            </button>
            <div>
              <h1>{t('catalogSelector.title')}</h1>
              <p>{t('catalogSelector.subtitle')}</p>
            </div>
          </header>

          <div className="source-selector-tabs" role="tablist" aria-label={t('catalogSelector.tabsLabel')}>
            <button
              className={`source-selector-tab ${activeTab === 'list' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setActiveTab('list')}
              aria-pressed={activeTab === 'list'}
            >
              <Icon name="catalog" size={17} />
              {t('catalogSelector.tabs.list')}
            </button>
            <button
              className={`source-selector-tab ${activeTab === 'map' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setActiveTab('map')}
              aria-pressed={activeTab === 'map'}
            >
              <Icon name="mapPin" size={17} />
              {t('catalogSelector.tabs.map')}
            </button>
          </div>

          {message && <p className="source-selector-message">{message}</p>}
          {Boolean(error) && <p className="source-selector-message">{t('catalogSelector.loadFailed')}</p>}
          {loading && <div className="spinner" />}

          {!loading && sources && activeTab === 'map' && (
            <GoogleMapSelector
              cities={sources.cities}
              onSelectLocation={(location) => chooseSource(sourceFromApiLocation(location), `local-${location.id}`)}
            />
          )}

          {!loading && sources && activeTab === 'list' && (
            <section className="source-selector-list">
              <button
                className={`source-selector-inpost ${selectedKey === 'inpost' ? 'is-selected' : ''}`}
                type="button"
                disabled={sources.inpost.status !== 'available' || selectingKey === 'inpost'}
                onClick={() => chooseSource({ type: 'inpost', status: sources.inpost.status }, 'inpost')}
              >
                <span className="source-selector-point-icon">
                  <Icon name="package" size={18} />
                </span>
                <span className="source-selector-point-body">
                  <strong>{t('catalogSelector.inpost')}</strong>
                  <small>{t('catalogSelector.inpostDescription')}</small>
                  <small>{t('catalogSelector.stock').replace('{count}', String(sources.inpost.stock_count))}</small>
                </span>
                <span className={`source-selector-status is-${sources.inpost.status}`}>{t(statusKey(sources.inpost.status))}</span>
              </button>

              <div className="source-selector-divider">
                <span>{t('catalogSelector.localPoints')}</span>
                <small>{t('catalogSelector.pointsCount').replace('{count}', String(localPointCount))}</small>
              </div>

              {sources.cities.map((city) => (
                <article className="source-selector-city" key={city.id}>
                  <button
                    className="source-selector-city-toggle"
                    type="button"
                    onClick={() => setExpandedCityId(expandedCityId === city.id ? null : city.id)}
                    aria-expanded={expandedCityId === city.id}
                  >
                    <span>
                      <strong>{city.name}</strong>
                      <small>{t('catalogSelector.pointsCount').replace('{count}', String(city.locations.length))}</small>
                    </span>
                    <Icon name={expandedCityId === city.id ? 'minus' : 'plus'} size={18} />
                  </button>
                  {expandedCityId === city.id && (
                    <div className="source-selector-point-list">
                      {city.locations.map(renderPoint)}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
        </main>
      </div>
      <CopiedBottomNav activeTab="catalog" cartCount={itemCount()} />
    </>
  );
}

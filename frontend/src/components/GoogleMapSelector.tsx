import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogSourceCity, CatalogSourceLocation } from '../api/client';
import { useI18n } from '../i18n';
import { useUserStore } from '../store/user';
import Icon from './Icon';

type MapState = 'loading' | 'ready' | 'unavailable' | 'empty';
const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 7000;

type GoogleLatLng = { lat: number; lng: number };
type GoogleMapStyle = {
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string | number | boolean>>;
};

const GOOGLE_MAP_SELECTOR_STYLES: GoogleMapStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#202425' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8d9798' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#202425' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3334' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#b7c1c2' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3f4b4c' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#102f35' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6f9296' }] },
];

type GoogleMapMarkerClickHandle = {
  remove?: () => void;
};

type GoogleAdvancedMarkerElement = {
  addListener?: (eventName: 'click', handler: () => void) => GoogleMapMarkerClickHandle;
};

type GoogleBasicMarkerElement = {
  addListener?: (eventName: 'click', handler: () => void) => GoogleMapMarkerClickHandle;
  setIcon?: (icon: unknown) => void;
};

type GoogleMarkerLibrary = {
  AdvancedMarkerElement?: new (options: {
    position: GoogleLatLng;
    map: unknown;
    title: string;
    content: HTMLElement;
  }) => GoogleAdvancedMarkerElement;
};

type GoogleMapsApi = {
  maps?: {
    Map: new (
      node: HTMLElement,
      options: {
        center: GoogleLatLng;
        zoom: number;
        disableDefaultUI: boolean;
        clickableIcons: boolean;
        gestureHandling: 'greedy';
        styles: GoogleMapStyle[];
        mapId?: string;
      },
    ) => unknown;
    Marker?: new (options: { position: GoogleLatLng; map: unknown; title: string; icon?: unknown }) => GoogleBasicMarkerElement;
    Point?: new (x: number, y: number) => unknown;
    Size?: new (width: number, height: number) => unknown;
    importLibrary?: (name: 'marker') => Promise<GoogleMarkerLibrary>;
  };
};

type GoogleWindow = Window & {
  google?: GoogleMapsApi;
  gm_authFailure?: () => void;
};

export type GoogleMapMarkerPoint = {
  id: number;
  name: string;
  address: string;
  position: GoogleLatLng;
  source: CatalogSourceLocation;
};

type GoogleMapSelectorProps = {
  cities: CatalogSourceCity[];
  onSelectLocation: (location: CatalogSourceLocation) => void;
};

function mapsWindow(): GoogleWindow | null {
  if (typeof window === 'undefined') return null;
  return window as GoogleWindow;
}

export function mapMarkerPoints(cities: CatalogSourceCity[]): GoogleMapMarkerPoint[] {
  return cities.flatMap((city) => city.locations)
    .map((point) => {
      const lat = Number(point.latitude);
      const lng = Number(point.longitude);
      return { point, lat, lng };
    })
    .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(({ point, lat, lng }) => ({
      id: point.id,
      name: point.name,
      address: point.address,
      position: { lat, lng },
      source: point,
    }));
}

export function googleMapsKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
}

export function googleMapsMapId(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '';
}

function ensureGoogleScript(key: string): Promise<void> {
  const win = mapsWindow();
  if (!win) return Promise.reject(new Error('window unavailable'));
  if (win.google?.maps?.Map) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-selector="true"]');
  if (existing) {
    if (existing.dataset.googleMapsLoaded === 'true' && win.google?.maps?.Map) return Promise.resolve();
    if (existing.dataset.googleMapsFailed === 'true') return Promise.reject(new Error('google maps load failed'));
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('google maps load failed')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsSelector = 'true';
    script.addEventListener('load', () => {
      script.dataset.googleMapsLoaded = 'true';
      if (win.google?.maps?.Map) resolve();
      else reject(new Error('google maps unavailable after load'));
    }, { once: true });
    script.addEventListener('error', () => {
      script.dataset.googleMapsFailed = 'true';
      reject(new Error('google maps load failed'));
    }, { once: true });
    document.head.appendChild(script);
  });
}

function withGoogleMapsTimeout(promise: Promise<void>): Promise<void> {
  return Promise.race([
    promise,
    new Promise<void>((_, reject) => {
      window.setTimeout(() => reject(new Error('google maps load timeout')), GOOGLE_MAPS_LOAD_TIMEOUT_MS);
    }),
  ]);
}

function createMarkerContent(name: string, isSelected = false): HTMLElement {
  const markerImage = document.createElement('img');
  markerImage.src = '/map-marker-r.png';
  markerImage.alt = name;
  markerImage.className = `google-map-selector-marker${isSelected ? ' is-selected' : ''}`;
  return markerImage;
}

function createBasicMarkerIcon(maps: NonNullable<GoogleMapsApi['maps']>, isSelected = false): unknown {
  const size = isSelected ? 68 : 58;
  return {
    url: '/map-marker-r.png',
    scaledSize: maps.Size ? new maps.Size(size, size) : undefined,
    anchor: maps.Point ? new maps.Point(size / 2, size) : undefined,
  };
}

function setMarkerContentSelected(content: HTMLElement, isSelected: boolean) {
  content.classList.toggle('is-selected', isSelected);
}

export default function GoogleMapSelector({ cities, onSelectLocation }: GoogleMapSelectorProps) {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const selectedMarkerIdRef = useRef<number | null>(null);
  const markers = useMemo(() => mapMarkerPoints(cities), [cities]);
  const [mapState, setMapState] = useState<MapState>('loading');
  const [selectedMarker, setSelectedMarker] = useState<GoogleMapMarkerPoint | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null);

  useEffect(() => {
    const key = googleMapsKey();
    if (!key) {
      setMapState('unavailable');
      return;
    }
    if (markers.length === 0) {
      setMapState('empty');
      setSelectedMarker(null);
      setSelectedMarkerId(null);
      selectedMarkerIdRef.current = null;
      return;
    }

    let cancelled = false;
    const win = mapsWindow();
    const previousAuthFailure = win?.gm_authFailure;
    const authFailureHandler = () => {
      previousAuthFailure?.();
      if (!cancelled) setMapState('unavailable');
    };
    if (win) win.gm_authFailure = authFailureHandler;

    setMapState('loading');
    setSelectedMarker(null);
    setSelectedMarkerId(null);
    selectedMarkerIdRef.current = null;
    withGoogleMapsTimeout(ensureGoogleScript(key))
      .then(async () => {
        if (cancelled) return;
        const nextWin = mapsWindow();
        const node = mapRef.current;
        if (!nextWin?.google?.maps?.Map || !node) {
          setMapState('unavailable');
          return;
        }
        try {
          const mapId = googleMapsMapId();
          const markerLibrary = nextWin.google.maps.importLibrary
            ? await nextWin.google.maps.importLibrary('marker')
            : null;
          if (cancelled) return;
          const map = new nextWin.google.maps.Map(node, {
            center: markers[0].position,
            zoom: 12,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: 'greedy',
            styles: GOOGLE_MAP_SELECTOR_STYLES,
            ...(mapId ? { mapId } : {}),
          });
          const markerViews: Array<{
            id: number;
            content?: HTMLElement;
            basicMarker?: GoogleBasicMarkerElement;
          }> = [];
          const applySelectedMarker = (activeId: number) => {
            markerViews.forEach((view) => {
              const isActive = view.id === activeId;
              if (view.content) setMarkerContentSelected(view.content, isActive);
              view.basicMarker?.setIcon?.(createBasicMarkerIcon(nextWin.google!.maps!, isActive));
            });
          };
          const chooseMarker = (marker: GoogleMapMarkerPoint) => {
            selectedMarkerIdRef.current = marker.id;
            setSelectedMarker(marker);
            setSelectedMarkerId(marker.id);
            applySelectedMarker(marker.id);
          };
          markers.forEach((marker) => {
            if (mapId && markerLibrary?.AdvancedMarkerElement) {
              const content = createMarkerContent(marker.name, marker.id === selectedMarkerIdRef.current);
              const advancedMarker = new markerLibrary.AdvancedMarkerElement({
                position: marker.position,
                map,
                title: marker.name,
                content,
              });
              markerViews.push({ id: marker.id, content });
              advancedMarker.addListener?.('click', () => chooseMarker(marker));
              return;
            }
            if (nextWin.google?.maps?.Marker) {
              const basicMarker = new nextWin.google.maps.Marker({
                position: marker.position,
                map,
                title: marker.name,
                icon: createBasicMarkerIcon(nextWin.google.maps, marker.id === selectedMarkerIdRef.current),
              });
              markerViews.push({ id: marker.id, basicMarker });
              basicMarker.addListener?.('click', () => chooseMarker(marker));
            }
          });
          setMapState('ready');
        } catch {
          setMapState('unavailable');
        }
      })
      .catch(() => {
        if (!cancelled) setMapState('unavailable');
      });

    return () => {
      cancelled = true;
      if (win?.gm_authFailure === authFailureHandler) win.gm_authFailure = previousAuthFailure;
    };
  }, [markers]);

  if (mapState === 'unavailable') {
    return (
      <section className="google-map-selector-state">
        <Icon name="mapPin" size={28} />
        <strong>{t('googleMap.unavailableTitle')}</strong>
        <p>{t('googleMap.unavailableDescription')}</p>
      </section>
    );
  }

  if (mapState === 'empty') {
    return (
      <section className="google-map-selector-state">
        <Icon name="mapPin" size={28} />
        <strong>{t('googleMap.emptyTitle')}</strong>
        <p>{t('googleMap.emptyDescription')}</p>
      </section>
    );
  }

  return (
    <section className="google-map-selector">
      <div className="google-map-selector-canvas">
        <div className="google-map-selector-map" ref={mapRef} />
        {mapState === 'loading' && (
          <span className="google-map-selector-loading">
            <Icon name="mapPin" size={24} />
            <strong>{t('common.loading')}</strong>
          </span>
        )}
        {mapState === 'ready' && selectedMarker && (
          <article className={`google-map-selector-card${selectedMarkerId === selectedMarker.id ? ' is-selected' : ''}`}>
            <span className="google-map-selector-card-icon">
              <Icon name="mapPin" size={18} />
            </span>
            <span className="google-map-selector-card-body">
              <strong>{selectedMarker.name}</strong>
              <small>{selectedMarker.address}</small>
              <small>{t('catalogSelector.stock').replace('{count}', String(selectedMarker.source.stock_count))}</small>
              <small>{t('catalogSelector.workingHoursFallback')}</small>
            </span>
            <span className={`source-selector-status is-${selectedMarker.source.status}`}>
              {t(selectedMarker.source.status === 'available'
                ? 'catalogSelector.status.available'
                : selectedMarker.source.status === 'coming_soon'
                  ? 'catalogSelector.status.comingSoon'
                  : 'catalogSelector.status.inactive')}
            </span>
            <button
              className="google-map-selector-card-action"
              type="button"
              disabled={selectedMarker.source.status !== 'available'}
              onClick={() => onSelectLocation(selectedMarker.source)}
            >
              {t('catalogSelector.homeChooseSource')}
            </button>
          </article>
        )}
      </div>
    </section>
  );
}

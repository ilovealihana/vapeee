import { useEffect, useRef, useState } from 'react';
import { adminApi, type AdminCity, type AdminLocation } from '../../api/admin';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';
import { AdminConfirmDialog, AdminEmptyState, AdminModal, AdminPageHeader, AdminStatusBadge } from './AdminUI';

type ConfirmAction = {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
};

const emptyLocation = { name: '', address: '', description: '' };

type GooglePlace = {
  formatted_address?: string;
  name?: string;
  formattedAddress?: string;
  displayName?: string;
  fetchFields?: (request: { fields: string[] }) => Promise<void>;
};

type GooglePlacePrediction = {
  text?: { text?: string; toString?: () => string };
  mainText?: { text?: string; toString?: () => string };
  secondaryText?: { text?: string; toString?: () => string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
  toPlace?: () => GooglePlace;
};

type GoogleAddressSuggestion = {
  placePrediction?: GooglePlacePrediction;
};

type GoogleAutocompleteListener = {
  remove?: () => void;
};

type GooglePlacesAutocomplete = {
  addListener: (eventName: 'place_changed', handler: () => void) => GoogleAutocompleteListener;
  getPlace: () => GooglePlace;
};

type GooglePlacesAutocompleteCtor = new (
  input: HTMLInputElement,
  options: {
    fields: Array<'formatted_address' | 'geometry' | 'name'>;
    componentRestrictions: { country: 'pl' };
  },
) => GooglePlacesAutocomplete;

type GoogleAutocompleteSuggestionService = {
  fetchAutocompleteSuggestions: (
    request: { input: string; includedRegionCodes: string[] },
  ) => Promise<{ suggestions?: GoogleAddressSuggestion[] } | GoogleAddressSuggestion[]>;
};

type GooglePlacesLibrary = {
  Autocomplete?: GooglePlacesAutocompleteCtor;
  AutocompleteSuggestion?: GoogleAutocompleteSuggestionService;
};

type AdminGoogleWindow = Window & {
  google?: {
    maps?: {
      places?: {
        Autocomplete?: GooglePlacesAutocompleteCtor;
        AutocompleteSuggestion?: GoogleAutocompleteSuggestionService;
      };
      importLibrary?: (name: 'places') => Promise<GooglePlacesLibrary>;
    };
  };
};

function adminGoogleWindow(): AdminGoogleWindow | null {
  if (typeof window === 'undefined') return null;
  return window as AdminGoogleWindow;
}

function adminGoogleMapsKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
}

function ensureGooglePlacesScript(): Promise<void> {
  const win = adminGoogleWindow();
  if (!win) return Promise.reject(new Error('window unavailable'));
  if (win.google?.maps?.places?.AutocompleteSuggestion) return Promise.resolve();
  if (win.google?.maps?.importLibrary) {
    return win.google.maps.importLibrary('places').then((library) => {
      if (library.Autocomplete && win.google?.maps) {
        win.google.maps.places = { ...win.google.maps.places, Autocomplete: library.Autocomplete };
      }
      if (library.AutocompleteSuggestion && win.google?.maps) {
        win.google.maps.places = { ...win.google.maps.places, AutocompleteSuggestion: library.AutocompleteSuggestion };
      }
    });
  }

  const key = adminGoogleMapsKey();
  if (!key) return Promise.reject(new Error('google maps key unavailable'));

  const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-selector="true"]');
  if (existing && win.google?.maps) return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('google maps load failed')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsSelector = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('google maps load failed')), { once: true });
    document.head.appendChild(script);
  });
}

function normalizeGoogleSuggestions(result: { suggestions?: GoogleAddressSuggestion[] } | GoogleAddressSuggestion[]): GoogleAddressSuggestion[] {
  return Array.isArray(result) ? result : result.suggestions ?? [];
}

function addressSuggestionMain(suggestion: GoogleAddressSuggestion): string {
  const prediction = suggestion.placePrediction;
  return prediction?.mainText?.text || prediction?.mainText?.toString?.() || prediction?.structuredFormat?.mainText?.text || prediction?.text?.text || prediction?.text?.toString?.() || '';
}

function addressSuggestionSecondary(suggestion: GoogleAddressSuggestion): string {
  const prediction = suggestion.placePrediction;
  return prediction?.secondaryText?.text || prediction?.secondaryText?.toString?.() || prediction?.structuredFormat?.secondaryText?.text || '';
}

function addressSuggestionLabel(suggestion: GoogleAddressSuggestion): string {
  const main = addressSuggestionMain(suggestion);
  const secondary = addressSuggestionSecondary(suggestion);
  return [main, secondary].filter(Boolean).join(', ');
}

function placesErrorMessage(error: unknown): string {
  let message = 'unknown';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    try {
      message = JSON.stringify(error) || 'unknown';
    } catch {
      message = 'unknown';
    }
  }
  return (message || 'unknown').slice(0, 140);
}

export default function AdminCities() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [locations, setLocations] = useState<Record<number, AdminLocation[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [editCity, setEditCity] = useState<AdminCity | null>(null);
  const [cityForm, setCityForm] = useState({ name: '', slug: '' });
  const [showLocModal, setShowLocModal] = useState(false);
  const [locCityId, setLocCityId] = useState<number>(0);
  const [editLoc, setEditLoc] = useState<AdminLocation | null>(null);
  const [locForm, setLocForm] = useState(emptyLocation);
  const [addressStatus, setAddressStatus] = useState<'idle' | 'selected' | 'manual' | 'unavailable'>('idle');
  const [placesReady, setPlacesReady] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<GoogleAddressSuggestion[]>([]);
  const [addressDebug, setAddressDebug] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const locAddressInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setCities(await adminApi.getCities());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showLocModal) return undefined;
    const input = locAddressInputRef.current;
    if (!input) return undefined;

    let cancelled = false;
    let listener: GoogleAutocompleteListener | null = null;
    ensureGooglePlacesScript()
      .then(async () => {
        const win = adminGoogleWindow();
        if (!win?.google?.maps?.places?.AutocompleteSuggestion && win?.google?.maps?.importLibrary) {
          const library = await win.google.maps.importLibrary('places');
          if (library.Autocomplete && win.google?.maps) {
            win.google.maps.places = { ...win.google.maps.places, Autocomplete: library.Autocomplete };
          }
          if (library.AutocompleteSuggestion && win.google?.maps) {
            win.google.maps.places = { ...win.google.maps.places, AutocompleteSuggestion: library.AutocompleteSuggestion };
          }
        }
        if (cancelled) return;
        const places = adminGoogleWindow()?.google?.maps?.places;
        setPlacesReady(Boolean(places?.AutocompleteSuggestion));
        if (places?.AutocompleteSuggestion) return;
        const Autocomplete = places?.Autocomplete;
        if (!Autocomplete) {
          setAddressStatus('unavailable');
          setAddressDebug('AutocompleteSuggestion unavailable');
          return;
        }
        const autocomplete = new Autocomplete(input, {
          fields: ['formatted_address', 'geometry', 'name'],
          componentRestrictions: { country: 'pl' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const address = place.formatted_address || place.name || input.value;
          setLocForm(f => ({ ...f, address }));
          setAddressStatus('selected');
          setAddressDebug('');
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setAddressStatus('unavailable');
          setAddressDebug(placesErrorMessage(error));
        }
      });

    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, [showLocModal]);

  useEffect(() => {
    if (!showLocModal) {
      setAddressSuggestions([]);
      return undefined;
    }

    const input = locForm.address.trim();
    if (!placesReady || addressStatus === 'selected' || input.length < 3) {
      setAddressSuggestions([]);
      return undefined;
    }

    const fetchAutocompleteSuggestions = adminGoogleWindow()?.google?.maps?.places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions;
    if (!fetchAutocompleteSuggestions) {
      setAddressSuggestions([]);
      setAddressDebug('fetchAutocompleteSuggestions unavailable');
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchAutocompleteSuggestions({ input, includedRegionCodes: ['pl'] })
        .then((result) => {
          if (!cancelled) {
            setAddressSuggestions(normalizeGoogleSuggestions(result).slice(0, 5));
            setAddressDebug('');
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setAddressSuggestions([]);
            setAddressStatus('unavailable');
            setAddressDebug(placesErrorMessage(error));
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addressStatus, locForm.address, placesReady, showLocModal]);

  const loadLocations = async (cityId: number) => {
    try {
      const locs = await adminApi.getLocations(cityId);
      setLocations(prev => ({ ...prev, [cityId]: locs }));
    } catch {}
  };

  const toggleCity = async (id: number) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!locations[id]) await loadLocations(id);
  };

  const saveCity = async () => {
    try {
      if (editCity) await adminApi.updateCity(editCity.id, cityForm);
      else await adminApi.createCity({ ...cityForm });
      setShowCityModal(false);
      setEditCity(null);
      setCityForm({ name: '', slug: '' });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteCity = async (id: number) => {
    try {
      await adminApi.deleteCity(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const saveLoc = async () => {
    try {
      if (editLoc) await adminApi.updateLocation(editLoc.id, locForm);
      else await adminApi.createLocation(locCityId, locForm);
      setShowLocModal(false);
      setEditLoc(null);
      setLocForm(emptyLocation);
      setAddressStatus('idle');
      setAddressSuggestions([]);
      setAddressDebug('');
      await loadLocations(locCityId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const chooseAddressSuggestion = async (suggestion: GoogleAddressSuggestion) => {
    const prediction = suggestion.placePrediction;
    const fallbackAddress = addressSuggestionLabel(suggestion);
    try {
      const place = prediction?.toPlace?.();
      if (place?.fetchFields) await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
      const address = place?.formattedAddress || place?.displayName || fallbackAddress;
      if (!address) return;
      setLocForm(f => ({ ...f, address }));
      setAddressStatus('selected');
      setAddressSuggestions([]);
      setAddressDebug('');
    } catch {
      if (fallbackAddress) {
        setLocForm(f => ({ ...f, address: fallbackAddress }));
        setAddressStatus('manual');
      }
      setAddressSuggestions([]);
      setAddressDebug('');
    }
  };

  const deleteLoc = async (id: number, cityId: number) => {
    try {
      await adminApi.deleteLocation(id);
      await loadLocations(cityId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openCityModal = (city?: AdminCity) => {
    setEditCity(city || null);
    setCityForm(city ? { name: city.name, slug: city.slug } : { name: '', slug: '' });
    setShowCityModal(true);
  };

  const openLocationModal = (cityId: number, loc?: AdminLocation) => {
    setLocCityId(cityId);
    setEditLoc(loc || null);
    setLocForm(loc ? {
      name: loc.name,
      address: loc.address,
      description: loc.description || '',
    } : emptyLocation);
    setAddressStatus(loc?.address ? 'selected' : 'idle');
    setAddressSuggestions([]);
    setAddressDebug('');
    setShowLocModal(true);
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    await confirmAction.onConfirm();
    setConfirmAction(null);
  };

  return (
    <section>
      <AdminPageHeader
        title={t('admin.cities.title')}
        subtitle={t('admin.cities.subtitle')}
        meta={<span>{t('admin.cities.meta').replace('{count}', String(cities.length))}</span>}
        actions={(
          <button className="admin-button admin-button-primary" type="button" onClick={() => openCityModal()}>
            <Icon name="plus" size={16} /> {t('admin.cities.addCity')}
          </button>
        )}
      />

      {error && <p className="admin-message admin-message-error">{error}</p>}
      {loading && <div className="spinner" />}
      {!loading && cities.length === 0 && <AdminEmptyState title={t('admin.cities.emptyTitle')} description={t('admin.cities.emptyDescription')} />}
      {!loading && cities.length > 0 && (
        <div className="admin-cms-table">
          {cities.map(city => (
            <div key={city.id} className="admin-cms-group">
              <div className="admin-cms-row admin-cities-row">
                <button className="admin-row-toggle" type="button" onClick={() => toggleCity(city.id)}>
                  <span className="admin-cms-cell-main">
                    <strong>{city.name}</strong>
                    <span>{city.slug}</span>
                  </span>
                </button>
                <AdminStatusBadge status={city.is_active ? 'active' : 'hidden'} label={city.is_active ? t('admin.status.active') : t('admin.status.hidden')} />
                <span className="muted">{t('admin.cities.locationsCount').replace('{count}', String(locations[city.id]?.length ?? '-'))}</span>
                <div className="admin-row-actions">
                  <button className="admin-icon-button" type="button" onClick={() => openLocationModal(city.id)} aria-label={t('admin.cities.addLocation')}>
                    <Icon name="plus" size={16} />
                  </button>
                  <button className="admin-icon-button" type="button" onClick={() => openCityModal(city)} aria-label={t('admin.cities.editCityAria')}>
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    className="admin-icon-button admin-icon-button-danger"
                    type="button"
                    onClick={() => setConfirmAction({
                      title: t('admin.cities.deleteCityTitle'),
                      message: t('admin.cities.deleteCityMessage').replace('{name}', city.name),
                      onConfirm: () => deleteCity(city.id),
                    })}
                    aria-label={t('admin.cities.deleteCityAria')}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>

              {expanded === city.id && (
                <div className="admin-nested-list">
                  <div className="admin-nested-header">
                    <span>{t('admin.cities.locationsHeading')}</span>
                    <button className="admin-button admin-button-secondary" type="button" onClick={() => openLocationModal(city.id)}>
                      <Icon name="plus" size={15} /> {t('admin.cities.addLocation')}
                    </button>
                  </div>
                  {(locations[city.id] || []).length === 0 && (
                    <AdminEmptyState title={t('admin.cities.locationsEmptyTitle')} description={t('admin.cities.locationsEmptyDescription')} />
                  )}
                  {(locations[city.id] || []).map(loc => (
                    <div key={loc.id} className="admin-cms-row admin-location-row">
                      <span className="admin-cms-cell-main">
                        <strong>{loc.name}</strong>
                        <span>{loc.address}</span>
                        <span>
                          {loc.manager_tg_id
                            ? t('admin.cities.managerAssigned').replace('{id}', String(loc.manager_tg_id))
                            : t('admin.cities.managerMissing')}
                        </span>
                      </span>
                      <AdminStatusBadge status={loc.is_active ? 'active' : 'hidden'} label={loc.is_active ? t('admin.status.activeFeminine') : t('admin.status.hiddenFeminine')} />
                      <div className="admin-row-actions">
                        <button className="admin-icon-button" type="button" onClick={() => openLocationModal(city.id, loc)} aria-label={t('admin.cities.editLocationAria')}>
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          className="admin-icon-button admin-icon-button-danger"
                          type="button"
                          onClick={() => setConfirmAction({
                            title: t('admin.cities.deleteLocationTitle'),
                            message: t('admin.cities.deleteLocationMessage').replace('{location}', loc.name).replace('{city}', city.name),
                            onConfirm: () => deleteLoc(loc.id, city.id),
                          })}
                          aria-label={t('admin.cities.deleteLocationAria')}
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

      {showCityModal && (
        <AdminModal
          title={editCity ? t('admin.cities.editCityTitle') : t('admin.cities.newCityTitle')}
          subtitle={t('admin.cities.cityModalSubtitle')}
          onClose={() => setShowCityModal(false)}
          footer={<button className="admin-button admin-button-primary" type="button" onClick={saveCity}>{t('admin.common.save')}</button>}
        >
          <div className="input-group"><label className="input-label">{t('admin.fields.name')}</label><input className="input" value={cityForm.name} onChange={e => setCityForm(f => ({ ...f, name: e.target.value }))} placeholder="Wroclaw" /></div>
          <div className="input-group"><label className="input-label">{t('admin.fields.slug')}</label><input className="input" value={cityForm.slug} onChange={e => setCityForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="wroclaw" /></div>
        </AdminModal>
      )}

      {showLocModal && (
        <AdminModal
          title={editLoc ? t('admin.cities.editLocationTitle') : t('admin.cities.newLocationTitle')}
          subtitle={t('admin.cities.locationModalSubtitle')}
          onClose={() => setShowLocModal(false)}
          footer={<button className="admin-button admin-button-primary" type="button" onClick={saveLoc}>{t('admin.common.save')}</button>}
        >
          <div className="input-group"><label className="input-label">{t('admin.fields.name')}</label><input className="input" value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="input-group admin-address-field">
            <label className="input-label">{t('admin.fields.address')}</label>
            <input
              className="input"
              ref={locAddressInputRef}
              value={locForm.address}
              onChange={e => {
                const address = e.target.value;
                setLocForm(f => ({ ...f, address }));
                setAddressStatus(address.trim() ? 'manual' : 'idle');
                setAddressDebug('');
              }}
              placeholder={t('admin.cities.addressPlaceholder')}
            />
            <p className={`admin-address-helper is-${addressStatus}`}>{t(`admin.cities.addressHints.${addressStatus}`)}</p>
            {addressStatus === 'unavailable' && addressDebug && (
              <p className="admin-address-debug">{t('admin.cities.addressDebug').replace('{reason}', addressDebug)}</p>
            )}
            {addressSuggestions.length > 0 && (
              <div className="admin-address-suggestions">
                {addressSuggestions.map((suggestion, index) => (
                  <button className="admin-address-suggestion" type="button" key={`${addressSuggestionLabel(suggestion)}-${index}`} onClick={() => chooseAddressSuggestion(suggestion)}>
                    <span>{addressSuggestionMain(suggestion)}</span>
                    {addressSuggestionSecondary(suggestion) && <small>{addressSuggestionSecondary(suggestion)}</small>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="input-group"><label className="input-label">{t('admin.fields.description')}</label><input className="input" value={locForm.description} onChange={e => setLocForm(f => ({ ...f, description: e.target.value }))} /></div>
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

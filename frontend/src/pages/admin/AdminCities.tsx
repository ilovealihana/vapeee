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

type AdminGoogleWindow = Window & {
  google?: {
    maps?: {
      places?: {
        Autocomplete?: GooglePlacesAutocompleteCtor;
      };
      importLibrary?: (name: 'places') => Promise<{ Autocomplete?: GooglePlacesAutocompleteCtor }>;
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
  if (win.google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (win.google?.maps?.importLibrary) {
    return win.google.maps.importLibrary('places').then((library) => {
      if (library.Autocomplete && win.google?.maps) {
        win.google.maps.places = { ...win.google.maps.places, Autocomplete: library.Autocomplete };
      }
    });
  }

  const key = adminGoogleMapsKey();
  if (!key) return Promise.reject(new Error('google maps key unavailable'));

  const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-selector="true"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('google maps load failed')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsSelector = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('google maps load failed')), { once: true });
    document.head.appendChild(script);
  });
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
        if (!win?.google?.maps?.places?.Autocomplete && win?.google?.maps?.importLibrary) {
          const library = await win.google.maps.importLibrary('places');
          if (library.Autocomplete && win.google?.maps) {
            win.google.maps.places = { ...win.google.maps.places, Autocomplete: library.Autocomplete };
          }
        }
        if (cancelled) return;
        const Autocomplete = adminGoogleWindow()?.google?.maps?.places?.Autocomplete;
        if (!Autocomplete) return;
        const autocomplete = new Autocomplete(input, {
          fields: ['formatted_address', 'geometry', 'name'],
          componentRestrictions: { country: 'pl' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const address = place.formatted_address || place.name || input.value;
          setLocForm(f => ({ ...f, address }));
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, [showLocModal]);

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
      await loadLocations(locCityId);
    } catch (e: any) {
      setError(e.message);
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
          <div className="input-group"><label className="input-label">{t('admin.fields.address')}</label><input className="input" ref={locAddressInputRef} value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} /></div>
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

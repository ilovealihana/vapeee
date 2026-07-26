import { create } from 'zustand';
import type { Cart, CatalogSourceLocation, CatalogSources } from '../api/client';

export const CATALOG_SOURCE_STORAGE_KEY = 'catalog.selectedSource.v1';

export type SelectedCatalog =
  | {
      type: 'local_point';
      locationId: number;
      cityId: number;
      name: string;
      status: 'available' | 'coming_soon' | 'inactive';
    }
  | {
      type: 'inpost';
      status: 'available' | 'inactive';
    };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface CatalogSourceStore {
  sources: CatalogSources | null;
  selectedSource: SelectedCatalog | null;
  loading: boolean;
  error: unknown;
  loadSources: () => Promise<void>;
  hydrateFromCart: (cart: Cart | null) => void;
  selectSource: (target: SelectedCatalog, cart: Cart | null, clearCart: () => Promise<void>) => Promise<void>;
  clearSelectedSource: () => void;
}

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function sourceFromApiLocation(location: CatalogSourceLocation): SelectedCatalog {
  return {
    type: 'local_point',
    locationId: location.id,
    cityId: location.city_id,
    name: location.name,
    status: location.status,
  };
}

export function findLocationSource(
  sources: CatalogSources,
  locationId: number,
): SelectedCatalog | null {
  for (const city of sources.cities) {
    const location = city.locations.find((item) => item.id === locationId);
    if (location) return sourceFromApiLocation(location);
  }
  return null;
}

export function validateSelectedSource(
  source: SelectedCatalog | null,
  sources: CatalogSources | null,
): SelectedCatalog | null {
  if (!source || !sources) return null;
  if (source.type === 'inpost') {
    return {
      type: 'inpost',
      status: sources.inpost.status,
    };
  }
  return findLocationSource(sources, source.locationId);
}

export function selectedSourceFromCart(
  cart: Cart | null,
  sources: CatalogSources | null,
): SelectedCatalog | null {
  if (!cart?.source || !sources) return null;
  if (cart.source.type === 'inpost') {
    return {
      type: 'inpost',
      status: sources.inpost.status,
    };
  }
  const locationId = cart.source.location_id;
  return typeof locationId === 'number' ? findLocationSource(sources, locationId) : null;
}

export function readStoredSource(storage: StorageLike | null): SelectedCatalog | null {
  if (!storage) return null;
  const raw = storage.getItem(CATALOG_SOURCE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SelectedCatalog;
    if (parsed.type === 'inpost' || parsed.type === 'local_point') return parsed;
  } catch {
    return null;
  }
  return null;
}

export function writeStoredSource(source: SelectedCatalog | null, storage: StorageLike | null): void {
  if (!storage) return;
  if (!source) {
    storage.removeItem(CATALOG_SOURCE_STORAGE_KEY);
    return;
  }
  storage.setItem(CATALOG_SOURCE_STORAGE_KEY, JSON.stringify(source));
}

export function resolveSelectedSource({
  cart,
  sources,
  storage = browserStorage(),
}: {
  cart: Cart | null;
  sources: CatalogSources | null;
  storage?: StorageLike | null;
}): SelectedCatalog | null {
  const cartSource = selectedSourceFromCart(cart, sources);
  if (cartSource) {
    writeStoredSource(cartSource, storage);
    return cartSource;
  }

  const stored = validateSelectedSource(readStoredSource(storage), sources);
  if (!stored) {
    writeStoredSource(null, storage);
    return null;
  }
  return stored;
}

export async function applySourceSwitch({
  target,
  current = null,
  cart,
  clearCart,
  storage = browserStorage(),
}: {
  target: SelectedCatalog;
  current?: SelectedCatalog | null;
  cart: Cart | null;
  clearCart: () => Promise<void>;
  storage?: StorageLike | null;
}): Promise<SelectedCatalog> {
  if (target.status !== 'available') {
    throw new Error('Catalog source is unavailable');
  }
  if (cart?.items?.length) {
    await clearCart();
  }
  writeStoredSource(target, storage);
  return target;
}

export const useCatalogSourceStore = create<CatalogSourceStore>((set, get) => ({
  sources: null,
  selectedSource: null,
  loading: false,
  error: null,

  loadSources: async () => {
    set({ loading: true, error: null });
    try {
      const { api } = await import('../api/client');
      const sources = await api.catalog.sources();
      const selectedSource = resolveSelectedSource({
        cart: null,
        sources,
        storage: browserStorage(),
      });
      set({ sources, selectedSource, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error });
    }
  },

  hydrateFromCart: (cart) => {
    const { sources } = get();
    const selectedSource = resolveSelectedSource({ cart, sources, storage: browserStorage() });
    set({ selectedSource });
  },

  selectSource: async (target, cart, clearCart) => {
    const selectedSource = await applySourceSwitch({
      target,
      current: get().selectedSource,
      cart,
      clearCart,
      storage: browserStorage(),
    });
    set({ selectedSource });
  },

  clearSelectedSource: () => {
    writeStoredSource(null, browserStorage());
    set({ selectedSource: null });
  },
}));

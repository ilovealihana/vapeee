/**
 * Admin API client — all requests require admin tg_id.
 */

import { parseApiError } from './errors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getInitData(): string {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  return localStorage.getItem('dev_init_data') || '';
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `tma ${getInitData()}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw await parseApiError(res);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ──────────────────────────────────────────────────

export interface AdminCity {
  id: number; name: string; slug: string;
  manager_tg_id?: number; is_active: boolean;
}

export interface AdminLocation {
  id: number; city_id: number; name: string; address: string;
  description?: string; is_active: boolean;
  has_manager: boolean; manager_tg_id?: number; catalog_available: boolean;
}

export interface AdminVariant {
  id: number; product_id: number;
  name_ru: string; name_pl: string; name_uk: string;
  price_override?: string;
}

export interface AdminProduct {
  id: number; name_ru: string; name_pl: string; name_uk: string;
  base_price: string; is_active: boolean; category_id?: number;
  description_ru?: string; description_pl?: string; description_uk?: string;
  variants: AdminVariant[];
}

export interface StockRow {
  location_id: number; location_name: string; city_name: string;
  variant_id: number; variant_name: string; product_name: string;
  quantity: number;
}

export interface AdminOrder {
  id: number; status: string; delivery_type: string;
  customer_name: string; customer_phone: string; customer_email: string;
  delivery_address?: string; scheduled_at?: string;
  products_total: string; delivery_cost: string; total: string;
  payment_method: string; comment?: string; created_at: string;
  items: any[];
}

export type AdminStaffRole = 'project_admin' | 'city_curator' | 'point_manager' | 'inpost_curator';

export interface AdminStaffAssignment {
  id: number;
  city_id?: number;
  city_name?: string;
  location_id?: number;
  location_name?: string;
}

export interface AdminStaffMember {
  id: number;
  tg_id: number;
  role: AdminStaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assignments: AdminStaffAssignment[];
}

export interface AdminStaffPayload {
  tg_id?: number;
  role?: AdminStaffRole;
  is_active?: boolean;
  city_ids?: number[];
  location_ids?: number[];
}

export interface AdminAccess {
  has_access: boolean;
  role?: AdminStaffRole;
}

// ── API ────────────────────────────────────────────────────

export const adminApi = {
  getAccess: () => req<AdminAccess>('/api/admin/access'),

  // Cities
  getCities: () => req<AdminCity[]>('/api/admin/cities'),
  createCity: (data: { name: string; slug: string; manager_tg_id?: number }) =>
    req<AdminCity>('/api/admin/cities', { method: 'POST', body: JSON.stringify(data) }),
  updateCity: (id: number, data: Partial<AdminCity>) =>
    req<AdminCity>(`/api/admin/cities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCity: (id: number) =>
    req<void>(`/api/admin/cities/${id}`, { method: 'DELETE' }),

  // Locations
  getLocations: (cityId: number) =>
    req<AdminLocation[]>(`/api/admin/cities/${cityId}/locations`),
  createLocation: (cityId: number, data: { name: string; address: string; description?: string }) =>
    req<AdminLocation>(`/api/admin/cities/${cityId}/locations`, { method: 'POST', body: JSON.stringify(data) }),
  updateLocation: (id: number, data: Partial<AdminLocation>) =>
    req<AdminLocation>(`/api/admin/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLocation: (id: number) =>
    req<void>(`/api/admin/locations/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: () => req<AdminProduct[]>('/api/admin/products'),
  createProduct: (data: { name_ru: string; name_pl: string; name_uk: string; base_price: string }) =>
    req<AdminProduct>('/api/admin/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: number, data: Partial<AdminProduct>) =>
    req<AdminProduct>(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: number) =>
    req<void>(`/api/admin/products/${id}`, { method: 'DELETE' }),

  // Variants
  createVariant: (productId: number, data: { name_ru: string; name_pl: string; name_uk: string; price_override?: string }) =>
    req<AdminVariant>(`/api/admin/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(data) }),
  updateVariant: (id: number, data: Partial<AdminVariant>) =>
    req<AdminVariant>(`/api/admin/variants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVariant: (id: number) =>
    req<void>(`/api/admin/variants/${id}`, { method: 'DELETE' }),

  // Stock
  getStock: () => req<StockRow[]>('/api/admin/stock'),
  updateStock: (items: { location_id: number; variant_id: number; quantity: number }[]) =>
    req<{ ok: boolean }>('/api/admin/stock', { method: 'PUT', body: JSON.stringify({ items }) }),

  // Orders
  getOrders: (status?: string, page = 0) => {
    const q = new URLSearchParams({ page: String(page) });
    if (status) q.set('status', status);
    return req<AdminOrder[]>(`/api/admin/orders?${q}`);
  },
  updateOrderStatus: (id: number, status: string) =>
    req<AdminOrder>(`/api/admin/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Staff
  getStaff: () => req<AdminStaffMember[]>('/api/admin/staff'),
  createStaff: (data: Required<Pick<AdminStaffPayload, 'tg_id' | 'role' | 'city_ids' | 'location_ids'>>) =>
    req<AdminStaffMember>('/api/admin/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id: number, data: AdminStaffPayload) =>
    req<AdminStaffMember>(`/api/admin/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaff: (id: number) =>
    req<void>(`/api/admin/staff/${id}`, { method: 'DELETE' }),
};

/**
 * API client — wraps fetch with auth header and base URL.
 */

import { parseApiError } from './errors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getInitData(): string {
  // In real Telegram Mini App
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  // Dev fallback — will fail signature check unless DEV_MODE on server
  return localStorage.getItem('dev_init_data') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const initData = getInitData();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `tma ${initData}`,
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

export interface User {
  id: number;
  tg_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  language_code: string;
  phone?: string;
  email?: string;
  created_at: string;
}

export interface Category {
  id: number;
  name_ru: string;
  name_pl: string;
  name_uk: string;
  sort_order: number;
}

export interface Variant {
  id: number;
  product_id: number;
  name_ru: string;
  name_pl: string;
  name_uk: string;
  image_file_id?: string;
  price_override?: string;
}

export interface Product {
  id: number;
  category_id?: number;
  name_ru: string;
  name_pl: string;
  name_uk: string;
  description_ru?: string;
  description_pl?: string;
  description_uk?: string;
  image_file_id?: string;
  base_price: string;
  is_active: boolean;
  variants: Variant[];
}

export interface LocationStockSummary {
  total_qty: number;
  last_sold?: string;
}

export interface Location {
  id: number;
  city_id: number;
  name: string;
  address: string;
  description?: string;
  curator_tg_username?: string;
  is_active: boolean;
  has_manager: boolean;
  manager_tg_id?: number;
  manager_tg_username?: string;
  catalog_available: boolean;
  stock_summary?: LocationStockSummary;
}

export interface City {
  id: number;
  name: string;
  slug: string;
  manager_tg_id?: number;
  is_active: boolean;
}

export interface CartItem {
  id: number;
  variant_id: number;
  quantity: number;
  variant?: Variant;
  product?: Product;
  price?: string;
  subtotal?: string;
}

export interface Cart {
  id: number;
  user_id: number;
  location_id?: number;
  items: CartItem[];
  total: string;
}

export interface Order {
  id: number;
  delivery_type: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address?: string;
  scheduled_at?: string;
  products_total: string;
  delivery_cost: string;
  total: string;
  payment_method: string;
  comment?: string;
  created_at: string;
  items: any[];
}

export interface CreateOrderRequest {
  delivery_type: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address?: string;
  location_id?: number;
  scheduled_date: string;
  scheduled_time: string;
  payment_method: string;
  comment?: string;
}

// ── API calls ──────────────────────────────────────────────

export const api = {
  auth: {
    me: () => request<User>('/api/user/me'),
    setLanguage: (language_code: string) =>
      request<User>('/api/user/language', {
        method: 'PATCH',
        body: JSON.stringify({ language_code }),
      }),
  },

  catalog: {
    cities: () => request<City[]>('/api/cities'),
    locations: (cityId: number) => request<Location[]>(`/api/cities/${cityId}/locations`),
    location: (id: number) => request<Location>(`/api/locations/${id}`),
    categories: () => request<Category[]>('/api/categories'),
    products: (params?: { category_id?: number; location_id?: number; page?: number }) => {
      const q = new URLSearchParams();
      if (params?.category_id) q.set('category_id', String(params.category_id));
      if (params?.location_id) q.set('location_id', String(params.location_id));
      if (params?.page) q.set('page', String(params.page));
      return request<Product[]>(`/api/products?${q}`);
    },
    product: (id: number, params?: { location_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.location_id) q.set('location_id', String(params.location_id));
      const suffix = q.toString() ? `?${q}` : '';
      return request<Product>(`/api/products/${id}${suffix}`);
    },
  },

  cart: {
    get: () => request<Cart>('/api/cart'),
    addItem: (variant_id: number, quantity = 1, location_id?: number) =>
      request<Cart>('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ variant_id, quantity, location_id }),
      }),
    updateItem: (itemId: number, quantity: number) =>
      request<Cart>(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      }),
    removeItem: (itemId: number) =>
      request<Cart>(`/api/cart/items/${itemId}`, { method: 'DELETE' }),
    clear: () => request<void>('/api/cart', { method: 'DELETE' }),
  },

  orders: {
    list: (page = 0) => request<Order[]>(`/api/orders?page=${page}`),
    create: (data: CreateOrderRequest) =>
      request<Order>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};

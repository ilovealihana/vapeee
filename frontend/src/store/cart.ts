import { create } from 'zustand';
import { type Cart, api } from '../api/client';

interface CartStore {
  cart: Cart | null;
  loading: boolean;
  error: unknown;
  fetchCart: () => Promise<void>;
  addItem: (variantId: number, quantity?: number, locationId?: number, sourceType?: 'inpost' | 'local_point') => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart: null,
  loading: false,
  error: null,

  fetchCart: async () => {
    set({ loading: true, error: null });
    try {
      const cart = await api.cart.get();
      set({ cart, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error });
    }
  },

  addItem: async (variantId, quantity = 1, locationId, sourceType) => {
    const cart = await api.cart.addItem(variantId, quantity, locationId, sourceType);
    set({ cart, error: null });
  },

  updateItem: async (itemId, quantity) => {
    const cart = await api.cart.updateItem(itemId, quantity);
    set({ cart, error: null });
  },

  removeItem: async (itemId) => {
    const cart = await api.cart.removeItem(itemId);
    set({ cart, error: null });
  },

  clearCart: async () => {
    await api.cart.clear();
    set({ cart: null, error: null });
  },

  itemCount: () => {
    const { cart } = get();
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));

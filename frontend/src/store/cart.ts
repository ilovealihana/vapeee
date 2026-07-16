import { create } from 'zustand';
import { type Cart, api } from '../api/client';

interface CartStore {
  cart: Cart | null;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (variantId: number, quantity?: number, locationId?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart: null,
  loading: false,

  fetchCart: async () => {
    set({ loading: true });
    try {
      const cart = await api.cart.get();
      set({ cart, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addItem: async (variantId, quantity = 1, locationId) => {
    const cart = await api.cart.addItem(variantId, quantity, locationId);
    set({ cart });
  },

  updateItem: async (itemId, quantity) => {
    const cart = await api.cart.updateItem(itemId, quantity);
    set({ cart });
  },

  removeItem: async (itemId) => {
    const cart = await api.cart.removeItem(itemId);
    set({ cart });
  },

  clearCart: async () => {
    await api.cart.clear();
    set({ cart: null });
  },

  itemCount: () => {
    const { cart } = get();
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));

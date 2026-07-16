import { create } from 'zustand';
import { type User, api } from '../api/client';

interface UserStore {
  user: User | null;
  loading: boolean;
  error: string | null;
  language: string;
  fetchUser: () => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  language: 'ru',

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const user = await api.auth.me();
      set({ user, language: user.language, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setLanguage: async (lang: string) => {
    try {
      const user = await api.auth.setLanguage(lang);
      set({ user, language: user.language });
    } catch (e: any) {
      console.error('Failed to set language', e);
    }
  },
}));

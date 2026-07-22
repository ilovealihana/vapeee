import { create } from 'zustand';
import { type User, api } from '../api/client';
import {
  type ActiveLocale,
  type SupportedLanguage,
  isSupportedLanguage,
  resolveActiveLocale,
  resolvePreferredLanguage,
  storeLanguage,
} from '../i18n';

interface UserStore {
  user: User | null;
  loading: boolean;
  error: string | null;
  language: SupportedLanguage;
  activeLocale: ActiveLocale;
  fetchUser: () => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
  updateContact: (data: { phone?: string | null; email?: string | null }) => Promise<void>;
}

const initialLanguage = resolvePreferredLanguage();
const initialActiveLocale = resolveActiveLocale(initialLanguage);

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  loading: false,
  error: null,
  language: initialLanguage,
  activeLocale: initialActiveLocale,

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const user = await api.auth.me();
      const language = resolvePreferredLanguage(user.language_code);
      const activeLocale = resolveActiveLocale(language);

      set({ user, language, activeLocale, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setLanguage: async (lang: string) => {
    if (!isSupportedLanguage(lang)) {
      return;
    }

    try {
      const user = await api.auth.setLanguage(lang);
      const language = resolvePreferredLanguage(user.language_code);
      const activeLocale = resolveActiveLocale(language);

      storeLanguage(language);
      set({ user, language, activeLocale, error: null });
    } catch (e: any) {
      set({ error: e.message || 'Failed to set language' });
      console.error('Failed to set language', e);
    }
  },

  updateContact: async (data) => {
    set({ loading: true, error: null });
    try {
      const user = await api.auth.updateContact(data);
      const language = resolvePreferredLanguage(user.language_code);
      const activeLocale = resolveActiveLocale(language);

      set({ user, language, activeLocale, loading: false, error: null });
    } catch (e: any) {
      set({ error: e.message || 'Failed to update contact', loading: false });
      throw e;
    }
  },
}));

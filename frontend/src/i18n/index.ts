import { useMemo } from 'react';
import ru from './locales/ru';

export const SUPPORTED_LANGUAGES = ['ru', 'en', 'pl', 'uk'] as const;
export const ACTIVE_LOCALES = ['ru'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type ActiveLocale = (typeof ACTIVE_LOCALES)[number];

const LOCALES = {
  ru,
} as const;

const STORAGE_KEY = 'vapeshop.language';

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      initDataUnsafe?: {
        user?: {
          language_code?: unknown;
        };
      };
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
  );
}

export function resolveActiveLocale(language: unknown): ActiveLocale {
  return ACTIVE_LOCALES.includes(language as ActiveLocale) ? (language as ActiveLocale) : 'ru';
}

export function readStoredLanguage(): SupportedLanguage | undefined {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function storeLanguage(language: SupportedLanguage): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable in SSR, tests or privacy-restricted browsers.
  }
}

export function telegramLanguage(): SupportedLanguage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const language = (window as TelegramWindow).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  return isSupportedLanguage(language) ? language : undefined;
}

export function resolvePreferredLanguage(profileLanguage?: unknown): SupportedLanguage {
  if (isSupportedLanguage(profileLanguage)) {
    return profileLanguage;
  }

  return readStoredLanguage() ?? telegramLanguage() ?? 'ru';
}

export function translate(key: string, locale: ActiveLocale = 'ru'): string {
  const segments = key.split('.');
  let current: unknown = LOCALES[locale];

  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return key;
    }

    current = current[segment];
  }

  return typeof current === 'string' ? current : key;
}

export function useI18n(locale: ActiveLocale = 'ru') {
  return useMemo(
    () => ({
      locale,
      t: (key: string) => translate(key, locale),
    }),
    [locale],
  );
}

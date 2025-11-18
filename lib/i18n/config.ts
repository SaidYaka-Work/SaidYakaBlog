export const locales = ['en', 'de', 'fr', 'tr', 'ja'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  tr: 'Türkçe',
  ja: '日本語',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  tr: '🇹🇷',
  ja: '🇯🇵',
};

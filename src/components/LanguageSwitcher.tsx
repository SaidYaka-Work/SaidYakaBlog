'use client';

import { usePathname } from 'next/navigation';
import { locales, localeFlags, type Locale } from '@/lib/i18n/config';

export default function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const pathname = usePathname();

  // Remove the current locale from pathname to get the base path
  const pathWithoutLocale = pathname.replace(`/${currentLocale}`, '') || '/';

  return (
    <div className="flex items-center gap-2">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => {
            if (locale !== currentLocale) {
              window.location.href = `/${locale}${pathWithoutLocale}`;
            }
          }}
          className={`text-2xl transition-all duration-200 ${
            locale === currentLocale
              ? 'scale-110 opacity-100'
              : 'opacity-50 hover:opacity-100 hover:scale-105'
          }`}
          title={locale.toUpperCase()}
          aria-label={`Switch to ${locale.toUpperCase()}`}
        >
          {localeFlags[locale]}
        </button>
      ))}
    </div>
  );
}

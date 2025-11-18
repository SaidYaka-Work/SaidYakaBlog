import React from 'react';
import Link from 'next/link';
import LanguageSwitcher from './LanguageSwitcher';
import { type Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

interface LayoutProps {
  children: React.ReactNode;
  locale: Locale;
}

export default function Layout({ children, locale }: LayoutProps) {
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 via-accent-50 to-primary-100">
      <header className="bg-white shadow-sm border-b border-primary-200 sticky top-0 z-50">
        <nav className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <Link href={`/${locale}`} className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent hover:opacity-80 transition-opacity">
              {t('site.title')}
            </Link>
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-8">
                <Link href={`/${locale}/posts`} className="text-lg text-gray-700 hover:text-primary-600 font-semibold transition-colors duration-200 relative group px-4 py-2">
                  {t('nav.posts')}
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></span>
                </Link>
                <Link href={`/${locale}/tags`} className="text-lg text-gray-700 hover:text-accent-600 font-semibold transition-colors duration-200 relative group px-4 py-2">
                  {t('nav.tags')}
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></span>
                </Link>
                <Link href={`/${locale}/about`} className="text-lg text-gray-700 hover:text-primary-600 font-semibold transition-colors duration-200 relative group px-4 py-2">
                  {t('nav.about')}
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></span>
                </Link>
              </div>
              <div className="border-l border-gray-300 pl-8">
                <LanguageSwitcher currentLocale={locale} />
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-grow container mx-auto px-4 py-12">
        {children}
      </main>

      <footer className="bg-gradient-to-r from-primary-900 via-primary-800 to-accent-900 text-white mt-auto">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <p className="text-primary-100 text-lg">© {new Date().getFullYear()} {t('site.title')}. All rights reserved.</p>
            <p className="text-primary-200 text-sm mt-2">Built with Next.js & Tailwind CSS</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 
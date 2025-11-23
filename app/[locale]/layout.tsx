import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import config from '@/config.json';
import { locales, type Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';
import Layout from '@/src/components/Layout';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params;

  const title = getTranslation(locale, 'site.title');
  const description = getTranslation(locale, 'site.description');

  return {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    keywords: config.keywords,
    authors: [{ name: config.author_name }],
    openGraph: {
      title,
      description,
      url: `${config.base_url}/${locale}`,
      siteName: title,
      type: 'website',
      locale: locale,
      alternateLocale: locales.filter(l => l !== locale),
    },
    alternates: {
      canonical: `${config.base_url}/${locale}`,
      languages: Object.fromEntries(
        locales.map(l => [l, `${config.base_url}/${l}`])
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  return (
    <>
      {/* Set lang attribute immediately via blocking script for SEO */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang = '${locale}';`,
        }}
      />
      <Layout locale={locale}>
        {children}
        <Analytics />
      </Layout>
    </>
  );
}

import type { Metadata } from 'next';
import { Instrument_Sans, Instrument_Serif } from 'next/font/google';
import './globals.css';
import {
  AUTHOR_NAME,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  SOCIAL,
  canonicalUrl,
  defaultOgImage,
  englishUrl,
} from '@/lib/site';
import config from '@/config.json';

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${AUTHOR_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: config.keywords,
  authors: [{ name: AUTHOR_NAME, url: englishUrl('/about') }],
  creator: AUTHOR_NAME,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: englishUrl('/'),
    siteName: AUTHOR_NAME,
    type: 'website',
    locale: 'en_US',
    images: [{ url: defaultOgImage, alt: `${AUTHOR_NAME}, AI engineer` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: SOCIAL.twitterHandle,
  },
  alternates: {
    canonical: englishUrl('/'),
    languages: {
      en: englishUrl('/'),
      'x-default': englishUrl('/'),
    },
    types: {
      'application/rss+xml': canonicalUrl('/feed.xml'),
    },
  },
  robots: {
    index: true,
    follow: true,
  },
};

const themeBoot = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (!stored && preferDark);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="bg-[var(--bg)] font-sans text-[var(--ink)] antialiased">{children}</body>
    </html>
  );
}

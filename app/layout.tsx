import type { Metadata } from 'next';
import config from '../config.json';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(config.base_url),
  title: {
    default: config.site_title,
    template: `%s | ${config.site_title}`,
  },
  description: config.site_description,
  keywords: config.keywords,
  authors: [{ name: config.author_name }],
  openGraph: {
    title: config.site_title,
    description: config.site_description,
    url: config.base_url,
    siteName: config.site_title,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: config.twitter_account,
    creator: config.twitter_account,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}

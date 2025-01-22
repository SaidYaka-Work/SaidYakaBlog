import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import config from '@/config.json';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

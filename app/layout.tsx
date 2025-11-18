import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Said Yaka',
  description: 'Exploring technology, development, and innovation',
};

// Root layout - required by Next.js
// Note: lang attribute is set dynamically by the [locale] layout via metadata
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning className="bg-gradient-to-br from-purple-50 via-orange-50 to-purple-100">
      <body className={`${inter.className} bg-transparent`}>{children}</body>
    </html>
  );
}

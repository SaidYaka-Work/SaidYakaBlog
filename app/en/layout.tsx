import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      {children}
      <Analytics />
    </Layout>
  );
}

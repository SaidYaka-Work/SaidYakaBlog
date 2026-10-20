import { retiredLocales } from '@/lib/retired-locales';

export function generateStaticParams() {
  return retiredLocales.map((locale) => ({ locale }));
}

export default function RetiredLocaleLayout({ children }: { children: React.ReactNode }) {
  return children;
}

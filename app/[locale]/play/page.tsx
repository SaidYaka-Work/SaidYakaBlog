import Link from 'next/link';
import { type Locale } from '@/lib/i18n/config';
import ClickRushGame from '@/src/components/ClickRushGame';

export default async function PlayPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  return (
    <div className="px-4">
      <div className="max-w-5xl mx-auto pt-8">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          ← Back home
        </Link>
      </div>
      <ClickRushGame />
    </div>
  );
}

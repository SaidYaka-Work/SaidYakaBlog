import type { Metadata } from 'next';
import Link from 'next/link';
import ClickRushGame from '@/components/ClickRushGame';
import { englishPath, englishUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Click Rush',
  description: 'A tiny reflex game hidden in saidyaka.com.',
  alternates: {
    canonical: englishUrl('/play'),
    languages: {
      en: englishUrl('/play'),
      'x-default': englishUrl('/play'),
    },
  },
};

export default function PlayPage() {
  return (
    <div className="px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={englishPath('/')}
          className="text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          ← Back home
        </Link>
      </div>
      <ClickRushGame />
    </div>
  );
}

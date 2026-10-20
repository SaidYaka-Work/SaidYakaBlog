import type { Metadata } from 'next';
import Link from 'next/link';
import HistoryBoard from '@/components/dog/HistoryBoard';
import { SOCIAL, defaultOgImage, englishPath, englishUrl } from '@/lib/site';

const title = 'Past dogs';
const description = 'The hall of dogs who lived on the saidyaka.com porch: how far they grew, how long they stayed.';
const url = englishUrl('/dog/history');

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'en_US',
    url,
    images: [{ url: defaultOgImage, alt: title }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    creator: SOCIAL.twitterHandle,
  },
  alternates: {
    canonical: url,
    languages: { en: url, 'x-default': url },
  },
};

export default function DogHistoryPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href={englishPath('/dog')} className="link-underline text-sm text-[var(--muted)]">
        ← Back to the porch
      </Link>
      <p className="hero-kicker mt-6 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Kennel book</p>
      <h1 className="hero-title mt-2 font-serif text-4xl tracking-tight sm:text-5xl">Past dogs</h1>
      <p className="hero-copy mt-4 max-w-xl text-[var(--muted)] leading-relaxed">
        Every dog who claimed this rug, rendered at the life stage they reached.
      </p>
      <HistoryBoard />
    </section>
  );
}

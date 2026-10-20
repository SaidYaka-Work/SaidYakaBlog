import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { englishPath, englishUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Topics',
  description: 'Browse Said Yaka’s AI engineering notes by topic.',
  alternates: {
    canonical: englishUrl('/tags'),
    languages: {
      en: englishUrl('/tags'),
      'x-default': englishUrl('/tags'),
    },
  },
  openGraph: {
    title: 'Topics | Said Yaka',
    description: 'Browse Said Yaka’s AI engineering notes by topic.',
    url: englishUrl('/tags'),
    type: 'website',
    locale: 'en_US',
  },
};

export default async function TagsPage() {
  const posts = await getAllPosts();
  const counts = posts.reduce<Record<string, number>>((acc, post) => {
    post.tags.forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});
  const tags = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="hero-kicker text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Index</p>
      <h1 className="hero-title mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Topics</h1>
      <p className="hero-copy mt-5 max-w-xl text-lg text-[var(--muted)]">
        A map of recurring problems: retrieval, evals, agents, and shipping.
      </p>
      <ul className="mt-14 grid gap-3 sm:grid-cols-2">
        {tags.map(([tag, count], index) => (
          <li
            key={tag}
            data-reveal
            style={{ '--reveal-delay': Math.min(index, 8) } as CSSProperties}
          >
            <Link
              href={englishPath(`/tags/${encodeURIComponent(tag.toLowerCase())}`)}
              className="lift-card flex items-baseline justify-between rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] px-5 py-4"
            >
              <span className="font-serif text-2xl tracking-tight">{tag}</span>
              <span className="text-sm text-[var(--faint)]">
                {count} {count === 1 ? 'post' : 'posts'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

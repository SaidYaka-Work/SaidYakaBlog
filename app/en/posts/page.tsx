import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { SITE_DESCRIPTION, englishPath, englishUrl, formatDate } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Writing',
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: englishUrl('/posts'),
    languages: {
      en: englishUrl('/posts'),
      'x-default': englishUrl('/posts'),
    },
  },
  openGraph: {
    title: 'Writing | Said Yaka',
    description: SITE_DESCRIPTION,
    url: englishUrl('/posts'),
    type: 'website',
    locale: 'en_US',
  },
};

export default async function PostsPage() {
  const posts = await getAllPosts();

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="hero-kicker text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Index</p>
      <h1 className="hero-title mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Writing</h1>
      <p className="hero-copy mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
        Essays on retrieval, evals, agents, and the product work around production LLMs.
      </p>

      <ol className="mt-14 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {posts.map((post, index) => (
          <li
            key={post.slug}
            className="py-8"
            data-reveal
            style={{ '--reveal-delay': Math.min(index, 8) } as CSSProperties}
          >
            <article>
              <time dateTime={post.date} className="text-sm text-[var(--faint)]">
                {formatDate(post.date)}
              </time>
              <h2 className="mt-2 font-serif text-3xl tracking-tight">
                <Link
                  href={englishPath(`/posts/${post.slug}`)}
                  className="link-underline hover:text-[var(--accent)]"
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-[var(--muted)]">
                {post.description}
              </p>
              {post.tags.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
                  {post.tags.map((tag) => (
                    <li key={tag}>
                      <Link
                        href={englishPath(`/tags/${encodeURIComponent(tag.toLowerCase())}`)}
                        className="link-underline text-sm text-[var(--faint)] hover:text-[var(--ink)]"
                      >
                        {tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}

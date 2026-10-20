import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import {
  AUTHOR_NAME,
  SITE_DESCRIPTION,
  SITE_URL,
  SOCIAL,
  englishPath,
  englishUrl,
  formatDate,
} from '@/lib/site';
import SocialLinks from '@/components/SocialLinks';

export const metadata: Metadata = {
  title: { absolute: 'Said Yaka — AI Engineering Notes' },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: englishUrl('/'),
    languages: {
      en: englishUrl('/'),
      'x-default': englishUrl('/'),
    },
  },
  openGraph: {
    title: 'Said Yaka — AI Engineering Notes',
    description: SITE_DESCRIPTION,
    url: englishUrl('/'),
    type: 'website',
    locale: 'en_US',
  },
};

export default async function HomePage() {
  const posts = await getAllPosts();
  const [featured, ...rest] = posts;
  const recent = rest.slice(0, 6);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: AUTHOR_NAME,
        url: SITE_URL,
        inLanguage: 'en',
        description: SITE_DESCRIPTION,
        potentialAction: {
          '@type': 'ReadAction',
          target: englishUrl('/posts'),
        },
      },
      {
        '@type': 'Person',
        name: AUTHOR_NAME,
        jobTitle: 'AI Engineer',
        url: englishUrl('/'),
        worksFor: {
          '@type': 'Organization',
          name: 'Evertune.ai',
          url: 'https://evertune.ai',
        },
        sameAs: [SOCIAL.githubAlt, SOCIAL.linkedin, SOCIAL.twitter],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <section className="hero-shell mx-auto max-w-6xl px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
        <div className="hero-accent" aria-hidden="true" />
        <p className="hero-kicker text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          AI engineer at Evertune
        </p>
        <h1 className="hero-title mt-5 max-w-4xl font-serif text-5xl leading-[0.95] tracking-tight text-[var(--ink)] sm:text-7xl">
          Notes on making language models hold up in production.
        </h1>
        <p className="hero-copy mt-8 max-w-2xl text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
          I&apos;m Said Yaka. I write about retrieval, evaluations, agent interfaces, and the
          unglamorous work of shipping LLM systems people can trust.
        </p>
        <div className="hero-actions mt-10 flex flex-wrap items-center gap-6">
          <Link
            href={englishPath('/posts')}
            className="pressable inline-flex items-center rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
          >
            Read the writing
          </Link>
          <SocialLinks />
        </div>
      </section>

      {featured && (
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <div
            data-reveal
            className="lift-card overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--bg-elevated)]"
          >
            <Link href={englishPath(`/posts/${featured.slug}`)} className="group block p-6 sm:p-10">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--faint)]">
                <span>Latest</span>
                <span aria-hidden="true">·</span>
                <time dateTime={featured.date}>{formatDate(featured.date)}</time>
              </div>
              <h2 className="mt-5 max-w-4xl font-serif text-3xl leading-tight tracking-tight text-[var(--ink)] sm:text-5xl">
                {featured.title}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
                {featured.description}
              </p>
              <span className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--ink)]">
                Continue reading
                <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">
                  →
                </span>
              </span>
            </Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 pb-6 pt-4 sm:px-8">
        <Link
          href={englishPath('/dog')}
          className="lift-card flex flex-col gap-2 rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">The porch</p>
            <p className="mt-2 font-serif text-2xl tracking-tight">The internet has a dog</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Biscuit lives here. Everyone who visits looks after the same one.
            </p>
          </div>
          <span className="text-sm text-[var(--ink)]">Meet him →</span>
        </Link>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 pt-6 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl tracking-tight">Recent writing</h2>
          <Link
            href={englishPath('/posts')}
            className="link-underline text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            All posts
          </Link>
        </div>
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {recent.map((post, index) => (
            <li
              key={post.slug}
              data-reveal
              style={{ '--reveal-delay': index } as CSSProperties}
            >
              <Link
                href={englishPath(`/posts/${post.slug}`)}
                className="group grid gap-2 py-6 sm:grid-cols-[7rem_1fr] sm:gap-8"
              >
                <time
                  dateTime={post.date}
                  className="pt-1 text-sm text-[var(--faint)]"
                >
                  {formatDate(post.date)}
                </time>
                <div>
                  <h3 className="font-serif text-2xl tracking-tight text-[var(--ink)] group-hover:text-[var(--accent)]">
                    {post.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                    {post.description}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

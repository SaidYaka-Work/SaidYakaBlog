import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllPosts, getAllTags } from '@/lib/posts';
import { englishPath, englishUrl, formatDate } from '@/lib/site';

export async function generateStaticParams() {
  const tags = await getAllTags();
  return tags.map((tag) => ({ tag: tag.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const title = `Posts tagged ${decoded}`;
  const url = englishUrl(`/tags/${decoded}`);
  return {
    title,
    description: `Essays tagged ${decoded} by Said Yaka.`,
    alternates: {
      canonical: url,
      languages: { en: url, 'x-default': url },
    },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: tagParam } = await params;
  const tag = decodeURIComponent(tagParam);
  const posts = (await getAllPosts()).filter((post) =>
    post.tags.some((item) => item.toLowerCase() === tag.toLowerCase())
  );

  if (posts.length === 0) notFound();

  const label = posts[0].tags.find((item) => item.toLowerCase() === tag.toLowerCase()) || tag;

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="hero-kicker text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Topic</p>
      <h1 className="hero-title mt-3 font-serif text-5xl tracking-tight">{label}</h1>
      <p className="mt-4 text-[var(--muted)]">
        {posts.length} {posts.length === 1 ? 'essay' : 'essays'}
      </p>
      <ol className="mt-12 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {posts.map((post, index) => (
          <li
            key={post.slug}
            className="py-7"
            data-reveal
            style={{ '--reveal-delay': Math.min(index, 8) } as CSSProperties}
          >
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
            <p className="mt-3 max-w-2xl text-[var(--muted)]">{post.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

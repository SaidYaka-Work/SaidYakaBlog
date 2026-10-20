import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import TableOfContents from '@/components/TableOfContents';
import { markdownToHtml } from '@/lib/markdown';
import { getAllPosts, getPostBySlug } from '@/lib/posts';
import {
  AUTHOR_NAME,
  SOCIAL,
  defaultOgImage,
  englishPath,
  englishUrl,
  formatDate,
  readingTime,
} from '@/lib/site';
import config from '@/config.json';

export async function generateStaticParams() {
  const posts = await getAllPosts({ includeFuture: true });
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug, { includeFuture: true });
  if (!post) return {};

  const title = post.ogTitle || post.title;
  const description = post.ogDescription || post.description;
  const url = englishUrl(`/posts/${post.slug}`);

  return {
    title,
    description,
    keywords: post.keywords.length ? post.keywords : config.keywords,
    authors: [{ name: post.author }],
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
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
      languages: {
        en: url,
        'x-default': url,
      },
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const content = await markdownToHtml(post.content);
  const minutes = readingTime(post.content);
  const allPosts = await getAllPosts();
  const firstTag = post.tags[0];
  const related = firstTag
    ? allPosts
        .filter(
          (item) =>
            item.slug !== post.slug &&
            item.tags.some((tag) => tag.toLowerCase() === firstTag.toLowerCase())
        )
        .slice(0, 3)
    : [];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    inLanguage: 'en',
    author: {
      '@type': 'Person',
      name: post.author,
      url: englishUrl('/about'),
    },
    datePublished: post.date,
    dateModified: post.date,
    url: englishUrl(`/posts/${post.slug}`),
    mainEntityOfPage: englishUrl(`/posts/${post.slug}`),
    keywords: post.tags.join(', '),
    publisher: {
      '@type': 'Organization',
      name: config.seo.organization || AUTHOR_NAME,
      url: 'https://evertune.ai',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,42rem)_16rem] lg:justify-between">
          <article>
            <header className="mb-10">
              <p className="text-sm text-[var(--faint)]">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span aria-hidden="true"> · </span>
                <span>{minutes} min read</span>
              </p>
              <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">
                {post.title}
              </h1>
              {post.tags.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-x-3 gap-y-1">
                  {post.tags.map((tag) => (
                    <li key={tag}>
                      <Link
                        href={englishPath(`/tags/${encodeURIComponent(tag.toLowerCase())}`)}
                        className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        {tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </header>

            <div
              className="prose prose-essay prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />

            {related.length > 0 && (
              <section className="mt-16 border-t border-[var(--line)] pt-10">
                <h2 className="font-serif text-3xl tracking-tight">More on {firstTag}</h2>
                <ul className="mt-6 space-y-6">
                  {related.map((item) => (
                    <li key={item.slug}>
                      <Link href={englishPath(`/posts/${item.slug}`)} className="group block">
                        <h3 className="font-serif text-2xl tracking-tight group-hover:text-[var(--accent)]">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                          {item.description}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>

          <aside className="hidden lg:block">
            <TableOfContents content={content} />
          </aside>
        </div>
      </div>
    </>
  );
}

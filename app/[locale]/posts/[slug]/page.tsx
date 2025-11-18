import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug, getAllPosts } from '@/lib/posts';
import { markdownToHtml } from '@/lib/markdown';
import TableOfContents from '@/components/TableOfContents';
import type { Metadata } from 'next';
import { type Locale, locales } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';
import config from '@/config.json';

export async function generateStaticParams() {
  const params = [];

  for (const locale of locales) {
    const posts = await getAllPosts({ locale });
    params.push(...posts.map(post => ({
      locale,
      slug: post.slug,
    })));
  }

  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: Locale }> }): Promise<Metadata> {
  const { slug, locale } = await params;
  const post = await getPostBySlug(slug, { locale });
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      locale: locale,
      alternateLocale: locales.filter(l => l !== locale),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
    alternates: {
      canonical: `${config.base_url}/${locale}/posts/${slug}`,
      languages: Object.fromEntries(
        locales.map(l => [l, `${config.base_url}/${l}/posts/${slug}`])
      ),
    },
  };
}

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

export default async function Page({ params }: { params: Promise<{ slug: string; locale: Locale }> }) {
  try {
    const { slug, locale } = await params;
    const post = await getPostBySlug(slug, { locale });
    const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

    if (!post) {
      return notFound();
    }

    const content = await markdownToHtml(post.content);
    const readingTime = calculateReadingTime(post.content);

    // Get related posts based on first tag
    const allPosts = await getAllPosts({ locale });
    const firstTag = post.tags[0];
    const relatedPosts = firstTag
      ? allPosts
          .filter(p =>
            p.slug !== post.slug &&
            p.tags.map(t => t.toLowerCase()).includes(firstTag.toLowerCase())
          )
          .slice(0, 3)
      : [];

    // JSON-LD Schema for BlogPosting
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      inLanguage: locale,
      author: {
        '@type': 'Person',
        name: post.author,
        url: `${config.base_url}/${locale}/about`,
      },
      datePublished: post.date,
      dateModified: post.date,
      url: `${config.base_url}/${locale}/posts/${post.slug}`,
      keywords: post.tags.join(', '),
      articleBody: post.content,
      publisher: {
        '@type': 'Organization',
        name: 'Evertune.ai',
        url: 'https://evertune.ai',
      },
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8 relative">
            {/* Main content */}
            <article className="max-w-3xl min-w-0">
              <header className="mb-8">
                <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
                <div className="flex items-center gap-4 text-gray-600 mb-4">
                  <span>{post.date}</span>
                  <span>•</span>
                  <span>{readingTime} {t('posts.minRead')}</span>
                </div>
                <div className="flex gap-2">
                  {post.tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={`/${locale}/tags/${encodeURIComponent(tag.toLowerCase())}`}
                      className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </header>
              <div
                className="prose lg:prose-lg prose-gray"
                dangerouslySetInnerHTML={{ __html: content }}
              />

              {relatedPosts.length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <h3 className="text-2xl font-bold mb-6">
                    {t('posts.relatedPosts')} {firstTag}
                  </h3>
                  <div className="space-y-4">
                    {relatedPosts.map(relatedPost => (
                      <Link
                        key={relatedPost.slug}
                        href={`/${locale}/posts/${relatedPost.slug}`}
                        className="block p-4 border border-gray-200 rounded-lg hover:border-blue-600 hover:shadow-md transition-all group"
                      >
                        <h4 className="text-lg font-semibold mb-2 group-hover:text-blue-600">
                          {relatedPost.title}
                        </h4>
                        <p className="text-gray-600 text-sm mb-2">{relatedPost.excerpt}</p>
                        <span className="text-sm text-gray-500">{relatedPost.date}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* Table of Contents - Desktop only */}
            <aside className="hidden lg:block">
              <TableOfContents content={content} />
            </aside>
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error('Error rendering post:', error);
    return notFound();
  }
} 
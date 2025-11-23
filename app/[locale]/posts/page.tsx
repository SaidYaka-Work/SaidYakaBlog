import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { type Locale, locales } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';
import config from '@/config.json';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  return {
    title: t('posts.title'),
    description: t('posts.subtitle'),
    authors: [{ name: config.author_name }],
    openGraph: {
      title: t('posts.title'),
      description: t('posts.subtitle'),
      url: `${config.base_url}/${locale}/posts`,
      type: 'website',
      locale: locale,
      alternateLocale: locales.filter(l => l !== locale),
    },
    alternates: {
      canonical: `${config.base_url}/${locale}/posts`,
      languages: Object.fromEntries(
        locales.map(l => [l, `${config.base_url}/${l}/posts`])
      ),
    },
  };
}

export default async function Posts({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const posts = await getAllPosts({ locale });
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent pb-2">{t('posts.title')}</h1>
        <p className="text-gray-600 text-lg">{t('posts.subtitle')}</p>
      </div>
      <div className="space-y-6">
        {posts.map((post) => (
          <article key={post.slug} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-primary-100 group">
            <div className="p-8">
              <Link
                href={`/${locale}/posts/${post.slug}`}
                className="block"
              >
                <h2 className="text-3xl font-bold mb-3 text-gray-900 group-hover:bg-gradient-primary group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                  {post.title}
                </h2>
              </Link>
              <div className="flex items-center gap-2 text-primary-600 mb-4 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">{post.date}</span>
              </div>
              <p className="text-gray-600 mb-5 leading-relaxed text-lg">{post.excerpt}</p>
              <div className="flex gap-2 flex-wrap">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/${locale}/tags/${encodeURIComponent(tag.toLowerCase())}`}
                    className="text-sm bg-gradient-to-r from-primary-50 to-accent-50 text-primary-700 px-4 py-2 rounded-full hover:from-primary-500 hover:to-accent-500 hover:text-white transition-all duration-200 font-medium border border-primary-200 hover:border-transparent"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
            <div className="h-2 bg-gradient-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
          </article>
        ))}
      </div>
    </div>
  );
} 
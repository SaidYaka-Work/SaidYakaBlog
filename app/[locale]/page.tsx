import HomeContent from '@/src/components/HomeContent';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { type Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const posts = await getAllPosts({ locale });
  const latestPost = posts[0]; // Posts are sorted by date, most recent first
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  // JSON-LD Schema for Website/Person
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: 'Said Yaka',
      jobTitle: 'AI Engineer',
      worksFor: {
        '@type': 'Organization',
        name: 'Evertune.ai',
        url: 'https://evertune.ai',
      },
      url: 'https://saidyaka.com',
      sameAs: [
        'https://github.com/SaidYaka-Work',
        'https://www.linkedin.com/in/saidyaka/',
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <HomeContent locale={locale} />
      {latestPost && (
        <div className="max-w-4xl mx-auto mt-20 px-4">
          <div className="bg-white border-2 border-primary-200 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-primary"></div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-gradient-primary animate-pulse"></div>
              <div className="text-sm font-bold text-primary-600 uppercase tracking-wider">Latest Post</div>
            </div>
            <Link href={`/${locale}/posts/${latestPost.slug}`} className="block">
              <h2 className="text-3xl font-bold mb-3 text-gray-900 group-hover:bg-gradient-primary group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                {latestPost.title}
              </h2>
              <p className="text-gray-600 mb-5 leading-relaxed text-lg">{latestPost.excerpt}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary-600 font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">{latestPost.date}</span>
                </div>
                <span className="text-primary-600 font-semibold group-hover:gap-3 flex items-center gap-2 transition-all duration-300">
                  {t('posts.readMore')}
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </div>
            </Link>
          </div>
        </div>
      )}
    </>
  );
} 
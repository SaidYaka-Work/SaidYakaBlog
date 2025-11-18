import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { type Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

export default async function TagsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const posts = await getAllPosts({ locale });
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  // Get all unique tags and their counts
  const tagCounts = posts.reduce((acc, post) => {
    post.tags.forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  // Sort tags by count (descending)
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">{t('tags.title')}</h1>
        <p className="text-gray-600 text-lg">{t('tags.subtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        {sortedTags.map(([tag, count]) => (
          <Link
            key={tag}
            href={`/${locale}/tags/${encodeURIComponent(tag.toLowerCase())}`}
            className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-primary-50 to-accent-50 text-primary-700 rounded-full hover:from-primary-500 hover:to-accent-500 hover:text-white hover:scale-105 transition-all duration-300 font-semibold border-2 border-primary-200 hover:border-transparent shadow-md hover:shadow-xl group"
          >
            <span className="text-lg">#{tag}</span>
            <span className="text-sm bg-white/50 group-hover:bg-white/30 px-2.5 py-1 rounded-full transition-colors">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
} 
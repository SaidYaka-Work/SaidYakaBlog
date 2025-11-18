import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { type Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

const RECOMMENDED_SLUGS = [
  'profound-vs-evertune-fair-comparison',
  'evertune-site-audit-traffic-growth',
  '10-ai-tools-to-optimize-your-work-and-life',
];

interface RecommendedPostsProps {
  locale: Locale;
}

export default async function RecommendedPosts({ locale }: RecommendedPostsProps) {
  const allPosts = await getAllPosts({ locale });
  const recommendedPosts = allPosts.filter((post) => RECOMMENDED_SLUGS.includes(post.slug));

  if (recommendedPosts.length === 0) {
    return null;
  }

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  return (
    <aside className="hidden lg:block w-64 pr-8">
      <div className="sticky top-24">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('sidebar.readThese')}</h3>
        <ul className="space-y-3">
          {recommendedPosts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/${locale}/posts/${post.slug}`}
                className="text-sm text-gray-700 hover:text-primary-600 hover:underline transition-colors line-clamp-2"
              >
                {post.title}
              </Link>
              <p className="text-xs text-gray-500 mt-1">{post.date}</p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}


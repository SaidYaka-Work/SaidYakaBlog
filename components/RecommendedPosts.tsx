import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';

const RECOMMENDED_SLUGS = [
  'profound-vs-evertune-fair-comparison',
  'evertune-site-audit-traffic-growth',
  '10-ai-tools-to-optimize-your-work-and-life',
];

export default async function RecommendedPosts() {
  const allPosts = await getAllPosts();
  const recommendedPosts = allPosts.filter((post) => RECOMMENDED_SLUGS.includes(post.slug));

  if (recommendedPosts.length === 0) {
    return null;
  }

  return (
    <aside className="hidden lg:block w-64 pr-8">
      <div className="sticky top-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Read these</h3>
        <ul className="space-y-3">
          {recommendedPosts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/posts/${post.slug}`}
                className="text-sm text-gray-700 hover:text-blue-600 hover:underline transition-colors line-clamp-2"
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

import Layout from '@/components/Layout';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';

export default async function TagsPage() {
  const posts = await getAllPosts();
  
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
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Tags</h1>
        <div className="flex flex-wrap gap-4">
          {sortedTags.map(([tag, count]) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <span>{tag}</span>
              <span className="text-sm text-gray-500">({count})</span>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
} 
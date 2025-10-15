import Layout from '@/components/Layout';
import HomeContent from '@/src/components/HomeContent';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';

export default async function Home() {
  const posts = await getAllPosts();
  const latestPost = posts[0]; // Posts are sorted by date, most recent first

  return (
    <Layout>
      <HomeContent />
      {latestPost && (
        <div className="max-w-4xl mx-auto mt-16 px-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm text-gray-500 mb-2">Latest Post</div>
            <Link href={`/posts/${latestPost.slug}`} className="group">
              <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-600 transition-colors">
                {latestPost.title}
              </h2>
              <p className="text-gray-600 mb-4">{latestPost.excerpt}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{latestPost.date}</span>
                <span className="text-blue-600 font-medium group-hover:underline">
                  Read more →
                </span>
              </div>
            </Link>
          </div>
        </div>
      )}
    </Layout>
  );
} 
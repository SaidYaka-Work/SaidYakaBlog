import Layout from '@/components/Layout';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';

export default async function Posts() {
  const posts = await getAllPosts();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Blog Posts</h1>
        <div className="space-y-8">
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-gray-200 pb-8">
              <div className="block group">
                <Link 
                  href={`/posts/${post.slug}`}
                  className="block group"
                >
                  <h2 className="text-2xl font-semibold mb-2 group-hover:text-gray-600">
                    {post.title}
                  </h2>
                </Link>
                <div className="text-gray-600 mb-2">{post.date}</div>
                <p className="text-gray-700 mb-4">{post.excerpt}</p>
                <div className="flex gap-2">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}
                      className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Layout>
  );
} 
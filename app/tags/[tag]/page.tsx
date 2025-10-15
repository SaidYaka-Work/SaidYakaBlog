import Layout from '@/components/Layout';
import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  const tagsSet = new Set<string>();

  posts.forEach(post => {
    post.tags.forEach(tag => {
      tagsSet.add(tag.toLowerCase());
    });
  });

  return Array.from(tagsSet).map(tag => ({
    tag: tag,
  }));
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: tagParam } = await params;
  const posts = await getAllPosts();
  const tag = decodeURIComponent(tagParam);
  
  // Filter posts by tag
  const filteredPosts = posts.filter(post => 
    post.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
  );

  if (filteredPosts.length === 0) {
    return notFound();
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Posts tagged with &quot;{tag}&quot;</h1>
        <div className="space-y-8">
          {filteredPosts.map((post) => (
            <article key={post.slug} className="border-b border-gray-200 pb-8">
              <Link 
                href={`/posts/${post.slug}`}
                className="block group"
              >
                <h2 className="text-2xl font-semibold mb-2 group-hover:text-gray-600">
                  {post.title}
                </h2>
                <div className="text-gray-600 mb-2">{post.date}</div>
                <p className="text-gray-700 mb-4">{post.excerpt}</p>
                <div className="flex gap-2">
                  {post.tags.map((t) => (
                    <span
                      key={t}
                      className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </Layout>
  );
} 
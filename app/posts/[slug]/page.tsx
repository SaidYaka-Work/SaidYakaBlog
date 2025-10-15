import Layout from '@/components/Layout';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug, getAllPosts } from '@/lib/posts';
import { markdownToHtml } from '@/lib/markdown';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => ({
    slug: post.slug,
  }));
}

// @ts-expect-error Next.js page props type issue
export default async function Page(props) {
  try {
    const post = await getPostBySlug(props.params.slug);

    if (!post) {
      return notFound();
    }

    const content = await markdownToHtml(post.content);

    return (
      <Layout>
        <article className="max-w-3xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
            <div className="text-gray-600 mb-4">{post.date}</div>
            <div className="flex gap-2">
              {post.tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}
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
        </article>
      </Layout>
    );
  } catch (error) {
    console.error('Error rendering post:', error);
    return notFound();
  }
} 
import Layout from '@/components/Layout';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug, getAllPosts } from '@/lib/posts';
import { markdownToHtml } from '@/lib/markdown';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  };
}

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

// @ts-expect-error Next.js page props type issue
export default async function Page(props) {
  try {
    const post = await getPostBySlug(props.params.slug);

    if (!post) {
      return notFound();
    }

    const content = await markdownToHtml(post.content);
    const readingTime = calculateReadingTime(post.content);

    // Get related posts based on first tag
    const allPosts = await getAllPosts();
    const firstTag = post.tags[0];
    const relatedPosts = firstTag
      ? allPosts
          .filter(p =>
            p.slug !== post.slug &&
            p.tags.map(t => t.toLowerCase()).includes(firstTag.toLowerCase())
          )
          .slice(0, 3)
      : [];

    // JSON-LD Schema for BlogPosting
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      author: {
        '@type': 'Person',
        name: post.author,
        url: 'https://saidyaka.com/about',
      },
      datePublished: post.date,
      dateModified: post.date,
      url: `https://saidyaka.com/posts/${post.slug}`,
      keywords: post.tags.join(', '),
      articleBody: post.content,
      publisher: {
        '@type': 'Organization',
        name: 'Evertune.ai',
        url: 'https://evertune.ai',
      },
    };

    return (
      <Layout>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        <article className="max-w-3xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
            <div className="flex items-center gap-4 text-gray-600 mb-4">
              <span>{post.date}</span>
              <span>•</span>
              <span>{readingTime} min read</span>
            </div>
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

          {relatedPosts.length > 0 && (
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-2xl font-bold mb-6">
                Read more about {firstTag}
              </h3>
              <div className="space-y-4">
                {relatedPosts.map(relatedPost => (
                  <Link
                    key={relatedPost.slug}
                    href={`/posts/${relatedPost.slug}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-blue-600 hover:shadow-md transition-all group"
                  >
                    <h4 className="text-lg font-semibold mb-2 group-hover:text-blue-600">
                      {relatedPost.title}
                    </h4>
                    <p className="text-gray-600 text-sm mb-2">{relatedPost.excerpt}</p>
                    <span className="text-sm text-gray-500">{relatedPost.date}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </Layout>
    );
  } catch (error) {
    console.error('Error rendering post:', error);
    return notFound();
  }
} 
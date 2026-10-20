import { MetadataRoute } from 'next';
import { getAllPosts, getAllTags } from '@/lib/posts';
import { englishUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts({ includeFuture: false });
  const tags = await getAllTags();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: englishUrl('/'), lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: englishUrl('/posts'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: englishUrl('/tags'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: englishUrl('/about'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: englishUrl('/games'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: englishUrl('/play'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ];

  const postRoutes = posts.map((post) => ({
    url: englishUrl(`/posts/${post.slug}`),
    lastModified: new Date(`${post.date}T00:00:00Z`),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const tagRoutes = tags.map((tag) => ({
    url: englishUrl(`/tags/${tag.toLowerCase()}`),
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.4,
  }));

  return [...staticRoutes, ...postRoutes, ...tagRoutes];
}

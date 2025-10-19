import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/posts';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://saidyaka.com';
  // Only include published posts (not future-dated) in production sitemap
  const posts = await getAllPosts({ includeFuture: false });

  // Get unique tags
  const tagsSet = new Set<string>();
  posts.forEach(post => {
    post.tags.forEach(tag => {
      tagsSet.add(tag.toLowerCase());
    });
  });

  // Homepage
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/posts`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tags`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ];

  // Add all posts
  posts.forEach(post => {
    routes.push({
      url: `${baseUrl}/posts/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  });

  // Add all tag pages
  Array.from(tagsSet).forEach(tag => {
    routes.push({
      url: `${baseUrl}/tags/${encodeURIComponent(tag)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    });
  });

  return routes;
}

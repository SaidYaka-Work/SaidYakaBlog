import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/posts';
import { locales } from '@/lib/i18n/config';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://saidyaka.com';
  const routes: MetadataRoute.Sitemap = [];

  // Add homepage and locale-specific homepages
  routes.push({
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1,
  });

  for (const locale of locales) {
    // Locale-specific homepage
    routes.push({
      url: `${baseUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    });

    // Locale-specific posts listing
    routes.push({
      url: `${baseUrl}/${locale}/posts`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    });

    // Locale-specific tags listing
    routes.push({
      url: `${baseUrl}/${locale}/tags`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    });

    // Locale-specific about page
    routes.push({
      url: `${baseUrl}/${locale}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    });

    // Get posts for this locale (only published posts)
    const posts = await getAllPosts({ includeFuture: false, locale });

    // Add all posts for this locale
    posts.forEach(post => {
      routes.push({
        url: `${baseUrl}/${locale}/posts/${post.slug}`,
        lastModified: new Date(post.date),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    });

    // Get unique tags for this locale
    const tagsSet = new Set<string>();
    posts.forEach(post => {
      post.tags.forEach(tag => {
        tagsSet.add(tag.toLowerCase());
      });
    });

    // Add all tag pages for this locale
    Array.from(tagsSet).forEach(tag => {
      routes.push({
        url: `${baseUrl}/${locale}/tags/${encodeURIComponent(tag)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    });
  }

  return routes;
}

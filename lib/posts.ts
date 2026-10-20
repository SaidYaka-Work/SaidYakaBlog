import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'content/posts');
const localizedFile = /\.(de|fr|ja|tr)\.mdx$/;

export type PostData = {
  slug: string;
  title: string;
  date: string;
  author: string;
  tags: string[];
  content: string;
  excerpt: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  keywords: string[];
};

function formatPostDate(date: unknown): string {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  return String(date ?? '');
}

function excerptFromContent(content: string): string {
  const cleanContent = content
    .trim()
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`]/g, '')
    .replace(/\n\n+/g, '\n')
    .trim();

  const firstParagraph = cleanContent.split('\n').find((line) => line.trim().length > 0) || '';
  return firstParagraph.slice(0, 200) + (firstParagraph.length > 200 ? '...' : '');
}

export async function getAllPosts(options?: { includeFuture?: boolean }): Promise<PostData[]> {
  const fileNames = await fs.readdir(postsDirectory);
  const allPostsData = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith('.mdx') && !localizedFile.test(fileName))
      .map(async (fileName) => {
        const fullPath = path.join(postsDirectory, fileName);
        const fileContents = await fs.readFile(fullPath, 'utf8');
        const { data, content } = matter(fileContents);
        const excerpt = excerptFromContent(content);
        const description =
          (typeof data.description === 'string' && data.description) || excerpt;

        return {
          slug: String(data.slug),
          title: String(data.title),
          date: formatPostDate(data.date),
          author: String(data.author ?? 'Said Yaka'),
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          content,
          excerpt,
          description,
          ogTitle: typeof data.og_title === 'string' ? data.og_title : undefined,
          ogDescription: typeof data.og_description === 'string' ? data.og_description : undefined,
          keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
        } satisfies PostData;
      })
  );

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const includeFuture = options?.includeFuture ?? process.env.NODE_ENV === 'development';
  const filteredPosts = includeFuture
    ? allPostsData
    : allPostsData.filter((post) => {
        const postDate = new Date(`${post.date}T00:00:00`);
        postDate.setHours(0, 0, 0, 0);
        return postDate <= now;
      });

  return filteredPosts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPostBySlug(
  slug: string,
  options?: { includeFuture?: boolean }
): Promise<PostData | null> {
  try {
    const posts = await getAllPosts(options);
    return posts.find((post) => post.slug === slug) || null;
  } catch (error) {
    console.error('Error getting post by slug:', error);
    return null;
  }
}

export async function getAllTags(): Promise<string[]> {
  const posts = await getAllPosts();
  const tagSet = new Set<string>();
  posts.forEach((post) => {
    post.tags.forEach((tag) => tagSet.add(tag));
  });
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}

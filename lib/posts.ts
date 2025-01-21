import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'content/posts');

export type PostData = {
  slug: string;
  title: string;
  date: string;
  author: string;
  tags: string[];
  content: string;
  excerpt?: string;
};

export async function getAllPosts(): Promise<PostData[]> {
  // Get file names under /content/posts
  const fileNames = await fs.readdir(postsDirectory);
  const allPostsData = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith('.mdx'))
      .map(async (fileName) => {
        // Read markdown file as string
        const fullPath = path.join(postsDirectory, fileName);
        const fileContents = await fs.readFile(fullPath, 'utf8');

        // Use gray-matter to parse the post metadata section
        const { data, content } = matter(fileContents);

        // Create excerpt from content
        const excerpt = content
          .trim()
          .split('\n')[0] // Get first paragraph
          .slice(0, 200) // Limit to 200 characters
          + (content.length > 200 ? '...' : '');

        // Combine the data with the slug
        return {
          slug: data.slug,
          title: data.title,
          date: data.date.toISOString().split('T')[0],
          author: data.author,
          tags: data.tags,
          content,
          excerpt,
        };
      })
  );

  // Sort posts by date
  return allPostsData.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPostBySlug(slug: string): Promise<PostData | null> {
  try {
    const posts = await getAllPosts();
    return posts.find((post) => post.slug === slug) || null;
  } catch (error) {
    console.error('Error getting post by slug:', error);
    return null;
  }
} 
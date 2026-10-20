import { getAllPosts } from '@/lib/posts';
import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export async function generateStaticParams() {
  const posts = await getAllPosts({ includeFuture: true });
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return localeRedirectMetadata(`/en/posts/${slug}/`);
}

export default async function PostAlias({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <LocaleRedirect to={`/en/posts/${slug}/`} />;
}

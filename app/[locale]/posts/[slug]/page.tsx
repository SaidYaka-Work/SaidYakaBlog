import { getAllPosts } from '@/lib/posts';
import { translationOnlySlugs } from '@/lib/retired-locales';
import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export async function generateStaticParams() {
  const posts = await getAllPosts({ includeFuture: true });
  const slugs = [...posts.map((post) => post.slug), ...translationOnlySlugs];
  return slugs.map((slug) => ({ slug }));
}

function targetForSlug(slug: string) {
  if ((translationOnlySlugs as readonly string[]).includes(slug)) {
    return '/en/posts/';
  }
  return `/en/posts/${slug}/`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return localeRedirectMetadata(targetForSlug(slug));
}

export default async function RetiredPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <LocaleRedirect to={targetForSlug(slug)} />;
}

import { getAllTags } from '@/lib/posts';
import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export async function generateStaticParams() {
  const tags = await getAllTags();
  return tags.map((tag) => ({ tag: tag.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  return localeRedirectMetadata(`/en/tags/${decodeURIComponent(tag)}/`);
}

export default async function RetiredTag({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  return <LocaleRedirect to={`/en/tags/${decodeURIComponent(tag)}/`} />;
}

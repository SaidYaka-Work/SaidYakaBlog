import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';
import { getPlayableGames } from '@/lib/games';
import { englishPath } from '@/lib/site';

export function generateStaticParams() {
  return getPlayableGames().map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return localeRedirectMetadata(englishPath(`/games/${slug}`));
}

export default async function RetiredGame({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LocaleRedirect to={englishPath(`/games/${slug}`)} />;
}

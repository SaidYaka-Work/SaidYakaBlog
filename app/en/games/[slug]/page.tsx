import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GamePlayer from '@/components/games/GamePlayer';
import { getGameBySlug, getPlayableGames } from '@/lib/games';
import { SOCIAL, defaultOgImage, englishUrl } from '@/lib/site';

export function generateStaticParams() {
  return getPlayableGames().map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game || !getPlayableGames().some((item) => item.slug === game.slug)) return {};

  const url = englishUrl(`/games/${game.slug}`);
  return {
    title: game.title,
    description: game.description,
    openGraph: {
      title: game.title,
      description: game.description,
      type: 'website',
      locale: 'en_US',
      url,
      images: [{ url: defaultOgImage, alt: game.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: game.title,
      description: game.description,
      creator: SOCIAL.twitterHandle,
    },
    alternates: {
      canonical: url,
      languages: {
        en: url,
        'x-default': url,
      },
    },
  };
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game || !getPlayableGames().some((item) => item.slug === game.slug)) notFound();
  return <GamePlayer slug={slug} />;
}

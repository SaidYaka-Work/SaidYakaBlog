import fs from 'fs';
import path from 'path';
import { type Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

type GameEntry = {
  slug: string;
  title: string;
  href: string;
  description: string;
};

function titleize(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStaticGames(): GameEntry[] {
  const games: GameEntry[] = [
    {
      slug: 'click-rush',
      title: 'Click Rush',
      href: '/play',
      description: 'A fast reflex game built into the site.',
    },
  ];

  const gamesDir = path.join(process.cwd(), 'public', 'games');

  try {
    const items = fs.readdirSync(gamesDir, { withFileTypes: true });
    for (const item of items) {
      if (!item.isDirectory()) continue;
      games.push({
        slug: item.name,
        title: titleize(item.name),
        href: `/games/${item.name}/index.html`,
        description: 'A standalone mini-game from the games collection.',
      });
    }
  } catch {
    // ignore missing directory
  }

  return games;
}

export default async function GamesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);
  const games = getStaticGames();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3">{t('nav.games')}</h1>
        <p className="text-gray-600 text-lg">A running shelf for experiments, arcade distractions, and odd little browser toys.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {games.map((game) => (
          <a
            key={game.slug}
            href={game.href.startsWith('/') && !game.href.startsWith('/games/') ? `/${locale}${game.href}` : game.href}
            className="block rounded-2xl border border-primary-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary-600">Game</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{game.title}</h2>
            <p className="text-gray-600 leading-relaxed">{game.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

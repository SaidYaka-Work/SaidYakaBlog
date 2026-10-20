import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { englishPath, englishUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Games',
  description: 'Small browser experiments and arcade distractions.',
  alternates: {
    canonical: englishUrl('/games'),
    languages: {
      en: englishUrl('/games'),
      'x-default': englishUrl('/games'),
    },
  },
};

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
      href: englishPath('/play'),
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

export default function GamesPage() {
  const games = getStaticGames();

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="hero-kicker text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Arcade</p>
      <h1 className="hero-title mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Play</h1>
      <p className="hero-copy mt-5 max-w-xl text-lg text-[var(--muted)]">
        A running shelf for experiments, arcade distractions, and odd little browser toys.
      </p>
      <ul className="mt-12 grid gap-4 md:grid-cols-2">
        {games.map((game, index) => {
          const isInternal = game.href.startsWith('/en/');
          const className =
            'lift-card block rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)] p-6';
          const body = (
            <>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Game</p>
              <h2 className="mt-3 font-serif text-3xl tracking-tight">{game.title}</h2>
              <p className="mt-3 leading-relaxed text-[var(--muted)]">{game.description}</p>
            </>
          );
          return (
            <li
              key={game.slug}
              data-reveal
              style={{ '--reveal-delay': index } as CSSProperties}
            >
              {isInternal ? (
                <Link href={game.href} className={className}>
                  {body}
                </Link>
              ) : (
                <a href={game.href} className={className}>
                  {body}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

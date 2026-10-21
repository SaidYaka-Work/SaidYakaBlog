import type { Metadata } from 'next';
import GameCard from '@/components/games/GameCard';
import { getListedGames } from '@/lib/games';
import { englishUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Games',
  description: 'A shelf of original browser games: skill, puzzle, timing, words, logic, and herding.',
  alternates: {
    canonical: englishUrl('/games'),
    languages: {
      en: englishUrl('/games'),
      'x-default': englishUrl('/games'),
    },
  },
};

export default function GamesPage() {
  const games = getListedGames();

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="hero-kicker text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Arcade</p>
      <h1 className="hero-title mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Play</h1>
      <p className="hero-copy mt-5 max-w-xl text-lg text-[var(--muted)]">
        A running shelf for experiments, arcade distractions, and odd little browser toys. A new
        one lands most days.
      </p>
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game, index) => (
          <GameCard key={game.slug} game={game} index={index} />
        ))}
      </ul>
    </div>
  );
}

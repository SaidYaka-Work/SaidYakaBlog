import type { Metadata } from 'next';
import GameCard from '@/components/games/GameCard';
import { getListedGames } from '@/lib/games';
import { englishUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Games',
  description: 'A shelf of original browser games: a daily chat puzzle, a FakeGPT party toy, plus skill, timing, words, logic, and herding.',
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
  const dailies = games.filter((game) => game.daily);
  const rest = games.filter((game) => !game.daily);

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="hero-kicker text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Arcade</p>
      <h1 className="hero-title mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Play</h1>
      <p className="hero-copy mt-5 max-w-xl text-lg text-[var(--muted)]">
        A running shelf for experiments, arcade distractions, and odd little browser toys — including
        FakeGPT, where you are the chatbot taking trivia from impatient users. A new set lands most days.
      </p>
      {dailies.length ? (
        <section className="mt-12">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Daily</p>
          <ul className="mt-4 grid gap-5">
            {dailies.map((game, index) => (
              <GameCard key={game.slug} game={game} index={index} featured />
            ))}
          </ul>
        </section>
      ) : null}
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((game, index) => (
          <GameCard key={game.slug} game={game} index={dailies.length + index} />
        ))}
      </ul>
    </div>
  );
}

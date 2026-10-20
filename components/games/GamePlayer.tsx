'use client';

import dynamic from 'next/dynamic';
import { reactGameLoaders } from './registry';

function GameLoading() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--line)]" />
      <div className="mt-6 h-12 w-64 animate-pulse rounded bg-[var(--line)]" />
      <div className="mt-8 h-[380px] animate-pulse rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]" />
    </section>
  );
}

const players = Object.fromEntries(
  Object.entries(reactGameLoaders).map(([slug, loader]) => [
    slug,
    dynamic(loader, { ssr: false, loading: GameLoading }),
  ]),
);

export default function GamePlayer({ slug }: { slug: string }) {
  const Game = players[slug];
  if (!Game) return null;
  return <Game />;
}

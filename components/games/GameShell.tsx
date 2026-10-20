'use client';

import Link from 'next/link';
import { englishPath } from '@/lib/site';

type GameShellProps = {
  title: string;
  howTo: string;
  score: number | string;
  best?: number | string;
  status: string;
  muted: boolean;
  onMute: () => void;
  onRestart: () => void;
  children: React.ReactNode;
};

export default function GameShell({
  title,
  howTo,
  score,
  best,
  status,
  muted,
  onMute,
  onRestart,
  children,
}: GameShellProps) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href={englishPath('/games')}
        className="link-underline text-sm text-[var(--muted)] hover:text-[var(--ink)]"
      >
        ← All games
      </Link>

      <header className="mt-6">
        <p className="hero-kicker text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Game</p>
        <h1 className="hero-title mt-2 font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
        <p className="hero-copy mt-4 max-w-xl text-[var(--muted)] leading-relaxed">{howTo}</p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Score" value={score} />
        <Stat label="Best" value={best ?? '—'} />
        <div className="col-span-2 rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3">
          <span className="block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Status</span>
          <strong className="mt-1 block font-normal text-[var(--ink)]">{status}</strong>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onRestart} className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]">
          Restart
        </button>
        <button
          type="button"
          onClick={onMute}
          className="pressable rounded-full border border-[var(--line)] px-5 py-2.5 text-sm text-[var(--ink)]"
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {children}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">{label}</span>
      <strong className="mt-1 block text-xl font-normal text-[var(--ink)]">{value}</strong>
    </div>
  );
}

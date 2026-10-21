'use client';

import Link from 'next/link';
import { englishPath } from '@/lib/site';

type GameShellProps = {
  title: string;
  howTo: string;
  score: number | string;
  best?: number | string;
  scoreLabel?: string;
  bestLabel?: string;
  status: string;
  muted: boolean;
  onMute: () => void;
  onRestart?: () => void;
  restartLabel?: string;
  extraActions?: React.ReactNode;
  tight?: boolean;
  hud?: 'cards' | 'line';
  children: React.ReactNode;
};

export default function GameShell({
  title,
  howTo,
  score,
  best,
  scoreLabel = 'Score',
  bestLabel = 'Best',
  status,
  muted,
  onMute,
  onRestart,
  restartLabel = 'Restart',
  extraActions,
  tight = false,
  hud = 'cards',
  children,
}: GameShellProps) {
  const actions = (
    <>
      {onRestart ? (
        <button type="button" onClick={onRestart} className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]">
          {restartLabel}
        </button>
      ) : null}
      {extraActions}
      <button
        type="button"
        onClick={onMute}
        className={`pressable rounded-full border border-[var(--line)] text-[var(--ink)] ${
          hud === 'line' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'
        }`}
      >
        {muted ? 'Sound off' : 'Sound on'}
      </button>
    </>
  );

  return (
    <section className={`mx-auto max-w-3xl px-5 ${tight ? 'py-6 sm:px-8 sm:py-8' : 'py-10 sm:px-8 sm:py-14'}`}>
      <Link
        href={englishPath('/games')}
        className="link-underline text-sm text-[var(--muted)] hover:text-[var(--ink)]"
      >
        ← All games
      </Link>

      <header className={tight ? 'mt-4' : 'mt-6'}>
        <p className="hero-kicker text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Game</p>
        <h1 className={`hero-title mt-2 font-serif tracking-tight ${tight ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'}`}>{title}</h1>
        {howTo ? <p className="hero-copy mt-3 max-w-xl text-[var(--muted)] leading-relaxed">{howTo}</p> : null}
      </header>

      {hud === 'line' ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-[var(--muted)]">
          <span className="tabular-nums">
            {scoreLabel} {score}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {bestLabel} {best ?? '—'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{status}</span>
          <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
        </div>
      ) : (
        <>
          <div className={`${tight ? 'mt-4' : 'mt-6'} grid grid-cols-2 gap-3 sm:grid-cols-4`}>
            <Stat label={scoreLabel} value={score} />
            <Stat label={bestLabel} value={best ?? '—'} />
            <div className="col-span-2 rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3">
              <span className="block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Status</span>
              <strong className="mt-1 block font-normal text-[var(--ink)]">{status}</strong>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">{actions}</div>
        </>
      )}

      {hud === 'line' ? <div className={tight ? 'mt-4' : 'mt-6'}>{children}</div> : (
        <div className={`${tight ? 'mt-4' : 'mt-6'} overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]`}>
          {children}
        </div>
      )}
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

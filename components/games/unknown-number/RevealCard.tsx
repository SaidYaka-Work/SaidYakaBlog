'use client';

import { useState } from 'react';
import { globalSummary, type GlobalStats } from './api';
import { initials } from './logic';
import type { Figure } from './types';

export default function RevealCard({ figure, globalStats }: { figure: Figure; globalStats: GlobalStats | null }) {
  const [failed, setFailed] = useState(false);
  const portrait = figure.portrait && !failed ? figure.portrait : null;
  const crowd = globalStats && globalStats.played > 0 ? globalSummary(globalStats) : null;

  return (
    <article className="un-reveal rounded-[1.3rem] border border-[var(--line)] bg-[var(--bg-elevated)] p-4 sm:p-5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">Meet</p>
      <h2 className="mt-1 font-serif text-3xl tracking-tight text-[var(--ink)]">{figure.name}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {figure.years} · {figure.field} · {figure.country}
      </p>

      <div className="mt-4 overflow-hidden rounded-[1.1rem] bg-[var(--un-in-bg)]">
        {portrait ? (
          // Portrait is mounted only after a win/loss so the file is never requested during play.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait.path}
            alt={`Portrait of ${figure.name}`}
            width={480}
            height={320}
            className="h-[min(320px,70vw)] w-full object-cover object-top"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="grid h-[200px] place-items-center" aria-hidden="true">
            <span className="font-serif text-6xl text-[var(--accent)]">{figure.contactEmoji || initials(figure.name)}</span>
          </div>
        )}
      </div>
      {portrait ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">
          Photo:{' '}
          <a href={portrait.commonsUrl} className="link-underline" target="_blank" rel="noreferrer">
            {portrait.author}
          </a>
          {` · ${portrait.license}`}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--faint)]">Illustrated placeholder — no freely licensed portrait on file.</p>
      )}

      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[var(--ink)]">
        {figure.story.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>

      <p className="mt-4 text-sm">
        <a href={figure.source} className="link-underline text-[var(--ink)]" target="_blank" rel="noreferrer">
          Learn more on Wikipedia
        </a>
        {figure.more ? (
          <>
            {' · '}
            <a href={figure.more} className="link-underline text-[var(--ink)]" target="_blank" rel="noreferrer">
              Another source
            </a>
          </>
        ) : null}
      </p>

      {crowd ? (
        <section className="mt-5 border-t border-[var(--line)] pt-4" aria-label="Today’s players">
          <p className="text-sm text-[var(--ink)]">
            Solved by {crowd.percent}% of players today
            {crowd.most ? `, most in ${crowd.most} text${crowd.most === 1 ? '' : 's'}` : ''}.
          </p>
          <Distribution stats={globalStats!} />
        </section>
      ) : null}
    </article>
  );
}

function Distribution({ stats }: { stats: GlobalStats }) {
  const keys = ['1', '2', '3', '4', '5', '6', 'X'] as const;
  const max = Math.max(1, ...keys.map((key) => stats.distribution[key] ?? 0));
  return (
    <ul className="mt-3 grid gap-1.5" aria-label="Guess distribution">
      {keys.map((key) => {
        const value = stats.distribution[key] ?? 0;
        const width = `${Math.max(8, Math.round((value / max) * 100))}%`;
        return (
          <li key={key} className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="w-4 tabular-nums">{key === 'X' ? 'X' : key}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
              <span
                className="block h-full rounded-full bg-[var(--accent)]"
                style={{ width }}
              />
            </span>
            <span className="w-6 text-right tabular-nums">{value}</span>
          </li>
        );
      })}
    </ul>
  );
}

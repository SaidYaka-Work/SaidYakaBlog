'use client';

import { useState } from 'react';
import { figureNames, initials, normalizeName } from './logic';
import type { Figure } from './types';

export default function SuspectGrid({
  pool,
  eliminated,
  query,
  disabled,
  onGuess,
}: {
  pool: Figure[];
  eliminated: readonly string[];
  query: string;
  disabled: boolean;
  onGuess: (figure: Figure) => void;
}) {
  const needle = normalizeName(query);
  const out = new Set(eliminated);

  return (
    <section className="un-suspects" aria-label="Today’s suspects">
      <div className="mb-2 flex items-end justify-between gap-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Suspects</h2>
        <p className="text-[11px] text-[var(--faint)]">{pool.length} in the book today</p>
      </div>
      <ul className="un-suspect-grid">
        {pool.map((figure) => {
          const isOut = out.has(figure.id);
          const match =
            needle.length > 0 &&
            figureNames(figure).some((name) => normalizeName(name).includes(needle));
          return (
            <li key={figure.id}>
              <SuspectCard
                figure={figure}
                out={isOut}
                match={match}
                disabled={disabled || isOut}
                onGuess={onGuess}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SuspectCard({
  figure,
  out,
  match,
  disabled,
  onGuess,
}: {
  figure: Figure;
  out: boolean;
  match: boolean;
  disabled: boolean;
  onGuess: (figure: Figure) => void;
}) {
  const [failed, setFailed] = useState(false);
  const portrait = figure.portrait && !failed ? figure.portrait : null;

  return (
    <button
      type="button"
      className={`un-suspect${out ? ' is-out' : ''}${match ? ' is-match' : ''}`}
      disabled={disabled}
      aria-pressed={out}
      aria-label={out ? `${figure.name}, out` : `Guess ${figure.name}`}
      onClick={() => onGuess(figure)}
    >
      <span className="un-suspect-face" aria-hidden="true">
        {portrait ? (
          // Pool portraits preload together so the answer is not leaked by a late request.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait.path} alt="" width={96} height={96} onError={() => setFailed(true)} />
        ) : (
          <span className="un-suspect-initials">{initials(figure.name)}</span>
        )}
      </span>
      <span className="un-suspect-name">{figure.name}</span>
      <span className="un-suspect-field">{figure.field}</span>
      {out ? <span className="un-suspect-stamp">OUT</span> : null}
    </button>
  );
}

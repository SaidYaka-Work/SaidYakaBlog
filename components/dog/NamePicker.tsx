'use client';

import { useEffect, useMemo, useState } from 'react';
import { DOG_NAMES, suggestNames } from '@/lib/dog';

export default function NamePicker({
  until,
  onPick,
  status,
  avoidIds = [],
}: {
  until: number | null;
  onPick: (nameId: string) => void;
  status?: string;
  avoidIds?: string[];
}) {
  const [query, setQuery] = useState('');
  const [suggestions] = useState(() => suggestNames(Math.random, 5, avoidIds));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const remaining = until ? Math.max(0, until - now) : 0;
  const seconds = Math.ceil(remaining / 1000);
  const blocked = useMemo(() => new Set(avoidIds), [avoidIds]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return suggestions.filter((name) => !blocked.has(name.id));
    return DOG_NAMES.filter(
      (name) => !blocked.has(name.id) && name.label.toLowerCase().includes(needle),
    ).slice(0, 24);
  }, [blocked, query, suggestions]);

  function surprise() {
    const pick = suggestNames(Math.random, 1, avoidIds)[0];
    if (pick) onPick(pick.id);
  }

  return (
    <div className="p-5">
      <p className="font-serif text-2xl">You caught him. What is his name?</p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Pick from the list. {seconds > 0 ? `${seconds}s left.` : 'Time is nearly up.'}
      </p>
      {status && <p className="mt-2 text-sm text-[var(--accent)]">{status}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search names"
          className="min-w-[12rem] flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm"
        />
        <button type="button" className="pressable rounded-full border border-[var(--line)] px-4 py-2 text-sm" onClick={surprise}>
          Surprise me
        </button>
      </div>
      {!query && <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">Suggestions</p>}
      <ul className="mt-3 flex flex-wrap gap-2">
        {matches.map((name) => (
          <li key={name.id}>
            <button
              type="button"
              className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
              onClick={() => onPick(name.id)}
            >
              {name.label}
            </button>
          </li>
        ))}
      </ul>
      {matches.length === 0 && (
        <p className="mt-3 text-sm text-[var(--muted)]">No names match that search. Try another word.</p>
      )}
    </div>
  );
}

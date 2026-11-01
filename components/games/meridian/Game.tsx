'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import MeridianMap from './Map';
import type { Attempt, City, Mode, Puzzle, Result } from './types';
import {
  CITIES,
  GREAT_CIRCLE_EXPLAINER,
  MAX_SCORE,
  MAX_STARS,
  MAX_TRIES,
  dailyPuzzle,
  filterCityChoices,
  formatBearing,
  formatCoords,
  formatKm,
  gradeEmoji,
  gradeLabel,
  makeAttempt,
  makeResult,
  practicePuzzle,
  puzzleNumberForDate,
  shareLines,
  starLabel,
  toneEmoji,
  utcDate,
} from './logic';

const meta = getGameBySlug('meridian')!;

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

export default function MeridianGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('meridian-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [shake, setShake] = useState(false);
  const [shareNote, setShareNote] = useState('');

  const remaining = MAX_TRIES - attempts.length;
  const done = phase === 'done';
  const latest = attempts[attempts.length - 1];

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setAttempts([]);
      setPhase('play');
      setResult(undefined);
      setShake(false);
      setShareNote('');
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzle(date) : puzzle);
    beep(420, 0.05);
  }, [beep, date, load, mode, puzzle]);

  const finish = useCallback(
    (nextAttempts: Attempt[], solved: boolean) => {
      const scored = makeResult(puzzle, nextAttempts, solved);
      setResult(scored);
      setPhase('done');
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(solved ? 880 : 180, solved ? 0.16 : 0.14);
    },
    [beep, commitBest, puzzle],
  );

  const guessCity = useCallback(
    (city: City) => {
      if (phase !== 'play') return;
      if (attempts.some((attempt) => attempt.city.id === city.id)) {
        setShake(true);
        window.setTimeout(() => setShake(false), 380);
        beep(200, 0.06);
        return;
      }

      const attempt = makeAttempt(city, puzzle.city);
      const nextAttempts = [...attempts, attempt];
      setAttempts(nextAttempts);

      if (attempt.tone === 'hit') {
        finish(nextAttempts, true);
        return;
      }
      if (nextAttempts.length >= MAX_TRIES) {
        finish(nextAttempts, false);
        return;
      }

      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      beep(attempt.tone === 'close' ? 520 : 240, 0.08);
    },
    [attempts, beep, finish, phase, puzzle.city],
  );

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/meridian');
    const text = `${shareLines(result, mode, date).join('\n')}\n${url}`;
    try {
      if (typeof navigator.share === 'function' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        await navigator.share({ text });
        setShareNote('Shared');
        return;
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNote('Copied');
    } catch {
      setShareNote('Could not copy');
    }
  }, [date, mode, result]);

  const status = done && result
    ? `${result.solved ? 'Found' : 'Not this time'} · ${starLabel(result.stars)}`
    : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${remaining} ${remaining === 1 ? 'try' : 'tries'}`;

  const mapCaption = done && result
    ? `Great-circle routes to ${result.puzzle.city.name}. Solid curves are shortest on the globe; dashed lines are straight on this flat map.`
    : latest
      ? `${latest.city.name} is ${formatKm(latest.km)} from the hidden city, first heading ${formatBearing(latest.bearing)} ${latest.point}. The curve is a great-circle start, not the whole route.`
      : 'A city is hidden. Guess another city to take a distance and an initial compass bearing.';

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={result?.points ?? 0}
      best={best ?? '—'}
      status={status}
      muted={muted}
      onMute={toggleMute}
      onRestart={restart}
      tight
      hud="line"
      extraActions={
        <>
          {mode === 'daily' ? (
            <button
              type="button"
              onClick={() => {
                load('practice');
                beep(480, 0.05);
              }}
              className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]"
            >
              Practice
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                load('daily');
                beep(480, 0.05);
              }}
              className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]"
            >
              Today’s city
            </button>
          )}
          {done ? (
            <button
              type="button"
              onClick={() => void share()}
              className="pressable rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs text-[var(--bg)]"
            >
              {shareNote || 'Share'}
            </button>
          ) : null}
        </>
      }
    >
      <div className="overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {done && result ? (
          <EndScreen result={result} mode={mode} date={date} onShare={() => void share()} shareNote={shareNote} />
        ) : (
          <div className="px-4 py-5 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Hidden city</p>
              {mode === 'daily' ? (
                <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                  Daily #{puzzleNumberForDate(date)}
                </span>
              ) : (
                <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Practice
                </span>
              )}
            </div>

            <ol className="mt-4 flex gap-1.5" aria-label={`Attempt ${attempts.length + 1} of ${MAX_TRIES}`}>
              {Array.from({ length: MAX_TRIES }, (_, index) => {
                const row = attempts[index];
                const current = index === attempts.length;
                return (
                  <li
                    key={index}
                    className={`h-1.5 flex-1 rounded-full ${
                      row
                        ? row.tone === 'hit'
                          ? 'bg-[var(--accent)]'
                          : row.tone === 'close'
                            ? 'bg-[var(--ink)]'
                            : 'bg-[var(--ink)]/45'
                        : current
                          ? 'bg-[var(--ink)]'
                          : 'bg-[var(--line)]'
                    }`}
                  />
                );
              })}
            </ol>

            <h2 className="mt-4 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
              Which city is it?
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Six guesses. Each one gives a great-circle distance and the first heading toward the target.
            </p>

            <div className={`mt-5 ${shake ? 'seq-shake' : ''}`}>
              <MeridianMap attempts={attempts} caption={mapCaption} />
            </div>

            {latest ? (
              <p className="mt-4 font-serif text-2xl tracking-tight text-[var(--ink)] sm:text-3xl">
                {formatKm(latest.km)}
                <span className="ml-2 text-lg text-[var(--muted)] sm:text-xl">
                  · {formatBearing(latest.bearing)} {latest.point}
                </span>
              </p>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">Type a city to take the first bearing.</p>
            )}

            {attempts.length ? (
              <ol className="mt-3 space-y-1.5" aria-label="Guesses">
                {attempts.map((attempt, index) => (
                  <li
                    key={`${attempt.city.id}-${index}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
                  >
                    <span className="text-[var(--ink)]">
                      <span aria-hidden="true">{toneEmoji(attempt.tone)} </span>
                      {attempt.city.name}
                      <span className="text-[var(--muted)]"> · {attempt.city.country}</span>
                    </span>
                    <span className="tabular-nums text-[var(--muted)]">
                      {formatKm(attempt.km)} · {formatBearing(attempt.bearing)} {attempt.point}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}

            <GuessBox
              disabled={phase !== 'play'}
              excluded={attempts.map((attempt) => attempt.city.id)}
              onGuess={guessCity}
            />
          </div>
        )}
      </div>
    </GameShell>
  );
}

function GuessBox({
  disabled,
  excluded,
  onGuess,
}: {
  disabled: boolean;
  excluded: readonly string[];
  onGuess: (city: City) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);

  const choices = useMemo(() => filterCityChoices(query, 8, CITIES, excluded), [excluded, query]);

  function submitCity(city: City) {
    onGuess(city);
    setQuery('');
    setOpen(false);
    setInvalid(false);
    inputRef.current?.focus();
  }

  function submitCurrent() {
    if (!choices.length) {
      setInvalid(true);
      return;
    }
    const exact = choices.find((city) => city.name.toLowerCase() === query.trim().toLowerCase());
    submitCity(exact ?? choices[Math.max(0, Math.min(active, choices.length - 1))]);
  }

  return (
    <div className="relative mt-5">
      <label htmlFor="meridian-guess" className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
        Your guess
      </label>
      <div className="mt-1.5 flex items-end gap-2">
        <input
          ref={inputRef}
          id="meridian-guess"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && choices[active] ? `${listId}-${choices[active].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          disabled={disabled}
          placeholder={disabled ? 'The chart is closed' : 'City name'}
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setInvalid(false);
            const nextChoices = filterCityChoices(next, 8, CITIES, excluded);
            setActive(0);
            setOpen(next.trim().length > 0 && nextChoices.length > 0 && !disabled);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(Math.max(choices.length - 1, 0), index + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              submitCurrent();
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="min-h-12 flex-1 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 font-serif text-xl tracking-tight text-[var(--ink)] outline-none placeholder:font-sans placeholder:text-sm placeholder:text-[var(--faint)] focus:border-[var(--accent)] disabled:opacity-60"
        />
        <button
          type="button"
          className="pressable min-h-12 shrink-0 rounded-full bg-[var(--ink)] px-5 text-sm text-[var(--bg)] disabled:opacity-40"
          disabled={disabled}
          onClick={submitCurrent}
        >
          Lock in
        </button>
      </div>
      <p className="mt-1.5 text-xs text-[var(--faint)]">
        {invalid ? 'Pick a city from the list.' : 'Type to search · arrows · Enter'}
      </p>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] py-1 shadow-lg"
        >
          {choices.map((city, index) => (
            <li key={city.id} role="presentation">
              <button
                id={`${listId}-${city.id}`}
                type="button"
                role="option"
                aria-selected={index === active}
                className={`block w-full px-4 py-2 text-left ${
                  index === active ? 'bg-[var(--accent-soft)] text-[var(--ink)]' : 'text-[var(--ink)]'
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => submitCity(city)}
              >
                <span className="block text-sm">{city.name}</span>
                <span className="block text-xs text-[var(--muted)]">{city.country}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EndScreen({
  result,
  mode,
  date,
  onShare,
  shareNote,
}: {
  result: Result;
  mode: Mode;
  date: string;
  onShare: () => void;
  shareNote: string;
}) {
  const { puzzle } = result;
  const city = puzzle.city;

  return (
    <div className="px-4 py-5 sm:px-7 sm:py-7">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
        {mode === 'daily' ? `Daily #${puzzleNumberForDate(date)}` : 'Practice round'}
      </p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight">
        {result.points}
        <span className="text-xl text-[var(--muted)]"> / {MAX_SCORE}</span>
      </h2>
      <p className="mt-2 text-sm text-[var(--ink)]">
        <span className="mr-1.5 text-lg" aria-hidden="true">
          {gradeEmoji(result.grade)}
        </span>
        <strong className="font-medium">{gradeLabel(result.grade)}</strong>
        <span className="text-[var(--muted)]">
          {' '}
          · {result.solved ? `in ${result.tries} ${result.tries === 1 ? 'try' : 'tries'}` : 'the city held'}
        </span>
      </p>
      <p className="mt-2 font-serif text-lg tracking-tight text-[var(--ink)]" aria-label={`${result.stars} of ${MAX_STARS} stars`}>
        {starLabel(result.stars)}
      </p>
      <p className="mt-2 font-mono text-sm tracking-[0.12em]" aria-label="Result grid">
        {shareLines(result, mode, date)[1]}
      </p>

      <div className="mt-5">
        <MeridianMap
          attempts={result.attempts}
          target={city}
          caption={`Great-circle routes to ${city.name}. Solid curves are shortest on the globe; dashed lines are straight on this flat map.`}
        />
      </div>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent)]">{city.country}</p>
        <p className="mt-2 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)]">{city.name}</p>
        <p className="mt-1 text-sm tabular-nums text-[var(--muted)]">{formatCoords(city)}</p>
        <p className="mt-3 leading-relaxed text-[var(--ink)]">{city.fact}</p>
        {result.attempts.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            You guessed {result.attempts.map((attempt) => attempt.city.name).join(', ')}.
          </p>
        ) : null}
      </section>

      <section className="mt-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Why the route curves</p>
        <p className="mt-1.5 leading-relaxed text-[var(--muted)]">{GREAT_CIRCLE_EXPLAINER}</p>
      </section>

      <button
        type="button"
        onClick={onShare}
        className="pressable mt-5 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
      >
        {shareNote || 'Copy summary'}
      </button>
    </div>
  );
}

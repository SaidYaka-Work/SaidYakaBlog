'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { useGameChrome } from '../useGameChrome';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import GuessInput from './GuessInput';
import RevealCard from './RevealCard';
import { fetchGlobalStats, resultKey, submitGlobalResult, type GlobalStats } from './api';
import {
  DAY_STORAGE_KEY,
  FIGURES,
  MAX_CLUES,
  STATS_STORAGE_KEY,
  createDayState,
  figureForDate,
  formatCountdown,
  formatTimestamp,
  getFigure,
  loadDayState,
  loadStats,
  nextNyMidnight,
  nyCalendarDate,
  recordFinish,
  shareLines,
  winPercent,
  writeJson,
} from './logic';
import type { DayState, Figure, GameStats, GuessRecord } from './types';

const meta = getGameBySlug('unknown-number')!;

function debugFigure(): Figure | null {
  if (typeof window === 'undefined') return null;
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return null;
  const id = new URLSearchParams(window.location.search).get('figure');
  return id ? getFigure(id) ?? null : null;
}

function TypingDots() {
  return (
    <div className="un-bubble flex max-w-[70%] items-center gap-1 rounded-2xl rounded-bl-md bg-[var(--accent-soft)] px-3 py-2.5" aria-label="Typing">
      <span className="un-dot h-1.5 w-1.5 rounded-full bg-[var(--muted)]" />
      <span className="un-dot h-1.5 w-1.5 rounded-full bg-[var(--muted)]" />
      <span className="un-dot h-1.5 w-1.5 rounded-full bg-[var(--muted)]" />
    </div>
  );
}

export default function UnknownNumberGame() {
  const { muted, beep, toggleMute } = useGameChrome('unknown-number-best');
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState<DayState | null>(null);
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  const [typing, setTyping] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [countdown, setCountdown] = useState('--:--:--');
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const figure = useMemo(() => (day ? getFigure(day.figureId) ?? figureForDate(day.date) : null), [day]);
  const finished = day?.status === 'won' || day?.status === 'lost';

  const persist = useCallback((next: DayState, nextStats?: GameStats) => {
    writeJson(DAY_STORAGE_KEY, next);
    if (nextStats) writeJson(STATS_STORAGE_KEY, nextStats);
  }, []);

  useEffect(() => {
    const today = nyCalendarDate();
    const override = debugFigure();
    const saved = override ? null : loadDayState(today);
    const initial = saved ?? { ...createDayState(today), revealed: 0 };
    if (override) {
      initial.figureId = override.id;
    }
    setDay(initial);
    setStats(loadStats());
    persist(initial);
    setReady(true);
    if (!saved) {
      setTyping(true);
      const wait = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700;
      window.setTimeout(() => {
        setTyping(false);
        setDay((current) => {
          if (!current) return current;
          const next = { ...current, revealed: Math.max(1, current.revealed) };
          persist(next);
          return next;
        });
      }, wait);
    }
  }, [persist]);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(nextNyMidnight().getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [day?.revealed, day?.guesses.length, typing, finished]);

  useEffect(() => {
    if (!statsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStatsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [statsOpen]);

  useEffect(() => {
    if (!finished || !day) return;
    let cancelled = false;
    const result = resultKey(day.status === 'won' ? 'won' : 'lost', day.guesses.length);
    void submitGlobalResult(day.puzzleNumber, result).then(() =>
      fetchGlobalStats(day.puzzleNumber).then((value) => {
        if (!cancelled) setGlobalStats(value);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [day, finished]);

  const revealNext = useCallback(
    (next: DayState) => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        setDay(next);
        persist(next);
        return;
      }
      setTyping(true);
      window.setTimeout(() => {
        setTyping(false);
        setDay(next);
        persist(next);
        beep(520, 0.07);
      }, 720);
    },
    [beep, persist],
  );

  const onGuess = useCallback(
    (choice: Figure) => {
      if (!day || !figure || day.status !== 'playing' || typing) return;
      const correct = choice.id === figure.id;
      const guesses: GuessRecord[] = [...day.guesses, { text: choice.name, correct }];
      if (correct) {
        const next: DayState = { ...day, guesses, status: 'won' };
        const nextStats = recordFinish(stats, day.date, 'won', guesses.length);
        setDay(next);
        setStats(nextStats);
        persist(next, nextStats);
        setStatsOpen(true);
        beep(740, 0.12);
        return;
      }
      const holding: DayState = { ...day, guesses };
      setDay(holding);
      persist(holding);
      if (guesses.length >= MAX_CLUES) {
        const next: DayState = { ...holding, status: 'lost' };
        const nextStats = recordFinish(stats, day.date, 'lost', guesses.length);
        setDay(next);
        setStats(nextStats);
        persist(next, nextStats);
        setStatsOpen(true);
        beep(180, 0.1);
        return;
      }
      beep(240, 0.05);
      revealNext({
        ...holding,
        revealed: Math.min(MAX_CLUES, day.revealed + 1),
        timestamps: [...day.timestamps, formatTimestamp(new Date())],
      });
    },
    [beep, day, figure, persist, revealNext, stats, typing],
  );

  const share = useCallback(async () => {
    if (!day) return;
    const url = englishUrl('/games/unknown-number');
    const text = `${shareLines(day.puzzleNumber, day.status, day.guesses.length).join('\n')}\n${url}`;
    try {
      if (typeof navigator.share === 'function' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        await navigator.share({ text });
        setShareNote('Shared');
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNote('Copied');
    } catch {
      setShareNote('Could not copy');
    }
  }, [day]);

  if (!ready || !day || !figure) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="h-[380px] animate-pulse rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]" />
      </section>
    );
  }

  const statusLabel =
    day.status === 'won'
      ? `Named them · next ${countdown}`
      : day.status === 'lost'
        ? `Line went quiet · next ${countdown}`
        : typing
          ? 'Incoming…'
          : 'Name the number';

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={`${day.guesses.length}/${MAX_CLUES}`}
      best={stats.currentStreak}
      scoreLabel="Guess"
      bestLabel="Streak"
      status={statusLabel}
      muted={muted}
      onMute={toggleMute}
      extraActions={
        <>
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="pressable rounded-full border border-[var(--line)] px-5 py-2.5 text-sm text-[var(--ink)]"
          >
            Stats
          </button>
          {finished ? (
            <button
              type="button"
              onClick={() => void share()}
              className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
            >
              {shareNote || 'Share'}
            </button>
          ) : null}
        </>
      }
    >
      <div className="flex min-h-[34rem] flex-col bg-[color-mix(in_srgb,var(--bg)_55%,var(--bg-elevated))]">
        <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)] text-lg" aria-hidden="true">
            {finished ? figure.contactEmoji : '❓'}
          </span>
          <div>
            <p className="text-sm text-[var(--ink)]">{finished ? figure.name : 'Unknown Number'}</p>
            <p className="text-xs text-[var(--faint)]">{finished ? `${figure.field}` : 'Today’s number · iMessage'}</p>
          </div>
        </header>

        <div ref={logRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
          {figure.clues.slice(0, day.revealed).map((clue, index) => (
            <div key={`clue-${index}`} className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] text-[var(--faint)]">{day.timestamps[Math.min(index, Math.max(0, day.timestamps.length - 1))]}</p>
                <p className="un-bubble max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[var(--accent-soft)] px-3 py-2 text-[15px] leading-relaxed text-[var(--ink)]">
                  {clue}
                </p>
              </div>
              {day.guesses[index] ? (
                <div className="flex justify-end">
                  <p className="un-bubble max-w-[80%] rounded-2xl rounded-br-md bg-[var(--ink)] px-3 py-2 text-sm text-[var(--bg)]">
                    {day.guesses[index].text}
                    {day.guesses[index].correct ? '' : '?'}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
          {typing ? <TypingDots /> : null}
          {finished ? <RevealCard figure={figure} globalStats={globalStats} /> : null}
        </div>

        <div className="border-t border-[var(--line)] px-3 py-3 sm:px-4">
          <GuessInput disabled={finished || typing} onGuess={onGuess} />
          <p className="mt-2 text-[11px] text-[var(--faint)]">
            #{day.puzzleNumber} · {FIGURES.length} figures in the book · Anonymous results only — no accounts, cookies, or identifiers.
          </p>
        </div>
      </div>

      {statsOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" role="presentation" onClick={() => setStatsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unknown-stats-title"
            className="w-full max-w-md rounded-[1.4rem] border border-[var(--line)] bg-[var(--bg-elevated)] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="unknown-stats-title" className="font-serif text-2xl">
              Your stats
            </h2>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
              <StatBox label="Played" value={stats.played} />
              <StatBox label="Win %" value={winPercent(stats)} />
              <StatBox label="Streak" value={stats.currentStreak} />
              <StatBox label="Max" value={stats.maxStreak} />
            </dl>
            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">Guess distribution</p>
            <ul className="mt-2 grid gap-1.5">
              {stats.distribution.map((value, index) => (
                <li key={index} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <span className="w-4">{index + 1}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                    <span
                      className="block h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.max(8, Math.round((value / Math.max(1, ...stats.distribution)) * 100))}%` }}
                    />
                  </span>
                  <span className="w-6 text-right tabular-nums">{value}</span>
                </li>
              ))}
            </ul>
            {finished ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Next puzzle in {countdown}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              {finished ? (
                <button type="button" className="pressable rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg)]" onClick={() => void share()}>
                  {shareNote || 'Share'}
                </button>
              ) : null}
              <button type="button" className="pressable rounded-full border border-[var(--line)] px-4 py-2 text-sm" onClick={() => setStatsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </GameShell>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] px-2 py-3">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{label}</dt>
      <dd className="mt-1 text-xl text-[var(--ink)]">{value}</dd>
    </div>
  );
}

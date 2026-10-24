'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Attempt, HistoricalEvent, Mode, Result } from './types';
import {
  MAX_SCORE,
  MAX_TRIES,
  ROUND_SIZE,
  allLocked,
  chronological,
  dailyEvents,
  dealOrder,
  eraLabel,
  formatYear,
  gradeEmoji,
  gradeLabel,
  lockMask,
  makeResult,
  moveAmongUnlocked,
  neighborUnlocked,
  practiceEvents,
  puzzleNumberForDate,
  shareLines,
  utcDate,
} from './logic';

const meta = getGameBySlug('chronology')!;

function startRound(mode: Mode, date: string): HistoricalEvent[] {
  return mode === 'daily' ? dailyEvents(date) : practiceEvents();
}

function dealSeed(date: string, mode: Mode, ids: string[]) {
  const basis = `${mode === 'daily' ? date : `practice-${date}`}:${ids.join('|')}`;
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i += 1) {
    hash = (hash * 33 + basis.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function ChronologyGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('chronology-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [round, setRound] = useState<HistoricalEvent[]>(() => dailyEvents(date));
  const [order, setOrder] = useState<HistoricalEvent[]>(() =>
    dealOrder(
      dailyEvents(date),
      dealSeed(
        date,
        'daily',
        dailyEvents(date).map((event) => event.id),
      ),
    ),
  );
  const [locked, setLocked] = useState<boolean[]>(() => Array(ROUND_SIZE).fill(false));
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [selected, setSelected] = useState(0);
  const [shake, setShake] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [drag, setDrag] = useState<{ id: string; from: number; over: number } | null>(null);

  const solution = useMemo(() => chronological(round), [round]);
  const remaining = MAX_TRIES - attempts.length;
  const lockedCount = locked.filter(Boolean).length;
  const done = phase === 'done';

  const load = useCallback(
    (nextMode: Mode, events?: HistoricalEvent[]) => {
      const next = events ?? startRound(nextMode, date);
      const dealt = dealOrder(
        next,
        dealSeed(
          date,
          nextMode,
          next.map((event) => event.id),
        ),
      );
      setMode(nextMode);
      setRound(next);
      setOrder(dealt);
      setLocked(Array(ROUND_SIZE).fill(false));
      setAttempts([]);
      setPhase('play');
      setResult(undefined);
      setSelected(0);
      setShake(false);
      setShareNote('');
      setDrag(null);
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyEvents(date) : round);
    beep(420, 0.05);
  }, [beep, date, load, mode, round]);

  const finish = useCallback(
    (nextAttempts: Attempt[], solved: boolean) => {
      const scored = makeResult(round, nextAttempts, solved);
      setResult(scored);
      setPhase('done');
      setLocked(Array(ROUND_SIZE).fill(true));
      setOrder(chronological(round));
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(solved ? 880 : 180, solved ? 0.16 : 0.14);
    },
    [beep, commitBest, round],
  );

  const moveSelected = useCallback(
    (direction: -1 | 1) => {
      if (phase !== 'play' || locked[selected]) return;
      const target = neighborUnlocked(locked, selected, direction);
      if (target === null) return;
      setOrder((current) => moveAmongUnlocked(current, locked, selected, target));
      setSelected(target);
      beep(direction < 0 ? 400 : 440, 0.02);
    },
    [beep, locked, phase, selected],
  );

  const submit = useCallback(() => {
    if (phase !== 'play') return;
    const placed = lockMask(order, solution);
    const nextLocked = placed.map((correct, index) => locked[index] || correct);
    const nextAttempts = [...attempts, { placed: nextLocked }];
    setAttempts(nextAttempts);
    setLocked(nextLocked);

    if (allLocked(nextLocked)) {
      finish(nextAttempts, true);
      return;
    }
    if (nextAttempts.length >= MAX_TRIES) {
      finish(nextAttempts, false);
      return;
    }

    setShake(true);
    window.setTimeout(() => setShake(false), 380);
    const nextSelected = nextLocked.findIndex((isLocked) => !isLocked);
    setSelected(nextSelected >= 0 ? nextSelected : 0);
    beep(200, 0.08);
  }, [attempts, finish, locked, order, phase, solution, beep]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/chronology');
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

  useEffect(() => {
    if (locked[selected]) {
      const next = locked.findIndex((isLocked) => !isLocked);
      if (next >= 0) setSelected(next);
    }
  }, [locked, selected]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.code === 'Enter') {
        if (target?.tagName === 'BUTTON') return;
        event.preventDefault();
        if (phase === 'play') submit();
        return;
      }
      if (phase !== 'play') return;

      if (event.code === 'ArrowUp') {
        event.preventDefault();
        if (event.shiftKey || event.altKey) {
          moveSelected(-1);
          return;
        }
        const targetIndex = neighborUnlocked(locked, selected, -1);
        if (targetIndex !== null) {
          setSelected(targetIndex);
          beep(360, 0.02);
        }
        return;
      }
      if (event.code === 'ArrowDown') {
        event.preventDefault();
        if (event.shiftKey || event.altKey) {
          moveSelected(1);
          return;
        }
        const targetIndex = neighborUnlocked(locked, selected, 1);
        if (targetIndex !== null) {
          setSelected(targetIndex);
          beep(360, 0.02);
        }
        return;
      }
      if (event.code === 'BracketLeft' || event.code === 'Comma') {
        event.preventDefault();
        moveSelected(-1);
        return;
      }
      if (event.code === 'BracketRight' || event.code === 'Period') {
        event.preventDefault();
        moveSelected(1);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beep, locked, moveSelected, phase, selected, submit]);

  const status = done && result
    ? `${result.solved ? 'In order' : 'Not this time'} · ${result.points}/${MAX_SCORE}`
    : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${remaining} ${remaining === 1 ? 'try' : 'tries'} · ${lockedCount} locked`;

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
              Today’s set
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
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Timeline</p>
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
                      row ? 'bg-[var(--accent)]' : current ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'
                    }`}
                  />
                );
              })}
            </ol>

            <h2 className="mt-4 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
              Oldest to newest
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Drag a card, or select it and use the arrows. Locked cards stay put.
            </p>

            <Timeline
              order={order}
              locked={locked}
              selected={selected}
              shake={shake}
              dragId={drag?.id ?? null}
              onSelect={setSelected}
              onMove={moveSelected}
              onReorder={(from, to) => {
                setOrder((current) => moveAmongUnlocked(current, locked, from, to));
                setSelected(to);
              }}
              onDragChange={setDrag}
              beep={beep}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
              <p aria-live="polite">
                {lockedCount} of {ROUND_SIZE} locked
                <span className="mx-2 text-[var(--line)]" aria-hidden="true">
                  ·
                </span>
                {remaining} {remaining === 1 ? 'try' : 'tries'} left
              </p>
              <p className="hidden sm:block text-[var(--faint)]">↑↓ select · [ ] move · Enter lock</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submit}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
              >
                Lock in
              </button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

function Timeline({
  order,
  locked,
  selected,
  shake,
  dragId,
  onSelect,
  onMove,
  onReorder,
  onDragChange,
  beep,
}: {
  order: HistoricalEvent[];
  locked: boolean[];
  selected: number;
  shake: boolean;
  dragId: string | null;
  onSelect: (index: number) => void;
  onMove: (direction: -1 | 1) => void;
  onReorder: (from: number, to: number) => void;
  onDragChange: (drag: { id: string; from: number; over: number } | null) => void;
  beep: (frequency?: number, duration?: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const dragRef = useRef<{ id: string; from: number; over: number } | null>(null);

  const indexFromClientY = useCallback(
    (clientY: number, from: number) => {
      const list = listRef.current;
      if (!list) return from;
      const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-chrono-card]'));
      let nearest = from;
      let best = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        if (locked[index]) return;
        const rect = card.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const distance = Math.abs(clientY - mid);
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      return nearest;
    },
    [locked],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      if (locked[index] || event.button !== 0) return;
      const id = order[index]?.id;
      if (!id) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const next = { id, from: index, over: index };
      dragRef.current = next;
      onDragChange(next);
      onSelect(index);
    },
    [locked, onDragChange, onSelect, order],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const current = dragRef.current;
      if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const over = indexFromClientY(event.clientY, current.over);
      if (over === current.over) return;
      onReorder(current.over, over);
      const next = { ...current, over };
      dragRef.current = next;
      onDragChange(next);
      beep(420, 0.015);
    },
    [beep, indexFromClientY, onDragChange, onReorder],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
      onDragChange(null);
    },
    [onDragChange],
  );

  return (
    <div className={`mt-5 ${shake ? 'chrono-shake' : ''}`}>
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
        <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
        Oldest
      </div>
      <ol ref={listRef} className="space-y-2" aria-label="Events to order">
        {order.map((event, index) => {
          const isLocked = locked[index];
          const isSelected = selected === index;
          const isDragging = dragId === event.id;
          const canUp = neighborUnlocked(locked, index, -1) !== null;
          const canDown = neighborUnlocked(locked, index, 1) !== null;
          return (
            <li key={event.id} data-chrono-card>
              <div
                className={`flex items-stretch gap-2 rounded-2xl border px-3 py-2.5 sm:px-4 ${
                  isLocked
                    ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)]'
                    : isSelected
                      ? 'border-[var(--ink)] bg-[var(--bg)]'
                      : 'border-[var(--line)] bg-[var(--bg)]'
                } ${isDragging ? 'opacity-70 shadow-sm' : ''}`}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-disabled={isLocked}
                  disabled={isLocked}
                  onPointerDown={(pointer) => onPointerDown(pointer, index)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onClick={() => {
                    if (!isLocked) onSelect(index);
                  }}
                  className={`min-h-12 min-w-0 flex-1 touch-none select-none text-left ${
                    isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <span className="block font-serif text-lg leading-snug tracking-tight text-[var(--ink)]">
                    {event.title}
                  </span>
                  {isLocked ? (
                    <span className="mt-1 block text-xs uppercase tracking-[0.12em] text-[var(--accent)]">
                      Locked · {formatYear(event.year)}
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
                      {isSelected ? 'Selected' : 'Drag or select'}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 flex-col justify-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${event.title} earlier`}
                    disabled={isLocked || !canUp}
                    onClick={() => {
                      onSelect(index);
                      onMove(-1);
                    }}
                    className="pressable grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] text-[var(--ink)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${event.title} later`}
                    disabled={isLocked || !canDown}
                    onClick={() => {
                      onSelect(index);
                      onMove(1);
                    }}
                    className="pressable grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] text-[var(--ink)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
        <span className="h-2 w-2 rounded-full border border-[var(--faint)]" />
        Newest
      </div>
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
  const grid = result.attempts.map((attempt) => attempt.placed.map((correct) => (correct ? '🟩' : '⬛')).join(''));

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
          · {result.solved ? `in ${result.tries} ${result.tries === 1 ? 'try' : 'tries'}` : 'the dates were hiding'}
        </span>
      </p>
      <p className="mt-3 space-y-0.5 font-mono text-sm tracking-[0.18em]" aria-label="Result grid">
        {grid.map((row) => (
          <span key={row} className="block">
            {row}
          </span>
        ))}
      </p>
      <ul className="mt-5 space-y-3">
        {result.events.map((event) => (
          <li key={event.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent)]">
              {formatYear(event.year)}
              <span className="text-[var(--faint)]"> · {eraLabel(event.era)}</span>
            </p>
            <p className="mt-1 font-serif text-lg tracking-tight text-[var(--ink)]">{event.title}</p>
            <p className="mt-2 leading-relaxed text-[var(--muted)]">{event.note}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Source · {event.source}</p>
          </li>
        ))}
      </ul>
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

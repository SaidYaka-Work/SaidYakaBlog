'use client';

import { useCallback, useEffect, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Held, Mode, Move, Puzzle, Result } from './types';
import {
  HOWTO_PUZZLE,
  MAX_SCORE,
  applyMove,
  blockedReason,
  dailyPuzzle,
  describeMove,
  emptyState,
  gradeEmoji,
  gradeLabel,
  isHeldJug,
  jugName,
  makeResult,
  meetsGoal,
  pourLabel,
  practicePuzzle,
  puzzleNumberForDate,
  shareLines,
  utcDate,
} from './logic';

const meta = getGameBySlug('decant')!;

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

export default function DecantGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('decant-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [state, setState] = useState<number[]>(() => emptyState(dailyPuzzle(date).capacities));
  const [history, setHistory] = useState<number[][]>([]);
  const [held, setHeld] = useState<Held>(null);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [pours, setPours] = useState(0);
  const [note, setNote] = useState('Tap a jug, then the well, the drain, or another jug.');
  const [shake, setShake] = useState(false);
  const [shareNote, setShareNote] = useState('');

  const done = phase === 'done';

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setState(emptyState(loaded.capacities));
      setHistory([]);
      setHeld(null);
      setPhase('play');
      setResult(undefined);
      setPours(0);
      setNote('Tap a jug, then the well, the drain, or another jug.');
      setShake(false);
      setShareNote('');
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzle(date) : puzzle);
    beep(420, 0.05);
  }, [beep, date, load, mode, puzzle]);

  const fail = useCallback(
    (message: string) => {
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      setNote(message);
      beep(180, 0.06);
    },
    [beep],
  );

  const play = useCallback(
    (move: Move) => {
      if (phase !== 'play') return;
      const next = applyMove(puzzle.capacities, state, move);
      if (!next) {
        fail(blockedReason(puzzle.capacities, state, move) ?? 'That pour does nothing.');
        return;
      }
      setHistory((current) => [...current.slice(-79), state]);
      setState(next);
      const nextPours = pours + 1;
      setPours(nextPours);
      setHeld(null);
      setNote(describeMove(puzzle.capacities, state, move));
      beep(move.kind === 'fill' ? 520 : move.kind === 'empty' ? 300 : 440, 0.05);
      if (meetsGoal(next, puzzle.goal)) {
        const scored = makeResult(puzzle, nextPours, next);
        setResult(scored);
        setPhase('done');
        commitBest(scored.points);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        beep(880, 0.16);
      }
    },
    [beep, commitBest, fail, phase, pours, puzzle, state],
  );

  const undo = useCallback(() => {
    if (phase !== 'play') return;
    setHistory((current) => {
      if (!current.length) return current;
      const previous = current[current.length - 1];
      setState(previous);
      setPours((value) => Math.max(0, value - 1));
      setHeld(null);
      setNote('Undid the last pour.');
      beep(300, 0.03);
      return current.slice(0, -1);
    });
  }, [beep, phase]);

  const interact = useCallback(
    (target: NonNullable<Held>) => {
      if (phase !== 'play') return;
      if (!held) {
        setHeld(target);
        beep(360, 0.02);
        if (target.kind === 'well') setNote('Well held. Tap a jug to fill it.');
        else if (target.kind === 'drain') setNote('Drain held. Tap a jug to empty it.');
        else setNote(`${jugName(puzzle.capacities[target.index])} held. Tap the well, drain, or another jug.`);
        return;
      }
      if (held.kind === 'well' && target.kind === 'jug') {
        play({ kind: 'fill', jug: target.index });
        return;
      }
      if (held.kind === 'drain' && target.kind === 'jug') {
        play({ kind: 'empty', jug: target.index });
        return;
      }
      if (held.kind === 'jug' && target.kind === 'well') {
        play({ kind: 'fill', jug: held.index });
        return;
      }
      if (held.kind === 'jug' && target.kind === 'drain') {
        play({ kind: 'empty', jug: held.index });
        return;
      }
      if (held.kind === 'jug' && target.kind === 'jug') {
        if (held.index === target.index) {
          setHeld(null);
          setNote('Tap a jug, then the well, the drain, or another jug.');
          return;
        }
        play({ kind: 'pour', from: held.index, to: target.index });
        return;
      }
      setHeld(target);
      beep(360, 0.02);
    },
    [beep, held, phase, play, puzzle.capacities],
  );

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/decant');
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
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (phase !== 'play') return;

      if ((event.code === 'KeyZ' && (event.metaKey || event.ctrlKey)) || event.code === 'KeyU') {
        event.preventDefault();
        undo();
        return;
      }
      if (event.code === 'Escape') {
        setHeld(null);
        setNote('Tap a jug, then the well, the drain, or another jug.');
        return;
      }
      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        const count = puzzle.capacities.length;
        const current = held?.kind === 'jug' ? held.index : event.code === 'ArrowLeft' ? 0 : -1;
        const delta = event.code === 'ArrowRight' ? 1 : -1;
        const next = (current + delta + count) % count;
        setHeld({ kind: 'jug', index: next });
        setNote(`${jugName(puzzle.capacities[next])} held. Tap the well, drain, or another jug.`);
        beep(360, 0.02);
        return;
      }
      if (event.code === 'KeyW' || event.code === 'KeyF') {
        event.preventDefault();
        if (held?.kind === 'jug') play({ kind: 'fill', jug: held.index });
        else interact({ kind: 'well' });
        return;
      }
      if (event.code === 'KeyE' || event.code === 'KeyD') {
        event.preventDefault();
        if (held?.kind === 'jug') play({ kind: 'empty', jug: held.index });
        else interact({ kind: 'drain' });
        return;
      }
      if (event.key >= '1' && event.key <= '9') {
        const index = Number(event.key) - 1;
        if (index >= puzzle.capacities.length) return;
        event.preventDefault();
        interact({ kind: 'jug', index });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beep, held, interact, phase, play, puzzle.capacities, undo]);

  const status = done && result
    ? `${result.grade === 'par' ? 'On par' : 'Measured'} · ${result.points}/${MAX_SCORE}`
    : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${pourLabel(pours)} · par ${puzzle.optimal}`;

  const heldJug = held?.kind === 'jug' ? held.index : null;

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
            <>
              <button
                type="button"
                onClick={() => {
                  load('daily');
                  beep(480, 0.05);
                }}
                className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]"
              >
                Today’s jugs
              </button>
              <button
                type="button"
                onClick={() => {
                  load('practice');
                  beep(480, 0.05);
                }}
                className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]"
              >
                New practice
              </button>
            </>
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
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Measure</p>
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

            <h2 className="mt-4 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
              {puzzle.prompt}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Fill from the well, empty to the drain, or pour from one jug into another. Par {puzzle.optimal}.
            </p>

            <div className={`mt-5 ${shake ? 'seq-shake' : ''}`}>
              <Bench
                puzzle={puzzle}
                state={state}
                held={held}
                disabled={done}
                onInteract={interact}
              />
            </div>

            <p className="mt-4 min-h-10 text-sm leading-relaxed text-[var(--ink)]" aria-live="polite">
              {note}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={heldJug === null}
                onClick={() => heldJug !== null && play({ kind: 'fill', jug: heldJug })}
                className="pressable rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--bg)] disabled:opacity-40"
              >
                Fill
              </button>
              <button
                type="button"
                disabled={heldJug === null}
                onClick={() => heldJug !== null && play({ kind: 'empty', jug: heldJug })}
                className="pressable rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink)] disabled:opacity-40"
              >
                Empty
              </button>
              <button
                type="button"
                disabled={history.length === 0}
                onClick={undo}
                className="pressable rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink)] disabled:opacity-40"
              >
                Undo
              </button>
            </div>

            <p className="mt-4 hidden text-xs text-[var(--faint)] sm:block">
              1–{puzzle.capacities.length} select · F fill · E empty · arrows · U undo
            </p>

            <HowTo />
          </div>
        )}
      </div>
    </GameShell>
  );
}

function Bench({
  puzzle,
  state,
  held,
  disabled,
  onInteract,
  compact = false,
}: {
  puzzle: Puzzle;
  state: readonly number[];
  held: Held;
  disabled?: boolean;
  onInteract?: (target: NonNullable<Held>) => void;
  compact?: boolean;
}) {
  const maxCap = Math.max(...puzzle.capacities);
  return (
    <div className={`flex flex-wrap items-end justify-center gap-3 sm:gap-5 ${compact ? '' : 'min-h-[16rem]'}`}>
      <Station
        label="Well"
        title="Well — fill a jug"
        active={held?.kind === 'well'}
        disabled={disabled}
        onClick={() => onInteract?.({ kind: 'well' })}
      >
        <span className="absolute inset-x-2 bottom-2 top-6 rounded-b-xl rounded-t-sm bg-[var(--accent)]/55" />
        <span className="absolute inset-x-3 top-4 h-2 rounded-full bg-[var(--accent)]" />
        <span className="absolute inset-x-4 top-2 h-1 rounded-full bg-[var(--ink)]/20" />
      </Station>

      <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
        {puzzle.capacities.map((cap, index) => (
          <Jug
            key={`${cap}-${index}`}
            cap={cap}
            amount={state[index] ?? 0}
            maxCap={maxCap}
            selected={isHeldJug(held, index)}
            disabled={disabled}
            compact={compact}
            index={index}
            onClick={() => onInteract?.({ kind: 'jug', index })}
          />
        ))}
      </div>

      <Station
        label="Drain"
        title="Drain — empty a jug"
        active={held?.kind === 'drain'}
        disabled={disabled}
        onClick={() => onInteract?.({ kind: 'drain' })}
      >
        <span className="absolute inset-x-3 top-3 h-3 rounded-t-md border-2 border-[var(--ink)]/30" />
        <span className="absolute left-1/2 top-5 h-0 w-0 -translate-x-1/2 border-x-[11px] border-t-[16px] border-x-transparent border-t-[var(--ink)]/35" />
        <span className="absolute bottom-3 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--accent)]/70" />
      </Station>
    </div>
  );
}

function Station({
  label,
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title: string;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-16 shrink-0 flex-col items-center gap-2 sm:w-[4.5rem] ${disabled ? 'cursor-default' : ''}`}
    >
      <span
        className={`relative h-16 w-16 overflow-hidden rounded-2xl border-2 bg-[var(--bg)] sm:h-[4.5rem] sm:w-[4.5rem] ${
          active
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40'
            : 'border-[var(--ink)]/25'
        }`}
      >
        {children}
      </span>
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{label}</span>
    </button>
  );
}

function Jug({
  cap,
  amount,
  maxCap,
  selected,
  disabled,
  compact,
  index,
  onClick,
}: {
  cap: number;
  amount: number;
  maxCap: number;
  selected: boolean;
  disabled?: boolean;
  compact?: boolean;
  index: number;
  onClick?: () => void;
}) {
  const fill = cap === 0 ? 0 : (amount / cap) * 100;
  const height = compact ? 5 + (cap / maxCap) * 4.2 : 5.6 + (cap / maxCap) * 5.8;
  const step = cap <= 6 ? 1 : cap <= 12 ? 2 : 4;
  const ticks = Array.from({ length: Math.floor(cap / step) }, (_, index) => (index + 1) * step);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${jugName(cap)}, ${amount} of ${cap} liters${selected ? ', selected' : ''}`}
      aria-pressed={selected}
      className={`flex flex-col items-center ${disabled ? 'cursor-default' : ''}`}
    >
      <span
        className={`font-serif text-2xl tabular-nums tracking-tight sm:text-3xl ${
          selected ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
        }`}
      >
        {amount}
      </span>
      <span
        className={`relative mt-1 w-[4.15rem] overflow-hidden rounded-b-[1.7rem] rounded-t-md border-2 bg-[color-mix(in_srgb,var(--bg)_70%,#d9d1c3)] sm:w-[4.6rem] ${
          selected ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/35' : 'border-[var(--ink)]/35'
        }`}
        style={{ height: `${height}rem` }}
      >
        <span
          className="absolute inset-x-0 bottom-0 bg-[var(--accent)]/80 transition-[height] duration-300 ease-out"
          style={{ height: `${fill}%` }}
          aria-hidden="true"
        />
        {ticks.map((tick) => (
          <span
            key={tick}
            className="absolute left-0 h-px w-2.5 bg-[var(--ink)]/25"
            style={{ bottom: `${(tick / cap) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        <span className="absolute inset-x-1 top-0 h-1.5 rounded-b-sm bg-[var(--ink)]/15" aria-hidden="true" />
      </span>
      <span className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
        {index + 1} · {cap} L
      </span>
    </button>
  );
}

function HowTo() {
  return (
    <details className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
      <summary className="cursor-pointer text-sm text-[var(--ink)]">How to play</summary>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        The well is an endless source; the drain is a sink. A pour stops when the source is empty or the
        destination is full. You can measure a volume only when it is a multiple of the jugs’ greatest common
        divisor — Euclid’s remainder dance, in glass.
      </p>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">Solved example · 5 L and 3 L → 4 L</p>
      <div className="mt-2">
        <Bench
          puzzle={HOWTO_PUZZLE}
          state={HOWTO_PUZZLE.solution.reduce(
            (current, move) => applyMove(HOWTO_PUZZLE.capacities, current, move) ?? current,
            emptyState(HOWTO_PUZZLE.capacities),
          )}
          held={null}
          disabled
          compact
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{HOWTO_PUZZLE.blurb}</p>
    </details>
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
          · {pourLabel(result.pours)} against par {puzzle.optimal}
        </span>
      </p>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent)]">{puzzle.prompt}</p>
        <div className="mt-3">
          <Bench puzzle={puzzle} state={result.end} held={null} disabled compact />
        </div>
        <p className="mt-3 leading-relaxed text-[var(--muted)]">{puzzle.blurb}</p>
      </section>

      <div className="mt-5 space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">What you learned</p>
        <ol className="space-y-2">
          {puzzle.lesson.map((step, index) => (
            <li key={`${step.title}-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>

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

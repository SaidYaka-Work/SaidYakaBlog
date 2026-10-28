'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Attempt, Mode, Puzzle, Result, ShapeId, Side, Token } from './types';
import {
  MAX_HINTS,
  MAX_SCORE,
  MAX_TRIES,
  cap,
  dailyPuzzle,
  describeSide,
  gradeEmoji,
  gradeLabel,
  guessTone,
  makeResult,
  parseGuess,
  practicePuzzle,
  puzzleNumberForDate,
  shareGrid,
  shareLines,
  toneEmoji,
  unlockedHintCount,
  utcDate,
} from './logic';

const meta = getGameBySlug('counterweight')!;

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['back', '0', 'enter'],
] as const;

const SHAPE_CLASS: Record<ShapeId, string> = {
  circle: 'text-[var(--accent)]',
  triangle: 'text-[var(--ink)]',
  square: 'text-[#8a7048]',
  diamond: 'text-[#c26b3a]',
  hexagon: 'text-[#5d5648]',
};

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

export default function CounterweightGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('counterweight-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [draft, setDraft] = useState('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [shake, setShake] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_TRIES - attempts.length;
  const misses = attempts.filter((attempt) => attempt.tone !== 'hit').length;
  const hintCount = unlockedHintCount(misses);
  const done = phase === 'done';
  const parsed = parseGuess(draft);

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setDraft('');
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
      setDraft('');
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(solved ? 880 : 180, solved ? 0.16 : 0.14);
    },
    [beep, commitBest, puzzle],
  );

  const submit = useCallback(() => {
    if (phase !== 'play') return;
    const guess = parseGuess(draft);
    if (guess === null) {
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      beep(180, 0.06);
      return;
    }
    if (attempts.some((attempt) => attempt.guess === guess)) {
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      beep(200, 0.06);
      return;
    }

    const tone = guessTone(guess, puzzle.answer);
    const nextAttempts = [...attempts, { guess, tone }];
    setAttempts(nextAttempts);
    setDraft('');

    if (tone === 'hit') {
      finish(nextAttempts, true);
      return;
    }
    if (nextAttempts.length >= MAX_TRIES) {
      finish(nextAttempts, false);
      return;
    }

    setShake(true);
    window.setTimeout(() => setShake(false), 380);
    beep(200, 0.08);
  }, [attempts, beep, draft, finish, phase, puzzle.answer]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/counterweight');
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

  const typeDigit = useCallback(
    (digit: string) => {
      if (phase !== 'play') return;
      setDraft((current) => {
        if (current.length >= 2) return current;
        if (current === '0') return digit;
        return `${current}${digit}`;
      });
      beep(440, 0.02);
    },
    [beep, phase],
  );

  const backspace = useCallback(() => {
    if (phase !== 'play' || !draft) return;
    setDraft((current) => current.slice(0, -1));
    beep(320, 0.02);
  }, [beep, draft, phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (event.code === 'Enter') {
        if (target?.tagName === 'BUTTON') return;
        event.preventDefault();
        if (phase === 'play') submit();
        return;
      }
      if (phase !== 'play') return;
      if (event.code === 'Backspace' && !inField) {
        event.preventDefault();
        backspace();
        return;
      }
      if (inField) return;
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        typeDigit(event.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [backspace, phase, submit, typeDigit]);

  const status =
    done && result
      ? `${result.solved ? 'Balanced' : 'Not this time'} · ${result.points}/${MAX_SCORE}`
      : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${remaining} ${remaining === 1 ? 'try' : 'tries'}`;

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
                Today’s scale
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
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Mystery side</p>
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
                      row ? (row.tone === 'hit' ? 'bg-[var(--accent)]' : 'bg-[var(--ink)]') : current ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'
                    }`}
                  />
                );
              })}
            </ol>

            <h2 className="mt-4 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
              What balances this?
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Each shape is a different whole number. Numbered bars are known weights.
            </p>

            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Shapes in this puzzle">
              {puzzle.shapes.map((shape) => (
                <li
                  key={shape.id}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-xs text-[var(--ink)]"
                >
                  <ShapeIcon id={shape.id} size={16} />
                  <span>{cap(shape.name)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-3">
              {puzzle.scales.map((scale, index) => (
                <ScaleView
                  key={`${index}-${describeSide(scale.left)}`}
                  left={scale.left}
                  right={scale.right}
                  label={`Scale ${index + 1}`}
                />
              ))}
            </div>

            <div className={`mt-4 ${shake ? 'seq-shake' : ''}`}>
              <ScaleView
                left={puzzle.question}
                right={parsed === null ? undefined : parsed}
                label="Question"
                mystery
              />
            </div>

            {attempts.length ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Guesses">
                {attempts.map((attempt) => (
                  <li
                    key={`${attempt.guess}-${attempt.tone}`}
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-sm tabular-nums text-[var(--ink)]"
                  >
                    <span aria-hidden="true">{toneEmoji(attempt.tone)} </span>
                    {attempt.guess}
                  </li>
                ))}
              </ul>
            ) : null}

            <label className="mt-5 block">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Mystery weight</span>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="done"
                value={draft}
                placeholder="what balances it"
                onChange={(event) => setDraft(event.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 font-serif text-2xl tabular-nums tracking-tight text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
              <span className="mt-1.5 block text-xs text-[var(--faint)]">
                {parsed === null ? `${remaining} ${remaining === 1 ? 'try' : 'tries'} left` : `Submit ${parsed}`}
              </span>
            </label>

            <Keypad onDigit={typeDigit} onBackspace={backspace} onEnter={submit} disabled={phase !== 'play'} />

            {hintCount > 0 ? (
              <ol className="mt-5 space-y-2" aria-label="Unlocked hints">
                {puzzle.hints.slice(0, hintCount).map((hint, index) => (
                  <li key={hint} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                      Hint {index + 1} of {MAX_HINTS}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">{hint}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">
                Four tries. Each miss unlocks a stronger hint — a comparison, then a weight, then a step of the algebra.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={parsed === null}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)] disabled:opacity-40"
              >
                Lock in
              </button>
              <p className="hidden self-center text-xs text-[var(--faint)] sm:block">digits · Backspace · Enter</p>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

function ShapeIcon({ id, size = 22 }: { id: ShapeId; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className: `shrink-0 fill-current ${SHAPE_CLASS[id]}`,
    'aria-hidden': true as const,
  };
  if (id === 'circle') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }
  if (id === 'triangle') {
    return (
      <svg {...common}>
        <polygon points="12,3.5 21.5,20 2.5,20" />
      </svg>
    );
  }
  if (id === 'square') {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="14" height="14" rx="1.5" />
      </svg>
    );
  }
  if (id === 'diamond') {
    return (
      <svg {...common}>
        <polygon points="12,3 21,12 12,21 3,12" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <polygon points="12,3 20,8 20,16 12,21 4,16 4,8" />
    </svg>
  );
}

function TokenMark({ token }: { token: Token }) {
  if (token.kind === 'mass') {
    return (
      <span
        className="grid h-8 min-w-8 place-items-center rounded-md bg-[var(--ink)] px-1.5 font-serif text-sm tabular-nums text-[var(--bg)]"
        title={`${token.value}-weight`}
      >
        {token.value}
      </span>
    );
  }
  return (
    <span className="grid h-8 w-8 place-items-center" title={cap(token.shape)}>
      <ShapeIcon id={token.shape} />
    </span>
  );
}

function Pan({
  side,
  emptyLabel,
}: {
  side: Side | number | undefined;
  emptyLabel?: string;
}) {
  if (typeof side === 'number') {
    return (
      <div className="flex min-h-[4.25rem] min-w-[5.2rem] flex-1 items-center justify-center rounded-xl border border-[var(--ink)] bg-[var(--bg-elevated)] px-2 py-2">
        <span className="grid h-8 min-w-8 place-items-center rounded-md bg-[var(--ink)] px-1.5 font-serif text-sm tabular-nums text-[var(--bg)]">
          {side}
        </span>
      </div>
    );
  }
  if (!side) {
    return (
      <div className="flex min-h-[4.25rem] min-w-[5.2rem] flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-elevated)] px-2 py-2">
        <span className="font-serif text-2xl text-[var(--faint)]">{emptyLabel ?? '?'}</span>
      </div>
    );
  }
  return (
    <div className="flex min-h-[4.25rem] min-w-[5.2rem] flex-1 flex-wrap items-center justify-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 py-2">
      {side.map((token, index) => (
        <TokenMark key={`${token.kind}-${index}`} token={token} />
      ))}
    </div>
  );
}

function ScaleView({
  left,
  right,
  label,
  mystery = false,
}: {
  left: Side;
  right?: Side | number;
  label: string;
  mystery?: boolean;
}) {
  const rightLabel =
    typeof right === 'number'
      ? String(right)
      : right
        ? describeSide(right)
        : 'unknown weight';
  return (
    <figure className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
      <figcaption className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{label}</figcaption>
      <div
        className="mt-2 flex items-center gap-2 sm:gap-3"
        role="img"
        aria-label={`${label}: ${describeSide(left)} balances ${rightLabel}`}
      >
        <Pan side={left} />
        <div className="flex w-6 shrink-0 flex-col items-center text-[var(--accent)] sm:w-8" aria-hidden="true">
          <span className="h-px w-full bg-[var(--accent)]/55" />
          <span className="text-[10px] leading-none">▲</span>
        </div>
        <Pan side={right} emptyLabel={mystery ? '?' : undefined} />
      </div>
    </figure>
  );
}

function Keypad({
  onDigit,
  onBackspace,
  onEnter,
  disabled,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Number pad">
      {KEYS.flat().map((key) => {
        if (key === 'back') {
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={onBackspace}
              className="pressable min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)] disabled:opacity-40"
            >
              ⌫
            </button>
          );
        }
        if (key === 'enter') {
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={onEnter}
              className="pressable min-h-12 rounded-2xl bg-[var(--ink)] text-sm text-[var(--bg)] disabled:opacity-40"
            >
              →
            </button>
          );
        }
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(key)}
            className="pressable min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--bg)] font-serif text-xl tabular-nums text-[var(--ink)] disabled:opacity-40"
          >
            {key}
          </button>
        );
      })}
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
  const weights = Object.fromEntries(puzzle.shapes.map((shape) => [shape.id, shape.weight])) as Record<
    ShapeId,
    number
  >;

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
          · {result.solved ? `in ${result.tries} ${result.tries === 1 ? 'try' : 'tries'}` : 'the beam held'}
        </span>
      </p>
      <p className="mt-3 font-mono text-sm tracking-[0.18em]" aria-label="Result grid">
        {shareGrid(result.attempts)}
      </p>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent)]">The weights</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {puzzle.shapes.map((shape) => (
            <li
              key={shape.id}
              className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--ink)]"
            >
              <ShapeIcon id={shape.id} size={18} />
              <span>{cap(shape.name)}</span>
              <span className="tabular-nums text-[var(--muted)]">{shape.weight}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <ScaleView left={puzzle.question} right={puzzle.answer} label="Question" />
        </div>
        <p className="mt-3 text-sm text-[var(--ink)]">
          Mystery side <span className="tabular-nums font-medium">{puzzle.answer}</span>
          {result.attempts.length ? (
            <span className="text-[var(--muted)]">
              {' '}
              · you guessed {result.attempts.map((attempt) => attempt.guess).join(', ')}
            </span>
          ) : null}
        </p>
      </section>

      <div className="mt-5 space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">How to see it</p>
        <ol className="space-y-2">
          {puzzle.steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Why the beam sits level</p>
        <p className="leading-relaxed text-[var(--muted)]">{puzzle.blurb}</p>
        <ul className="space-y-2">
          {puzzle.scales.map((scale, index) => (
            <li key={`reveal-${index}`} className="text-sm text-[var(--muted)]">
              <span className="text-[var(--faint)]">Scale {index + 1} · </span>
              {describeSide(scale.left)} = {describeSide(scale.right)}
              <span className="tabular-nums">
                {' '}
                ({sideWeightLabel(scale.left, weights)} = {sideWeightLabel(scale.right, weights)})
              </span>
            </li>
          ))}
        </ul>
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

function sideWeightLabel(side: Side, weights: Record<ShapeId, number>): number {
  return side.reduce((sum, token) => sum + (token.kind === 'mass' ? token.value : weights[token.shape]), 0);
}

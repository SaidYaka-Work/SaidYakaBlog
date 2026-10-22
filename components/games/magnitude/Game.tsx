'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Category, Mode, Question, Result } from './types';
import {
  MAX_SCORE,
  ROUND_SIZE,
  clamp,
  dailyQuestions,
  describeError,
  formatValue,
  gradeEmoji,
  gradeLabel,
  midpoint,
  parseGuess,
  practiceQuestions,
  puzzleNumberForDate,
  shareLines,
  stepValue,
  ticksFor,
  totalScore,
  utcDate,
  valueToT,
  tToValue,
  scoreGuess,
} from './logic';

const meta = getGameBySlug('magnitude')!;

const CATEGORY_LABEL: Record<Category, string> = {
  science: 'Science',
  geography: 'Geography',
  history: 'History',
  body: 'Human body',
  space: 'Space',
  everyday: 'Everyday',
};

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function startRound(mode: Mode, date: string): Question[] {
  return mode === 'daily' ? dailyQuestions(date) : practiceQuestions();
}

export default function MagnitudeGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('magnitude-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [round, setRound] = useState<Question[]>(() => dailyQuestions(date));
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [guess, setGuess] = useState(() => midpoint(dailyQuestions(date)[0]));
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'play' | 'reveal' | 'done'>('play');
  const [truthReady, setTruthReady] = useState(false);
  const [shareNote, setShareNote] = useState('');

  const question = round[index] ?? round[0];
  const result = phase === 'reveal' ? results[index] : undefined;
  const score = totalScore(results);
  const done = phase === 'done';

  const load = useCallback(
    (nextMode: Mode, questions?: Question[]) => {
      const next = questions ?? startRound(nextMode, date);
      setMode(nextMode);
      setRound(next);
      setIndex(0);
      setResults([]);
      setGuess(midpoint(next[0]));
      setDraft('');
      setPhase('play');
      setTruthReady(false);
      setShareNote('');
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyQuestions(date) : round);
    beep(420, 0.05);
  }, [beep, date, load, mode, round]);

  const applyGuess = useCallback(
    (value: number) => {
      if (!question) return;
      setGuess(clamp(value, question.min, question.max));
      setDraft('');
    },
    [question],
  );

  const lockIn = useCallback(() => {
    if (phase !== 'play' || !question) return;
    const typed = parseGuess(draft, question.scale);
    const nextGuess = typed === null ? guess : clamp(typed, question.min, question.max);
    const scored = scoreGuess(nextGuess, question);
    setGuess(scored.guess);
    setDraft('');
    setResults((current) => {
      const next = [...current];
      next[index] = scored;
      return next;
    });
    setPhase('reveal');
    setTruthReady(false);
    beep(scored.grade === 'spot' ? 880 : scored.grade === 'miss' ? 180 : 520 + scored.points, 0.1);
    window.requestAnimationFrame(() => {
      if (prefersReducedMotion()) {
        setTruthReady(true);
        return;
      }
      window.setTimeout(() => setTruthReady(true), 40);
    });
  }, [beep, draft, guess, index, phase, question]);

  const advance = useCallback(() => {
    if (phase !== 'reveal') return;
    const nextIndex = index + 1;
    if (nextIndex >= round.length) {
      const finalScore = totalScore(results);
      commitBest(finalScore);
      setPhase('done');
      beep(760, 0.16);
      return;
    }
    setIndex(nextIndex);
    setGuess(midpoint(round[nextIndex]));
    setDraft('');
    setPhase('play');
    setTruthReady(false);
    beep(360, 0.05);
  }, [beep, commitBest, index, phase, results, round]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (event.code === 'Enter') {
        if (inField && phase === 'play') {
          event.preventDefault();
          lockIn();
          return;
        }
        if (!inField) {
          event.preventDefault();
          if (phase === 'play') lockIn();
          else if (phase === 'reveal') advance();
        }
        return;
      }
      if (inField || phase !== 'play' || !question) return;
      const step = event.shiftKey ? 5 : event.code === 'PageUp' || event.code === 'PageDown' ? 10 : 1;
      if (event.code === 'ArrowLeft' || event.code === 'ArrowDown' || event.code === 'PageDown') {
        event.preventDefault();
        applyGuess(stepValue(guess, question, -step));
        beep(400, 0.02);
      }
      if (event.code === 'ArrowRight' || event.code === 'ArrowUp' || event.code === 'PageUp') {
        event.preventDefault();
        applyGuess(stepValue(guess, question, step));
        beep(440, 0.02);
      }
      if (event.code === 'Home') {
        event.preventDefault();
        applyGuess(question.min);
      }
      if (event.code === 'End') {
        event.preventDefault();
        applyGuess(question.max);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, applyGuess, beep, guess, lockIn, phase, question]);

  const share = useCallback(async () => {
    const url = englishUrl('/games/magnitude');
    const text = `${shareLines(results, mode, date).join('\n')}\n${url}`;
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
  }, [date, mode, results]);

  const status = done
    ? `Round complete · ${score}/${MAX_SCORE}`
    : phase === 'reveal' && result
      ? `${gradeLabel(result.grade)} · +${result.points}`
      : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${index + 1} of ${ROUND_SIZE}`;

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={score}
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
      {done ? (
        <EndScreen results={results} mode={mode} date={date} onShare={() => void share()} shareNote={shareNote} />
      ) : (
        <div className="px-4 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
              {CATEGORY_LABEL[question.category]}
            </p>
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

          <ol className="mt-4 flex gap-1.5" aria-label={`Question ${index + 1} of ${ROUND_SIZE}`}>
            {round.map((item, itemIndex) => {
              const row = results[itemIndex];
              const current = itemIndex === index;
              return (
                <li
                  key={item.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    row
                      ? 'bg-[var(--accent)]'
                      : current
                        ? 'bg-[var(--ink)]'
                        : 'bg-[var(--line)]'
                  }`}
                />
              );
            })}
          </ol>

          <h2 className="mt-4 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
            {question.prompt}
          </h2>

          <Scale
            question={question}
            guess={guess}
            result={result}
            truthReady={truthReady}
            disabled={phase !== 'play'}
            onChange={applyGuess}
          />

          <label className="mt-5 block">
            <span className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Or type a number</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              disabled={phase !== 'play'}
              value={draft}
              placeholder={formatValue(guess, question)}
              onChange={(event) => {
                setDraft(event.target.value);
                const parsed = parseGuess(event.target.value, question.scale);
                if (parsed !== null) setGuess(clamp(parsed, question.min, question.max));
              }}
              className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          {result ? (
            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
              <p className="text-sm text-[var(--ink)]">
                <span className="mr-1.5 text-lg" aria-hidden="true">
                  {gradeEmoji(result.grade)}
                </span>
                <strong className="font-medium">{gradeLabel(result.grade)}</strong>
                <span className="text-[var(--muted)]">
                  {' '}
                  · +{result.points} · {describeError(result)}
                </span>
              </p>
              <p className="mt-2 text-sm text-[var(--ink)]">
                True value <span className="tabular-nums">{formatValue(question.answer, question)}</span>
                <span className="text-[var(--muted)]">
                  {' '}
                  · you guessed {formatValue(result.guess, question)}
                </span>
              </p>
              <p className="mt-3 leading-relaxed text-[var(--muted)]">{question.explanation}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Source · {question.source}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {phase === 'play' ? (
              <button
                type="button"
                onClick={lockIn}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
              >
                Lock in
              </button>
            ) : (
              <button
                type="button"
                onClick={advance}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
              >
                {index + 1 >= round.length ? 'See results' : 'Next question'}
              </button>
            )}
          </div>
        </div>
      )}
      </div>
    </GameShell>
  );
}

function Scale({
  question,
  guess,
  result,
  truthReady,
  disabled,
  onChange,
}: {
  question: Question;
  guess: number;
  result?: Result;
  truthReady: boolean;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ticks = ticksFor(question);
  const guessT = clamp(valueToT(guess, question), 0, 1);
  const truthT = result ? clamp(valueToT(question.answer, question), 0, 1) : guessT;
  const shownTruth = result && truthReady;
  const markerT = shownTruth ? truthT : result ? guessT : guessT;
  const bandLeft = Math.min(guessT, shownTruth ? truthT : guessT);
  const bandWidth = Math.abs((shownTruth ? truthT : guessT) - guessT);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || disabled) return;
      const rect = track.getBoundingClientRect();
      const t = clamp((clientX - rect.left) / rect.width, 0, 1);
      onChange(tToValue(t, question));
    },
    [disabled, onChange, question],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setFromClientX(event.clientX);
    },
    [disabled, setFromClientX],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      setFromClientX(event.clientX);
    },
    [disabled, setFromClientX],
  );

  return (
    <div className="mt-6 px-2 pb-3">
      <div className="relative h-8">
        <div
          className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-xs tabular-nums text-[var(--bg)]"
          style={{ left: `${clamp(guessT, 0.08, 0.92) * 100}%` }}
        >
          {formatValue(guess, question)}
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Estimate"
        aria-valuemin={question.min}
        aria-valuemax={question.max}
        aria-valuenow={Number(guess.toPrecision(6))}
        aria-valuetext={formatValue(guess, question)}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        className={`relative h-16 touch-none select-none ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--line)]" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--accent)]/45 transition-all duration-700 ease-out"
          style={{ left: `${bandLeft * 100}%`, width: `${bandWidth * 100}%` }}
        />
        {ticks.map((tick) => (
          <div
            key={tick.value}
            className="absolute top-1/2 -translate-x-1/2"
            style={{ left: `${tick.t * 100}%` }}
          >
            <span className="block h-3 w-px bg-[var(--faint)]" />
            <span className="mt-1 block -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--faint)]">
              {tick.label}
            </span>
          </div>
        ))}
        <span
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bg-elevated)] bg-[var(--ink)] shadow-sm"
          style={{ left: `${guessT * 100}%` }}
        />
        {result ? (
          <>
            <span
              className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_28%,transparent)] transition-all duration-700 ease-out"
              style={{ left: `${markerT * 100}%` }}
            />
            {shownTruth ? (
              <span
                className="absolute top-[0.15rem] -translate-x-1/2 text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]"
                style={{ left: `${truthT * 100}%` }}
              >
                true
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function EndScreen({
  results,
  mode,
  date,
  onShare,
  shareNote,
}: {
  results: Result[];
  mode: Mode;
  date: string;
  onShare: () => void;
  shareNote: string;
}) {
  const score = totalScore(results);
  const emojis = results.map((row) => gradeEmoji(row.grade)).join(' ');

  return (
    <div className="px-4 py-5 sm:px-7 sm:py-7">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
        {mode === 'daily' ? `Daily #${puzzleNumberForDate(date)}` : 'Practice round'}
      </p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight">
        {score}
        <span className="text-xl text-[var(--muted)]"> / {MAX_SCORE}</span>
      </h2>
      <p className="mt-2 text-2xl tracking-[0.12em]" aria-label="Result summary">
        {emojis}
      </p>
      <ul className="mt-5 space-y-3">
        {results.map((row) => (
          <li key={row.question.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <p className="text-sm text-[var(--ink)]">
              <span className="mr-1.5" aria-hidden="true">
                {gradeEmoji(row.grade)}
              </span>
              {row.question.prompt}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              +{row.points} · {describeError(row)} · {formatValue(row.question.answer, row.question)}
            </p>
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

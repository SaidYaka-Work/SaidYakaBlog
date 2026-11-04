'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Card, Fill, Mode, Puzzle, Result, Shape } from './types';
import {
  COLOR_NAMES,
  COUNT_NAMES,
  FILL_NAMES,
  HOWTO_CARDS,
  MAX_HINTS,
  MAX_SCORE,
  SHAPE_NAMES,
  dailyPuzzle,
  describeCard,
  gradeLabel,
  hintCardId,
  hintWord,
  makeResult,
  missWord,
  practicePuzzle,
  puzzleNumberForDate,
  remainingTriads,
  selectionOutcome,
  shareLines,
  triadKey,
  triadWord,
  utcDate,
} from './logic';

const meta = getGameBySlug('triad')!;

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

export default function TriadGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('triad-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [selected, setSelected] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [foundTriads, setFoundTriads] = useState<number[][]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [flash, setFlash] = useState<'hit' | 'miss' | 'repeat' | null>(null);
  const [note, setNote] = useState('Select three cards that form a triad.');
  const [shareNote, setShareNote] = useState('');
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lockRef = useRef(false);

  const done = phase === 'done';
  const remaining = puzzle.triads.length - found.length;
  const hintsLeft = MAX_HINTS - hints;

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setSelected([]);
      setFound([]);
      setFoundTriads([]);
      setMistakes(0);
      setHints(0);
      setHinted(null);
      setCursor(0);
      setPhase('play');
      setResult(undefined);
      setFlash(null);
      setNote('Select three cards that form a triad.');
      setShareNote('');
      lockRef.current = false;
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzle(date) : puzzle);
    beep(420, 0.05);
  }, [beep, date, load, mode, puzzle]);

  const finish = useCallback(
    (nextFound: number[][], nextMistakes: number, nextHints: number) => {
      const scored = makeResult(
        puzzle,
        nextFound.map((ids) => [ids[0]!, ids[1]!, ids[2]!] as const),
        nextMistakes,
        nextHints,
      );
      setResult(scored);
      setPhase('done');
      setSelected([]);
      setHinted(null);
      setNote('Every triad on the board is found.');
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(880, 0.16);
    },
    [beep, commitBest, puzzle],
  );

  const resolveSelection = useCallback(
    (ids: number[]) => {
      if (phase !== 'play' || lockRef.current) return;
      const outcome = selectionOutcome(puzzle, ids, found);
      if (outcome === 'short') return;

      lockRef.current = true;
      if (outcome === 'valid') {
        const nextFound = [...found, triadKey(ids)];
        const nextTriads = [...foundTriads, [...ids].sort((a, b) => a - b)];
        setFound(nextFound);
        setFoundTriads(nextTriads);
        setFlash('hit');
        setHinted(null);
        const left = puzzle.triads.length - nextFound.length;
        setNote(left === 0 ? 'That was the last triad.' : `${left} ${triadWord(left)} left.`);
        beep(720, 0.1);
        window.setTimeout(() => {
          setSelected([]);
          setFlash(null);
          lockRef.current = false;
          if (left === 0) finish(nextTriads, mistakes, hints);
        }, 420);
        return;
      }

      if (outcome === 'repeat') {
        setFlash('repeat');
        setNote('Already found that triad.');
        beep(320, 0.05);
        window.setTimeout(() => {
          setSelected([]);
          setFlash(null);
          lockRef.current = false;
        }, 380);
        return;
      }

      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      setFlash('miss');
      setNote('Not a triad — every attribute must be all same or all different.');
      beep(180, 0.08);
      window.setTimeout(() => {
        setSelected([]);
        setFlash(null);
        lockRef.current = false;
      }, 520);
    },
    [beep, finish, found, foundTriads, hints, mistakes, phase, puzzle],
  );

  const toggleCard = useCallback(
    (id: number) => {
      if (phase !== 'play' || lockRef.current) return;
      setHinted((current) => (current === id ? null : current));
      setSelected((current) => {
        if (current.includes(id)) {
          beep(300, 0.02);
          return current.filter((item) => item !== id);
        }
        if (current.length >= 3) return current;
        const next = [...current, id];
        beep(440, 0.025);
        if (next.length === 3) {
          window.setTimeout(() => resolveSelection(next), 0);
        }
        return next;
      });
    },
    [beep, phase, resolveSelection],
  );

  const clearSelection = useCallback(() => {
    if (phase !== 'play' || lockRef.current) return;
    if (!selected.length) return;
    setSelected([]);
    setFlash(null);
    beep(260, 0.03);
  }, [beep, phase, selected.length]);

  const useHint = useCallback(() => {
    if (phase !== 'play' || lockRef.current) return;
    if (hintsLeft <= 0) {
      setNote('No hints left.');
      beep(180, 0.05);
      return;
    }
    const id = hintCardId(puzzle, found, selected);
    if (id === null) return;
    const nextHints = hints + 1;
    setHints(nextHints);
    setHinted(id);
    const index = puzzle.cards.findIndex((card) => card.id === id);
    if (index >= 0) {
      setCursor(index);
      cardRefs.current[index]?.focus();
    }
    setNote('One card from an unfound triad is marked.');
    beep(540, 0.07);
  }, [beep, found, hints, hintsLeft, phase, puzzle, selected]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/triad');
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

  const moveCursor = useCallback(
    (delta: number, columns: number) => {
      setCursor((current) => {
        const next = Math.max(0, Math.min(puzzle.cards.length - 1, current + delta));
        if (delta === -1 && current % columns === 0) return current;
        if (delta === 1 && current % columns === columns - 1) return current;
        cardRefs.current[next]?.focus();
        return next;
      });
    },
    [puzzle.cards.length],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (inField) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
        return;
      }
      if (phase !== 'play') return;

      const columns = window.matchMedia('(min-width: 640px)').matches ? 4 : 3;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveCursor(1, columns);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveCursor(-1, columns);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveCursor(columns, columns);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveCursor(-columns, columns);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (target?.tagName === 'BUTTON') return;
        event.preventDefault();
        const card = puzzle.cards[cursor];
        if (card) toggleCard(card.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection, cursor, moveCursor, phase, puzzle.cards, toggleCard]);

  const status =
    done && result
      ? `${result.solved ? 'Solved' : 'Board held'} · ${result.points}/${MAX_SCORE}`
      : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${remaining} ${triadWord(remaining)} left`;

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={result?.points ?? `${found.length}/${puzzle.triads.length}`}
      best={best ?? '—'}
      scoreLabel={done ? 'Score' : 'Found'}
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
                Today’s board
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
          {!done ? (
            <button
              type="button"
              onClick={useHint}
              disabled={hintsLeft <= 0}
              className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)] disabled:opacity-40"
            >
              Hint · {hintsLeft}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void share()}
              className="pressable rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs text-[var(--bg)]"
            >
              {shareNote || 'Share'}
            </button>
          )}
        </>
      }
    >
      <div className="overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {done && result ? (
          <EndScreen result={result} mode={mode} date={date} onShare={() => void share()} shareNote={shareNote} />
        ) : (
          <div className="px-4 py-5 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Daily board</p>
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
              Find every triad
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {puzzle.triads.length} {triadWord(puzzle.triads.length)} on this board. Tap three cards.
            </p>

            <div className={`mt-5 ${flash === 'miss' ? 'seq-shake' : ''}`}>
              <Board
                cards={puzzle.cards}
                selected={selected}
                hinted={hinted}
                cursor={cursor}
                flash={flash}
                disabled={done}
                cardRefs={cardRefs}
                onToggle={toggleCard}
                onCursor={setCursor}
              />
            </div>

            <p className="mt-4 min-h-6 text-sm leading-relaxed text-[var(--ink)]" aria-live="polite">
              {note}
            </p>
            <p className="mt-1 text-xs text-[var(--faint)]">
              {mistakes} {missWord(mistakes)} · {hints} {hintWord(hints)} used · Esc clears
            </p>

            {foundTriads.length ? (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Found</p>
                <ul className="mt-2 space-y-2" aria-label="Found triads">
                  {foundTriads.map((ids) => (
                    <li key={ids.join('-')}>
                      <MiniTriad cards={puzzle.cards.filter((card) => ids.includes(card.id))} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <HowTo />
          </div>
        )}
      </div>
    </GameShell>
  );
}

function Board({
  cards,
  selected,
  hinted,
  cursor,
  flash,
  disabled,
  cardRefs,
  onToggle,
  onCursor,
}: {
  cards: readonly Card[];
  selected: readonly number[];
  hinted: number | null;
  cursor: number;
  flash: 'hit' | 'miss' | 'repeat' | null;
  disabled?: boolean;
  cardRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  onToggle: (id: number) => void;
  onCursor: (index: number) => void;
}) {
  return (
    <ul
      data-triad-board
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3"
      aria-label="Twelve attribute cards"
    >
      {cards.map((card, index) => {
        const isSelected = selected.includes(card.id);
        const isHinted = hinted === card.id;
        const inFlash = isSelected && flash;
        return (
          <li key={card.id}>
            <button
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${describeCard(card)}${isSelected ? ', selected' : ''}${isHinted ? ', hint' : ''}`}
              onClick={() => onToggle(card.id)}
              onFocus={() => onCursor(index)}
              className={`pressable flex aspect-[3/4] w-full items-center justify-center rounded-2xl border-2 bg-[var(--bg)] px-1.5 py-2 sm:px-2 ${
                inFlash === 'hit'
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : inFlash === 'miss'
                    ? 'border-[var(--ink)]/55'
                    : isSelected
                      ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30'
                      : isHinted
                        ? 'border-dashed border-[var(--accent)]'
                        : cursor === index
                          ? 'border-[var(--ink)]/40'
                          : 'border-[var(--ink)]/12'
              }`}
            >
              <CardFace card={card} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function colorClass(color: Card['color']) {
  if (color === 0) return 'text-[var(--accent)]';
  if (color === 1) return 'text-[var(--ink)]';
  return 'text-[#3d6a56] dark:text-[#8fc4a8]';
}

function CardFace({ card, compact = false }: { card: Card; compact?: boolean }) {
  const uid = useId();
  const count = card.count + 1;
  const size = compact
    ? count === 1
      ? 'h-7 w-5'
      : 'h-5 w-3.5'
    : count === 1
      ? 'h-14 w-10 sm:h-16 sm:w-11'
      : count === 2
        ? 'h-10 w-7 sm:h-11 sm:w-8'
        : 'h-8 w-5 sm:h-9 sm:w-6';

  return (
    <span className={`flex flex-col items-center justify-center ${compact ? 'gap-0.5' : 'gap-1'} ${colorClass(card.color)}`}>
      {Array.from({ length: count }, (_, index) => (
        <Glyph key={index} shape={card.shape} fill={card.fill} uid={`${uid}-${index}`} className={size} />
      ))}
    </span>
  );
}

function Glyph({
  shape,
  fill,
  uid,
  className,
}: {
  shape: Shape;
  fill: Fill;
  uid: string;
  className: string;
}) {
  const patternId = `${uid}-stripe`;
  const paint = fill === 0 ? 'currentColor' : fill === 1 ? `url(#${patternId})` : 'none';

  return (
    <svg viewBox="0 0 36 48" className={className} aria-hidden="true">
      {fill === 1 ? (
        <defs>
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(68)">
            <rect width="6" height="6" fill="none" />
            <path d="M0 0 v6" stroke="currentColor" strokeWidth="2.1" />
          </pattern>
        </defs>
      ) : null}
      {shape === 0 ? (
        <polygon points="18,3.5 32.5,24 18,44.5 3.5,24" fill={paint} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      ) : null}
      {shape === 1 ? (
        <ellipse cx="18" cy="24" rx="11.5" ry="18" fill={paint} stroke="currentColor" strokeWidth="2.2" />
      ) : null}
      {shape === 2 ? (
        <path
          d="M7 9c7-5 11 2 20-1 5-2 8 3 5 7-5 7-10 1-18 6-4 3-3 8 2 9 8 2 13-5 21-1 4 2 4 7-1 8-8 3-13-4-21 0-5 2-7-3-4-7 5-7 11-1 18-6 4-3 3-8-2-9-8-2-12 5-20 1-4-2-4-6 0-7z"
          fill={paint}
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function MiniTriad({ cards }: { cards: readonly Card[] }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
      {cards.map((card) => (
        <span
          key={card.id}
          className="grid h-12 w-9 place-items-center rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]"
          title={describeCard(card)}
        >
          <CardFace card={card} compact />
        </span>
      ))}
    </div>
  );
}

function HowTo() {
  return (
    <details className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
      <summary className="cursor-pointer text-sm text-[var(--ink)]">How to play</summary>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        A triad is exactly three cards where <em>every</em> attribute is all the same or all different: shape
        ({SHAPE_NAMES.join(', ')}), color ({COLOR_NAMES.join(', ')}), count ({COUNT_NAMES.join(', ')}), and fill
        ({FILL_NAMES.join(', ')}). Two matching and one odd value on any attribute is not a triad.
      </p>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">Example · one rust, three fills, three shapes</p>
      <div className="mt-2">
        <MiniTriad cards={HOWTO_CARDS} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        All rust, all a count of one, three different shapes, three different fills. The third card is forced
        by the first two.
      </p>
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
  const leftover = useMemo(() => remainingTriads(result.puzzle, result.found.map((triad) => triadKey(triad))), [result]);

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
        <strong className="font-medium">{gradeLabel(result.grade)}</strong>
        <span className="text-[var(--muted)]">
          {' '}
          · {result.found.length}/{result.puzzle.triads.length} · {result.mistakes} {missWord(result.mistakes)} ·{' '}
          {result.hints} {hintWord(result.hints)}
        </span>
      </p>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent)]">Today’s lines</p>
        <div className="mt-3">
          <Board
            cards={result.puzzle.cards}
            selected={[]}
            hinted={null}
            cursor={-1}
            flash={null}
            disabled
            cardRefs={{ current: [] }}
            onToggle={() => undefined}
            onCursor={() => undefined}
          />
        </div>
        <ul className="mt-4 space-y-2">
          {result.puzzle.triads.map((triad) => (
            <li key={triadKey(triad)}>
              <MiniTriad cards={result.puzzle.cards.filter((card) => triad.includes(card.id))} />
            </li>
          ))}
        </ul>
        {leftover.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{leftover.length} stayed hidden.</p>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">You named every triad on the board.</p>
        )}
      </section>

      <div className="mt-5 space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">What you learned</p>
        <ol className="space-y-2">
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">1. All same or all different</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
              Four attributes, three values each. A triad passes only if each attribute is unanimous or a
              complete trio. Two-and-one on any axis is the whole miss.
            </p>
          </li>
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">2. The third card is forced</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
              Pick any two cards and there is exactly one third that completes the line. That is the same
              arithmetic as addition on three values: the missing coordinate is the one that makes the sum
              zero.
            </p>
          </li>
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">3. A shared daily board</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
              Twelve cards, {result.puzzle.triads.length} hidden lines, same deal for everyone on this UTC
              day. Cards stay put because a card can sit on more than one line.
            </p>
          </li>
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

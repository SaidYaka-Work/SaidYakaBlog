'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Mode, Puzzle, Result } from './types';
import {
  ENGLISH_ORDER,
  MAX_HINTS,
  MAX_SCORE,
  applyHint,
  conflictsOf,
  dailyPuzzle,
  fieldLabel,
  formatTime,
  frequencyList,
  gradeLabel,
  hintLabel,
  isSolved,
  makeResult,
  nextHint,
  practicePuzzle,
  puzzleNumberForDate,
  shareLines,
  uniqueLetters,
  utcDate,
  wordsFrom,
} from './logic';

const meta = getGameBySlug('plaintext')!;

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

export default function PlaintextGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('plaintext-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [hinted, setHinted] = useState<Set<string>>(() => new Set());
  const [hints, setHints] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [shareNote, setShareNote] = useState('');

  const letters = useMemo(() => uniqueLetters(puzzle.encoded), [puzzle.encoded]);
  const words = useMemo(() => wordsFrom(puzzle.encoded), [puzzle.encoded]);
  const freqs = useMemo(() => frequencyList(puzzle.encoded), [puzzle.encoded]);
  const conflicts = useMemo(() => conflictsOf(guesses), [guesses]);
  const filled = letters.filter((letter) => guesses[letter]).length;
  const done = phase === 'done';

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setGuesses({});
      setHinted(new Set());
      setHints(0);
      setSelected(uniqueLetters(loaded.encoded)[0] ?? null);
      setPhase('play');
      setResult(undefined);
      setSeconds(0);
      setRunning(false);
      setShareNote('');
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzle(date) : puzzle);
    beep(420, 0.05);
  }, [beep, date, load, mode, puzzle]);

  const finish = useCallback(
    (nextGuesses: Record<string, string>, nextHints: number, nextSeconds: number) => {
      if (!isSolved(puzzle, nextGuesses)) return;
      const scored = makeResult(puzzle.quote, nextSeconds, nextHints);
      setResult(scored);
      setPhase('done');
      setRunning(false);
      setSelected(null);
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(880, 0.16);
    },
    [beep, commitBest, puzzle],
  );

  const assign = useCallback(
    (cipher: string, plain: string) => {
      if (phase !== 'play' || hinted.has(cipher)) return;
      const letter = plain.toUpperCase();
      if (!/[A-Z]/.test(letter)) return;
      setRunning(true);
      const next = { ...guesses, [cipher]: letter };
      setGuesses(next);
      const clash = Object.entries(next).some(([other, value]) => other !== cipher && value === letter);
      beep(clash ? 220 : 460, clash ? 0.07 : 0.03);
      if (isSolved(puzzle, next)) finish(next, hints, seconds);
    },
    [beep, finish, guesses, hinted, hints, phase, puzzle, seconds],
  );

  const clearLetter = useCallback(
    (cipher: string) => {
      if (phase !== 'play' || hinted.has(cipher) || !guesses[cipher]) return;
      const next = { ...guesses };
      delete next[cipher];
      setGuesses(next);
      beep(300, 0.03);
    },
    [beep, guesses, hinted, phase],
  );

  const applyReveal = useCallback(() => {
    if (phase !== 'play' || hints >= MAX_HINTS) return;
    const cipher = nextHint(puzzle, guesses);
    if (!cipher) return;
    setRunning(true);
    const nextHints = hints + 1;
    const next = applyHint(puzzle, guesses, cipher);
    setGuesses(next);
    setHints(nextHints);
    setHinted((current) => new Set(current).add(cipher));
    setSelected(cipher);
    beep(620, 0.08);
    if (isSolved(puzzle, next)) finish(next, nextHints, seconds);
  }, [beep, finish, guesses, hints, phase, puzzle, seconds]);

  const cycleSelected = useCallback(
    (direction: -1 | 1) => {
      if (phase !== 'play' || letters.length === 0) return;
      const index = selected ? letters.indexOf(selected) : -1;
      const next = letters[(index + direction + letters.length) % letters.length];
      setSelected(next);
      beep(360, 0.02);
    },
    [beep, letters, phase, selected],
  );

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/plaintext');
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
    if (!running || phase !== 'play') return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (phase !== 'play') return;

      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        cycleSelected(-1);
        return;
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault();
        cycleSelected(1);
        return;
      }
      if (event.code === 'Backspace' || event.code === 'Delete') {
        event.preventDefault();
        if (selected) clearLetter(selected);
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        setSelected(null);
        return;
      }
      if (event.key === 'h' || event.key === 'H') {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        applyReveal();
        return;
      }
      const letter = event.key.toUpperCase();
      if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
        event.preventDefault();
        if (selected) {
          assign(selected, letter);
          return;
        }
        if (letters.includes(letter)) setSelected(letter);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyReveal, assign, clearLetter, cycleSelected, letters, phase, selected]);

  const status = done && result
    ? `Decoded · ${formatTime(result.seconds)} · ${result.points}/${MAX_SCORE}`
    : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${formatTime(seconds)} · ${hintLabel(hints)}`;

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
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{fieldLabel(puzzle.quote.field)}</p>
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

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <p aria-live="polite">
                {filled} of {letters.length} letters
                <span className="mx-2 text-[var(--line)]" aria-hidden="true">
                  ·
                </span>
                {MAX_HINTS - hints} {MAX_HINTS - hints === 1 ? 'reveal' : 'reveals'} left
              </p>
              <p className="hidden sm:block text-[var(--faint)]">tap a letter · type its match · H reveal</p>
            </div>

            <CipherBoard
              words={words}
              guesses={guesses}
              selected={selected}
              conflicts={conflicts}
              hinted={hinted}
              onSelect={(cipher) => setSelected((current) => (current === cipher ? null : cipher))}
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={applyReveal}
                disabled={hints >= MAX_HINTS}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)] disabled:opacity-40"
              >
                Reveal a letter
              </button>
              <button
                type="button"
                onClick={() => selected && clearLetter(selected)}
                disabled={!selected || !guesses[selected] || hinted.has(selected)}
                className="pressable rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink)] disabled:opacity-40"
              >
                Clear letter
              </button>
            </div>

            <FrequencyRow
              freqs={freqs}
              guesses={guesses}
              selected={selected}
              conflicts={conflicts}
              onSelect={setSelected}
            />

            <Keyboard
              guesses={guesses}
              selected={selected}
              conflicts={conflicts}
              disabled={phase !== 'play'}
              onPick={(plain) => {
                if (selected) assign(selected, plain);
              }}
            />

            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
              English order · {ENGLISH_ORDER.split('').join(' ')}
            </p>
          </div>
        )}
      </div>
    </GameShell>
  );
}

function CipherBoard({
  words,
  guesses,
  selected,
  conflicts,
  hinted,
  onSelect,
}: {
  words: ReturnType<typeof wordsFrom>;
  guesses: Record<string, string>;
  selected: string | null;
  conflicts: Set<string>;
  hinted: Set<string>;
  onSelect: (cipher: string) => void;
}) {
  return (
    <p className="mt-4 flex flex-wrap gap-x-2.5 gap-y-2.5" aria-label="Encrypted quotation">
      {words.map((word, wordIndex) => (
        <span key={`w-${wordIndex}`} className="inline-flex flex-wrap gap-x-[0.15rem]">
          {word.cells.map((cell, cellIndex) => {
            if (cell.kind === 'mark') {
              return (
                <span
                  key={`m-${wordIndex}-${cellIndex}`}
                  className="self-end pb-1 font-serif text-xl text-[var(--muted)]"
                >
                  {cell.value === ' ' ? '\u00a0' : cell.value}
                </span>
              );
            }
            const guess = guesses[cell.cipher];
            const isSelected = selected === cell.cipher;
            const clash = conflicts.has(cell.cipher);
            const locked = hinted.has(cell.cipher);
            return (
              <button
                key={`c-${wordIndex}-${cellIndex}`}
                type="button"
                aria-pressed={isSelected}
                aria-label={`Cipher ${cell.cipher}${guess ? `, now ${guess}` : ''}${clash ? ', used twice' : ''}`}
                onClick={() => onSelect(cell.cipher)}
                className="flex w-7 flex-col items-center sm:w-8"
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{cell.cipher}</span>
                <span
                  className={`mt-0.5 flex h-8 w-full items-end justify-center border-b font-serif text-xl leading-none ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                      : locked
                        ? 'border-[var(--accent)]/50 text-[var(--ink)]'
                        : 'border-[var(--line)] text-[var(--ink)]'
                  } ${clash ? 'text-[var(--accent)]' : ''}`}
                >
                  {guess || '\u00a0'}
                </span>
              </button>
            );
          })}
        </span>
      ))}
    </p>
  );
}

function FrequencyRow({
  freqs,
  guesses,
  selected,
  conflicts,
  onSelect,
}: {
  freqs: { letter: string; count: number }[];
  guesses: Record<string, string>;
  selected: string | null;
  conflicts: Set<string>;
  onSelect: (cipher: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Frequency</p>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Cipher letter frequencies">
        {freqs.map((row) => {
          const isSelected = selected === row.letter;
          const clash = conflicts.has(row.letter);
          return (
            <li key={row.letter}>
              <button
                type="button"
                onClick={() => onSelect(row.letter)}
                className={`pressable min-h-11 rounded-xl border px-2 py-1.5 text-left ${
                  isSelected
                    ? 'border-[var(--ink)] bg-[var(--bg)]'
                    : 'border-[var(--line)] bg-[var(--bg)]'
                }`}
              >
                <span className="block font-serif text-base leading-none text-[var(--ink)]">
                  {guesses[row.letter] || row.letter}
                </span>
                <span className={`mt-0.5 block text-[10px] uppercase tracking-[0.12em] ${clash ? 'text-[var(--accent)]' : 'text-[var(--faint)]'}`}>
                  {row.letter} · {row.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Keyboard({
  guesses,
  selected,
  conflicts,
  disabled,
  onPick,
}: {
  guesses: Record<string, string>;
  selected: string | null;
  conflicts: Set<string>;
  disabled: boolean;
  onPick: (plain: string) => void;
}) {
  const owners = new Map<string, string[]>();
  for (const [cipher, plain] of Object.entries(guesses)) {
    const list = owners.get(plain) ?? [];
    list.push(cipher);
    owners.set(plain, list);
  }

  return (
    <div className="mt-4" aria-label="Plaintext keyboard">
      {KEY_ROWS.map((row, rowIndex) => (
        <div
          key={row}
          className={`mt-1.5 flex justify-center gap-1 ${rowIndex === 1 ? 'px-3 sm:px-5' : ''} ${rowIndex === 2 ? 'px-8 sm:px-10' : ''}`}
        >
          {row.split('').map((letter) => {
            const held = owners.get(letter) ?? [];
            const clash = held.some((cipher) => conflicts.has(cipher));
            const active = selected !== null && guesses[selected] === letter;
            return (
              <button
                key={letter}
                type="button"
                disabled={disabled}
                aria-label={held.length ? `${letter}, assigned to ${held.join(', ')}` : letter}
                onClick={() => onPick(letter)}
                className={`pressable min-h-10 flex-1 rounded-lg border text-sm sm:min-h-11 sm:text-base ${
                  active
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]'
                    : clash
                      ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--ink)]'
                      : held.length
                        ? 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                        : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                }`}
              >
                <span className="block leading-none">{letter}</span>
                <span className={`block min-h-[0.7rem] text-[9px] uppercase tracking-[0.08em] ${active ? 'text-[var(--bg)]/60' : 'text-[var(--faint)]'}`}>
                  {held[0] ?? ''}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <p className="mt-2 text-center text-[11px] text-[var(--faint)]">
        {selected ? `Selected ${selected}${guesses[selected] ? ` → ${guesses[selected]}` : ''}` : 'Tap a cipher letter, then a key'}
      </p>
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
  const { quote } = result;

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
          · {formatTime(result.seconds)} · {hintLabel(result.hints)}
        </span>
      </p>

      <blockquote className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <p className="font-serif text-2xl leading-snug tracking-tight text-[var(--ink)]">“{quote.text}”</p>
        <footer className="mt-3 text-sm text-[var(--muted)]">
          <cite className="not-italic font-medium text-[var(--ink)]">{quote.author}</cite>
          <span className="text-[var(--faint)]">
            {' '}
            · {quote.years} · {quote.work}
          </span>
        </footer>
      </blockquote>

      <div className="mt-5 space-y-3">
        <section>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">The author</p>
          <p className="mt-1.5 leading-relaxed text-[var(--muted)]">{quote.bio}</p>
        </section>
        <section>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Why it matters</p>
          <p className="mt-1.5 leading-relaxed text-[var(--muted)]">{quote.why}</p>
        </section>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Source · {quote.source}</p>
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

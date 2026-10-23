'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Mode, PlayTile, Puzzle, Result } from './types';
import {
  MAX_HINTS,
  MAX_SCORE,
  MAX_TRIES,
  ROUND_SIZE,
  assembledWord,
  dailyPuzzles,
  dealTiles,
  familyLabel,
  gradeEmoji,
  gradeLabel,
  hintTile,
  isSolved,
  localDate,
  makeResult,
  practicePuzzles,
  puzzleNumberForDate,
  shareLines,
  totalScore,
} from './logic';

const meta = getGameBySlug('root-words')!;

function startRound(mode: Mode, date: string): Puzzle[] {
  return mode === 'daily' ? dailyPuzzles(date) : practicePuzzles();
}

function tileSeed(date: string, mode: Mode, puzzleId: string, index: number) {
  const basis = `${mode === 'daily' ? date : `practice-${date}`}:${puzzleId}:${index}`;
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i += 1) {
    hash = (hash * 33 + basis.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function RootWordsGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('root-words-best');
  const date = localDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [round, setRound] = useState<Puzzle[]>(() => dailyPuzzles(date));
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [picked, setPicked] = useState<PlayTile[]>([]);
  const [tries, setTries] = useState(0);
  const [hints, setHints] = useState(0);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [phase, setPhase] = useState<'play' | 'reveal' | 'done'>('play');
  const [shake, setShake] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [cursor, setCursor] = useState(0);
  const typeBuf = useRef('');
  const typeTimer = useRef<number>(0);

  const puzzle = round[index] ?? round[0];
  const tiles = useMemo(
    () => (puzzle ? dealTiles(puzzle, tileSeed(date, mode, puzzle.id, index)) : []),
    [date, index, mode, puzzle],
  );
  const pickedIds = useMemo(() => new Set(picked.map((tile) => tile.id)), [picked]);
  const tray = tiles.filter((tile) => !pickedIds.has(tile.id));
  const result = phase === 'reveal' ? results[index] : undefined;
  const score = totalScore(results);
  const done = phase === 'done';
  const remaining = MAX_TRIES - tries;
  const draft = assembledWord(picked);

  const load = useCallback(
    (nextMode: Mode, puzzles?: Puzzle[]) => {
      const next = puzzles ?? startRound(nextMode, date);
      setMode(nextMode);
      setRound(next);
      setIndex(0);
      setResults([]);
      setPicked([]);
      setTries(0);
      setHints(0);
      setRevealed(new Set());
      setPhase('play');
      setShake(false);
      setShareNote('');
      setCursor(0);
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzles(date) : round);
    beep(420, 0.05);
  }, [beep, date, load, mode, round]);

  const finishRound = useCallback(
    (solved: boolean, nextTries: number, nextHints: number) => {
      if (!puzzle) return;
      const scored = makeResult(puzzle, nextTries, nextHints, solved);
      setResults((current) => {
        const next = [...current];
        next[index] = scored;
        return next;
      });
      setPhase('reveal');
      beep(solved ? 880 : 180, solved ? 0.12 : 0.14);
    },
    [beep, index, puzzle],
  );

  const addTile = useCallback(
    (tile: PlayTile) => {
      if (phase !== 'play' || pickedIds.has(tile.id)) return;
      setPicked((current) => [...current, tile]);
      beep(440, 0.03);
    },
    [beep, phase, pickedIds],
  );

  const popTile = useCallback(() => {
    if (phase !== 'play' || picked.length === 0) return;
    setPicked((current) => current.slice(0, -1));
    beep(320, 0.03);
  }, [beep, phase, picked.length]);

  const clearTiles = useCallback(() => {
    if (phase !== 'play' || picked.length === 0) return;
    setPicked([]);
    beep(280, 0.04);
  }, [beep, phase, picked.length]);

  const lockIn = useCallback(() => {
    if (phase !== 'play' || !puzzle || picked.length === 0) return;
    if (isSolved(picked, puzzle)) {
      finishRound(true, tries + 1, hints);
      return;
    }
    const nextTries = tries + 1;
    setTries(nextTries);
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
    if (nextTries >= MAX_TRIES) {
      finishRound(false, nextTries, hints);
      return;
    }
    beep(200, 0.08);
  }, [finishRound, hints, picked, phase, puzzle, tries, beep]);

  const applyHint = useCallback(() => {
    if (phase !== 'play' || hints >= MAX_HINTS) return;
    const next = hintTile(tiles, pickedIds);
    if (!next) return;
    setHints((value) => value + 1);
    setRevealed((current) => new Set(current).add(next.id));
    beep(620, 0.08);
  }, [beep, hints, phase, pickedIds, tiles]);

  const advance = useCallback(() => {
    if (phase !== 'reveal') return;
    const nextIndex = index + 1;
    if (nextIndex >= round.length) {
      commitBest(totalScore(results));
      setPhase('done');
      beep(760, 0.16);
      return;
    }
    setIndex(nextIndex);
    setPicked([]);
    setTries(0);
    setHints(0);
    setRevealed(new Set());
    setPhase('play');
    setShake(false);
    setCursor(0);
    beep(360, 0.05);
  }, [beep, commitBest, index, phase, results, round.length]);

  const share = useCallback(async () => {
    const url = englishUrl('/games/root-words');
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.code === 'Enter') {
        event.preventDefault();
        if (phase === 'play') lockIn();
        else if (phase === 'reveal') advance();
        return;
      }
      if (phase !== 'play') return;
      if (event.code === 'Backspace') {
        event.preventDefault();
        popTile();
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        clearTiles();
        return;
      }
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        applyHint();
        return;
      }
      if (event.code === 'ArrowRight' || event.code === 'ArrowDown') {
        event.preventDefault();
        setCursor((value) => (tray.length ? (value + 1) % tray.length : 0));
        return;
      }
      if (event.code === 'ArrowLeft' || event.code === 'ArrowUp') {
        event.preventDefault();
        setCursor((value) => (tray.length ? (value - 1 + tray.length) % tray.length : 0));
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        const tile = tray[cursor] ?? tray[0];
        if (tile) addTile(tile);
        return;
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= tray.length) {
        event.preventDefault();
        addTile(tray[digit - 1]);
        return;
      }
      const letter = event.key.toLowerCase();
      if (letter.length === 1 && letter >= 'a' && letter <= 'z') {
        event.preventDefault();
        window.clearTimeout(typeTimer.current);
        typeBuf.current += letter;
        typeTimer.current = window.setTimeout(() => {
          typeBuf.current = '';
        }, 800);
        const matches = tray.filter((tile) => tile.form.startsWith(typeBuf.current));
        if (matches.length === 1) {
          addTile(matches[0]);
          typeBuf.current = '';
        } else if (matches.length === 0) {
          typeBuf.current = letter;
          const retry = tray.filter((tile) => tile.form.startsWith(letter));
          if (retry.length === 1) {
            addTile(retry[0]);
            typeBuf.current = '';
          } else if (retry.length === 0) {
            typeBuf.current = '';
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(typeTimer.current);
    };
  }, [addTile, advance, clearTiles, cursor, lockIn, phase, popTile, tray, applyHint]);

  useEffect(() => {
    if (cursor >= tray.length) setCursor(0);
  }, [cursor, tray.length]);

  const status = done
    ? `Round complete · ${score}/${MAX_SCORE}`
    : phase === 'reveal' && result
      ? `${gradeLabel(result.grade)} · +${result.points}`
      : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${index + 1} of ${ROUND_SIZE} · ${remaining} ${remaining === 1 ? 'try' : 'tries'}`;

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
                {familyLabel(puzzle.family)}
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

            <ol className="mt-4 flex gap-1.5" aria-label={`Round ${index + 1} of ${ROUND_SIZE}`}>
              {round.map((item, itemIndex) => {
                const row = results[itemIndex];
                const current = itemIndex === index;
                return (
                  <li
                    key={item.id}
                    className={`h-1.5 flex-1 rounded-full ${
                      row ? 'bg-[var(--accent)]' : current ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'
                    }`}
                  />
                );
              })}
            </ol>

            <p className="mt-5 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">Literal sense</p>
            <h2 className="mt-1 font-serif text-3xl leading-snug tracking-tight text-[var(--ink)] sm:text-4xl">
              {puzzle.prompt}
            </h2>

            <Assembly
              puzzle={puzzle}
              picked={picked}
              draft={draft}
              shake={shake}
              phase={phase}
              revealed={revealed}
              onPop={popTile}
            />

            {phase === 'play' ? (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                  <p aria-live="polite">
                    {remaining} {remaining === 1 ? 'try' : 'tries'} left
                    <span className="mx-2 text-[var(--line)]" aria-hidden="true">
                      ·
                    </span>
                    {MAX_HINTS - hints} hint
                  </p>
                  <p className="hidden sm:block text-[var(--faint)]">1–{tray.length} pick · Backspace undo · Enter lock</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" role="list" aria-label="Root tiles">
                  {tray.map((tile, tileIndex) => {
                    const hinted = revealed.has(tile.id);
                    const focused = tileIndex === cursor;
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        role="listitem"
                        onClick={() => {
                          setCursor(tileIndex);
                          addTile(tile);
                        }}
                        className={`pressable min-h-12 min-w-[4.5rem] rounded-2xl border px-3 py-2 text-left sm:min-w-[5.2rem] ${
                          focused
                            ? 'border-[var(--ink)] bg-[var(--bg)]'
                            : 'border-[var(--line)] bg-[var(--bg)]'
                        } ${hinted ? 'ring-1 ring-[var(--accent)]' : ''}`}
                      >
                        <span className="block font-serif text-lg tracking-tight text-[var(--ink)]">{tile.form}</span>
                        <span className="mt-0.5 block min-h-[1rem] text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
                          {hinted && tile.gloss ? tile.gloss : tileIndex < 9 ? <span className="hidden sm:inline">{tileIndex + 1}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {result ? <RevealCard result={result} /> : null}

            <div className="mt-5 flex flex-wrap gap-3">
              {phase === 'play' ? (
                <>
                  <button
                    type="button"
                    onClick={lockIn}
                    disabled={picked.length === 0}
                    className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)] disabled:opacity-40"
                  >
                    Lock in
                  </button>
                  <button
                    type="button"
                    onClick={applyHint}
                    disabled={hints >= MAX_HINTS}
                    className="pressable rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink)] disabled:opacity-40"
                  >
                    Hint
                  </button>
                  <button
                    type="button"
                    onClick={clearTiles}
                    disabled={picked.length === 0}
                    className="pressable rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink)] disabled:opacity-40"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={advance}
                  className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
                >
                  {index + 1 >= round.length ? 'See results' : 'Next word'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

function Assembly({
  puzzle,
  picked,
  draft,
  shake,
  phase,
  revealed,
  onPop,
}: {
  puzzle: Puzzle;
  picked: PlayTile[];
  draft: string;
  shake: boolean;
  phase: 'play' | 'reveal' | 'done';
  revealed: Set<string>;
  onPop: () => void;
}) {
  const slots = Math.max(puzzle.roots.length, picked.length);
  return (
    <div className="mt-5">
      <div
        className={`flex flex-wrap items-center gap-2 ${shake ? 'rw-shake' : ''}`}
        aria-label={draft ? `Assembled ${draft}` : 'Empty assembly'}
      >
        {Array.from({ length: slots }, (_, slot) => {
          const tile = picked[slot];
          if (!tile) {
            return (
              <span
                key={`empty-${slot}`}
                className="min-h-12 min-w-[4.5rem] rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)] sm:min-w-[5.2rem]"
              />
            );
          }
          return (
            <button
              key={tile.id}
              type="button"
              onClick={phase === 'play' && slot === picked.length - 1 ? onPop : undefined}
              disabled={phase !== 'play' || slot !== picked.length - 1}
              className="pressable min-h-12 min-w-[4.5rem] rounded-2xl border border-[var(--ink)] bg-[var(--ink)] px-3 py-2 text-left text-[var(--bg)] disabled:opacity-100 sm:min-w-[5.2rem]"
            >
              <span className="block font-serif text-lg tracking-tight">{tile.form}</span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--bg)]/60">
                {phase !== 'play' || revealed.has(tile.id) ? tile.gloss ?? '·' : '·'}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 font-serif text-xl tracking-tight text-[var(--muted)]">
        {draft || <span className="text-[var(--faint)]">tap roots to build the word</span>}
      </p>
    </div>
  );
}

function RevealCard({ result }: { result: Result }) {
  const { puzzle } = result;
  return (
    <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
      <p className="text-sm text-[var(--ink)]">
        <span className="mr-1.5 text-lg" aria-hidden="true">
          {gradeEmoji(result.grade)}
        </span>
        <strong className="font-medium">{puzzle.word}</strong>
        <span className="text-[var(--muted)]">
          {' '}
          · {gradeLabel(result.grade)} · +{result.points}
        </span>
      </p>
      <p className="mt-2 font-serif text-lg tracking-tight text-[var(--ink)]">
        {puzzle.roots.map((root, index) => (
          <span key={`${root.form}-${index}`}>
            {index > 0 ? <span className="text-[var(--faint)]"> · </span> : null}
            {root.form}
            <span className="text-[var(--muted)]"> ({root.gloss})</span>
          </span>
        ))}
      </p>
      <p className="mt-3 leading-relaxed text-[var(--muted)]">{puzzle.note}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Source · {puzzle.source}</p>
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
          <li key={row.puzzle.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <p className="text-sm text-[var(--ink)]">
              <span className="mr-1.5" aria-hidden="true">
                {gradeEmoji(row.grade)}
              </span>
              <span className="font-medium">{row.puzzle.word}</span>
              <span className="text-[var(--muted)]"> · {row.puzzle.prompt}</span>
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              +{row.points} · {row.puzzle.roots.map((root) => root.form).join(' · ')}
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

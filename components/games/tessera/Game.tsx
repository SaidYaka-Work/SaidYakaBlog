'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Cell, CellPos, Grid, Mode, Puzzle, Result } from './types';
import {
  MAX_SCORE,
  cellKey,
  checkLabel,
  dailyPuzzle,
  emptyGrid,
  formatClue,
  formatTime,
  gradeLabel,
  isSolved,
  makeResult,
  maxClueCount,
  mistakeLabel,
  moveCell,
  paintLine,
  practicePuzzle,
  puzzleNumberForDate,
  setCell,
  shareLines,
  utcDate,
  wrongCells,
} from './logic';

const meta = getGameBySlug('tessera')!;

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

function paintValue(current: Cell, mode: 'fill' | 'mark', rightClick: boolean): Cell {
  if (rightClick) return current === 'mark' ? 'empty' : 'mark';
  if (mode === 'mark') return current === 'mark' ? 'empty' : 'mark';
  return current === 'fill' ? 'empty' : 'fill';
}

export default function TesseraGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('tessera-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [grid, setGrid] = useState<Grid>(() => emptyGrid(dailyPuzzle(date).size));
  const [history, setHistory] = useState<Grid[]>([]);
  const [cursor, setCursor] = useState<CellPos>({ row: 0, col: 0 });
  const [paintMode, setPaintMode] = useState<'fill' | 'mark'>('fill');
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [audit, setAudit] = useState('');
  const [shareNote, setShareNote] = useState('');
  const dragRef = useRef<{ value: Cell; origin: CellPos; axis: 'row' | 'col' | null; base: Grid } | null>(
    null,
  );

  const done = phase === 'done';

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setGrid(emptyGrid(loaded.size));
      setHistory([]);
      setCursor({ row: 0, col: 0 });
      setPaintMode('fill');
      setPhase('play');
      setResult(undefined);
      setSeconds(0);
      setRunning(false);
      setChecks(0);
      setMistakes(0);
      setFlagged(new Set());
      setAudit('');
      setShareNote('');
      dragRef.current = null;
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzle(date) : puzzle);
    beep(420, 0.05);
  }, [beep, date, load, mode, puzzle]);

  const finish = useCallback(
    (nextGrid: Grid, nextSeconds: number, nextChecks: number, nextMistakes: number) => {
      if (!isSolved(puzzle, nextGrid)) return;
      const scored = makeResult(puzzle, nextSeconds, nextChecks, nextMistakes);
      setResult(scored);
      setPhase('done');
      setRunning(false);
      setAudit('');
      setFlagged(new Set());
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(880, 0.16);
    },
    [beep, commitBest, puzzle],
  );

  const commitGrid = useCallback(
    (next: Grid, options?: { continueStroke?: boolean }) => {
      if (phase !== 'play') return;
      if (JSON.stringify(next) === JSON.stringify(grid)) return;
      if (!options?.continueStroke) {
        setHistory((current) => [...current.slice(-79), grid]);
      }
      setGrid(next);
      setRunning(true);
      setFlagged(new Set());
      setAudit('');
      if (isSolved(puzzle, next)) finish(next, seconds, checks, mistakes);
    },
    [checks, finish, grid, mistakes, phase, puzzle, seconds],
  );

  const applyCell = useCallback(
    (pos: CellPos, value: Cell) => {
      if (phase !== 'play') return;
      setCursor(pos);
      const next = setCell(grid, pos.row, pos.col, value);
      if (next === grid) return;
      beep(value === 'fill' ? 520 : value === 'mark' ? 280 : 340, 0.03);
      commitGrid(next);
    },
    [beep, commitGrid, grid, phase],
  );

  const undo = useCallback(() => {
    if (phase !== 'play' || history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((current) => current.slice(0, -1));
    setGrid(previous);
    setFlagged(new Set());
    setAudit('');
    beep(300, 0.03);
  }, [beep, history, phase]);

  const checkGrid = useCallback(() => {
    if (phase !== 'play') return;
    setRunning(true);
    const wrong = wrongCells(puzzle, grid);
    const nextChecks = checks + 1;
    const nextMistakes = mistakes + wrong.length;
    setChecks(nextChecks);
    setMistakes(nextMistakes);
    setFlagged(new Set(wrong.map(cellKey)));
    if (isSolved(puzzle, grid)) {
      finish(grid, seconds, nextChecks, nextMistakes);
      return;
    }
    if (wrong.length === 0) {
      setAudit('Nothing on the grid contradicts the picture. Keep going.');
      beep(480, 0.06);
      return;
    }
    setAudit(wrong.length === 1 ? 'One tile is wrong.' : `${wrong.length} tiles are wrong.`);
    beep(200, 0.08);
  }, [beep, checks, finish, grid, mistakes, phase, puzzle, seconds]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/tessera');
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

      if (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        const next = moveCell(
          cursor,
          event.code === 'ArrowDown' ? 1 : event.code === 'ArrowUp' ? -1 : 0,
          event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0,
          puzzle.size,
        );
        setCursor(next);
        beep(360, 0.02);
        return;
      }

      if (target?.tagName === 'BUTTON' && (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyX')) return;

      if (event.code === 'KeyM') {
        event.preventDefault();
        setPaintMode((current) => (current === 'fill' ? 'mark' : 'fill'));
        beep(400, 0.03);
        return;
      }
      if (event.code === 'KeyZ' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        undo();
        return;
      }
      if (event.code === 'KeyU') {
        event.preventDefault();
        undo();
        return;
      }
      if (event.code === 'Slash' || event.key === '?') {
        event.preventDefault();
        checkGrid();
        return;
      }
      if (event.code === 'KeyX' || event.key === '-') {
        event.preventDefault();
        applyCell(cursor, grid[cursor.row][cursor.col] === 'mark' ? 'empty' : 'mark');
        return;
      }
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        applyCell(cursor, grid[cursor.row][cursor.col] === 'fill' ? 'empty' : 'fill');
        return;
      }
      if (event.code === 'Backspace' || event.code === 'Delete' || event.code === 'Digit0') {
        event.preventDefault();
        applyCell(cursor, 'empty');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyCell, beep, checkGrid, cursor, grid, phase, puzzle.size, undo]);

  const status =
    done && result
      ? `Found · ${formatTime(result.seconds)} · ${result.points}/${MAX_SCORE}`
      : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${puzzle.size}×${puzzle.size} · ${formatTime(seconds)}`;

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
      wide={puzzle.size >= 12}
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
                Today’s picture
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
          <div className="px-3 py-5 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Picture logic</p>
              {mode === 'daily' ? (
                <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                  Daily #{puzzleNumberForDate(date)}
                </span>
              ) : (
                <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Practice
                </span>
              )}
              <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                {puzzle.size}×{puzzle.size}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Runs of filled tiles match the numbers. The same picture for everyone today.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={paintMode === 'fill'}
                onClick={() => {
                  setPaintMode('fill');
                  beep(440, 0.03);
                }}
                className={`pressable rounded-full px-4 py-2 text-sm ${
                  paintMode === 'fill'
                    ? 'bg-[var(--ink)] text-[var(--bg)]'
                    : 'border border-[var(--line)] text-[var(--ink)]'
                }`}
              >
                Fill
              </button>
              <button
                type="button"
                aria-pressed={paintMode === 'mark'}
                onClick={() => {
                  setPaintMode('mark');
                  beep(320, 0.03);
                }}
                className={`pressable rounded-full px-4 py-2 text-sm ${
                  paintMode === 'mark'
                    ? 'bg-[var(--ink)] text-[var(--bg)]'
                    : 'border border-[var(--line)] text-[var(--ink)]'
                }`}
              >
                Mark ×
              </button>
            </div>

            <Board
              puzzle={puzzle}
              grid={grid}
              cursor={cursor}
              flagged={flagged}
              paintMode={paintMode}
              dragRef={dragRef}
              onCursor={setCursor}
              onPaint={(next, value, continueStroke) => {
                beep(value === 'fill' ? 520 : value === 'mark' ? 280 : 340, 0.02);
                commitGrid(next, { continueStroke });
              }}
            />

            <p className="mt-3 hidden text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] sm:block">
              drag to paint · right-click marks · arrows move · Space fill · X mark · M mode · U undo · ? check
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] sm:hidden">
              tap or drag · switch Fill / Mark ×
            </p>

            <p className="mt-4 text-sm text-[var(--muted)]" aria-live="polite">
              {audit || `${checkLabel(checks)} · ${mistakeLabel(mistakes)} · a check costs score`}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={checkGrid}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
              >
                Check my grid
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0}
                className="pressable rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink)] disabled:opacity-40"
              >
                Undo
              </button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

function Board({
  puzzle,
  grid,
  cursor,
  flagged,
  paintMode,
  dragRef,
  onCursor,
  onPaint,
}: {
  puzzle: Puzzle;
  grid: Grid;
  cursor: CellPos;
  flagged: Set<string>;
  paintMode: 'fill' | 'mark';
  dragRef: MutableRefObject<{ value: Cell; origin: CellPos; axis: 'row' | 'col' | null; base: Grid } | null>;
  onCursor: (pos: CellPos) => void;
  onPaint: (grid: Grid, value: Cell, continueStroke?: boolean) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const rowSlots = maxClueCount(puzzle.rowClues);
  const cell =
    puzzle.size >= 15
      ? 'clamp(0.78rem, 4.15vw, 1.28rem)'
      : puzzle.size >= 12
        ? 'clamp(0.95rem, 5.1vw, 1.5rem)'
        : 'clamp(1.12rem, 6.3vw, 1.85rem)';

  const posFromPoint = (clientX: number, clientY: number): CellPos | null => {
    const root = boardRef.current;
    if (!root) return null;
    const el = document.elementFromPoint(clientX, clientY);
    const hit = el?.closest('[data-cell]') as HTMLElement | null;
    if (!hit || !root.contains(hit)) return null;
    return { row: Number(hit.dataset.row), col: Number(hit.dataset.col) };
  };

  const beginPaint = (pos: CellPos, rightClick: boolean) => {
    const value = paintValue(grid[pos.row][pos.col], paintMode, rightClick);
    dragRef.current = { value, origin: pos, axis: null, base: grid };
    onCursor(pos);
    onPaint(setCell(grid, pos.row, pos.col, value), value, false);
  };

  return (
    <div className="mt-5 overflow-x-auto">
      <div
        ref={boardRef}
        className="mx-auto w-max max-w-full select-none touch-none"
        style={
          {
            '--cell': cell,
            display: 'grid',
            gridTemplateColumns: `minmax(${1.1 + rowSlots * 0.72}rem, auto) repeat(${puzzle.size}, var(--cell))`,
            gridTemplateRows: `auto repeat(${puzzle.size}, var(--cell))`,
            gap: '0.12rem',
          } as CSSProperties
        }
        role="grid"
        aria-label={`${puzzle.size} by ${puzzle.size} picture grid`}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          const pos = posFromPoint(event.clientX, event.clientY);
          if (!pos) return;
          event.preventDefault();
          (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
          beginPaint(pos, event.button === 2);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const pos = posFromPoint(event.clientX, event.clientY);
          if (!pos) return;
          if (!drag.axis && (pos.row !== drag.origin.row || pos.col !== drag.origin.col)) {
            drag.axis = pos.row === drag.origin.row ? 'row' : pos.col === drag.origin.col ? 'col' : 'row';
          }
          const locked =
            drag.axis === 'col'
              ? { row: pos.row, col: drag.origin.col }
              : drag.axis === 'row'
                ? { row: drag.origin.row, col: pos.col }
                : pos;
          onCursor(locked);
          onPaint(paintLine(drag.base, drag.origin, locked, drag.value), drag.value, true);
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        <span />
        {puzzle.colClues.map((clues, col) => (
          <span
            key={`col-${col}`}
            className="flex flex-col items-center justify-end gap-0.5 px-0.5 pb-1 text-center font-mono text-[10px] leading-none text-[var(--muted)] sm:text-[11px]"
          >
            {(clues.length ? clues : [0]).map((n, index) => (
              <span key={`${col}-${index}-${n}`}>{n}</span>
            ))}
          </span>
        ))}
        {puzzle.rowClues.map((clues, row) => (
          <div key={`row-${row}`} className="contents">
            <span className="flex items-center justify-end gap-1 pr-1.5 text-right font-mono text-[10px] tabular-nums leading-none text-[var(--muted)] sm:text-[11px]">
              {(clues.length ? clues : [0]).map((n, index) => (
                <span key={`${row}-${index}-${n}`}>{n}</span>
              ))}
            </span>
            {grid[row].map((cell, col) => {
              const selected = cursor.row === row && cursor.col === col;
              const bad = flagged.has(cellKey({ row, col }));
              const fifth = (row + 1) % 5 === 0 || (col + 1) % 5 === 0;
              return (
                <div
                  key={`${row}-${col}`}
                  data-cell=""
                  data-row={row}
                  data-col={col}
                  role="gridcell"
                  aria-label={`Row ${row + 1} column ${col + 1}, ${cell === 'fill' ? 'filled' : cell === 'mark' ? 'marked' : 'empty'}. Clues ${formatClue(puzzle.rowClues[row])} by ${formatClue(puzzle.colClues[col])}`}
                  aria-current={selected ? 'true' : undefined}
                  className={`grid place-items-center rounded-[0.28rem] border text-[0.7em] leading-none sm:rounded-[0.35rem] ${
                    selected
                      ? 'border-[var(--ink)] ring-1 ring-[var(--ink)]'
                      : bad
                        ? 'border-[var(--accent)]'
                        : fifth
                          ? 'border-[var(--ink)]/25'
                          : 'border-[var(--line)]'
                  } ${
                    cell === 'fill'
                      ? 'bg-[var(--ink)] text-[var(--bg)]'
                      : bad
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-[var(--bg)] text-[var(--muted)]'
                  }`}
                >
                  {cell === 'mark' ? '×' : ''}
                </div>
              );
            })}
          </div>
        ))}
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
  const { puzzle } = result;

  return (
    <div className="px-4 py-5 sm:px-7 sm:py-7">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
        {mode === 'daily' ? `Daily #${puzzleNumberForDate(date)}` : 'Practice picture'}
      </p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight">
        {result.points}
        <span className="text-xl text-[var(--muted)]"> / {MAX_SCORE}</span>
      </h2>
      <p className="mt-2 text-sm text-[var(--ink)]">
        <strong className="font-medium">{gradeLabel(result.grade)}</strong>
        <span className="text-[var(--muted)]">
          {' '}
          · {formatTime(result.seconds)} · {checkLabel(result.checks)} · {mistakeLabel(result.mistakes)}
        </span>
      </p>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent)]">{puzzle.category}</p>
        <p className="mt-2 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)]">{puzzle.name}</p>
        <PictureReveal picture={puzzle.picture} />
        <p className="mt-4 leading-relaxed text-[var(--muted)]">{puzzle.blurb}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Source · {puzzle.source}</p>
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

function PictureReveal({ picture }: { picture: boolean[][] }) {
  const size = picture.length;
  return (
    <div
      className="mx-auto mt-4 w-max"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${size}, clamp(0.55rem, 3.6vw, 0.95rem))`,
        gap: '0.08rem',
      }}
      role="img"
      aria-label="Solved picture"
    >
      {picture.flatMap((row, r) =>
        row.map((filled, c) => (
          <span
            key={`${r}-${c}`}
            className={`aspect-square rounded-[0.12rem] ${filled ? 'bg-[var(--ink)]' : 'bg-[var(--bg-elevated)]'}`}
          />
        )),
      )}
    </div>
  );
}

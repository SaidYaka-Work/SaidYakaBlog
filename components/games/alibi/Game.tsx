'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { CellPos, Grid, Mode, Puzzle, Result } from './types';
import {
  MAX_SCORE,
  cellKey,
  checkLabel,
  cycleMark,
  dailyPuzzle,
  emptyGrid,
  formatTime,
  gradeLabel,
  isSolved,
  makeResult,
  mistakeLabel,
  moveCell,
  practicePuzzle,
  puzzleNumberForDate,
  revealLines,
  setMark,
  shareLines,
  solutionRows,
  utcDate,
  visibleGrids,
  wrongCells,
} from './logic';

const meta = getGameBySlug('alibi')!;

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

export default function AlibiGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('alibi-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [grid, setGrid] = useState<Grid>(() => emptyGrid(dailyPuzzle(date).size));
  const [history, setHistory] = useState<Grid[]>([]);
  const [used, setUsed] = useState<Set<string>>(() => new Set());
  const [cursor, setCursor] = useState<CellPos>({ grid: 'personRoom', row: 0, col: 0 });
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [audit, setAudit] = useState('');
  const [shareNote, setShareNote] = useState('');

  const done = phase === 'done';
  const boards = useMemo(() => visibleGrids(puzzle), [puzzle]);

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setGrid(emptyGrid(loaded.size));
      setHistory([]);
      setUsed(new Set());
      setCursor({ grid: 'personRoom', row: 0, col: 0 });
      setPhase('play');
      setResult(undefined);
      setSeconds(0);
      setRunning(false);
      setChecks(0);
      setMistakes(0);
      setFlagged(new Set());
      setAudit('');
      setShareNote('');
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
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(880, 0.16);
    },
    [beep, commitBest, puzzle],
  );

  const commitGrid = useCallback(
    (next: Grid) => {
      if (phase !== 'play') return;
      setHistory((current) => [...current.slice(-79), grid]);
      setGrid(next);
      setRunning(true);
      setFlagged(new Set());
      setAudit('');
      if (isSolved(puzzle, next)) finish(next, seconds, checks, mistakes);
    },
    [checks, finish, grid, mistakes, phase, puzzle, seconds],
  );

  const markCell = useCallback(
    (pos: CellPos, kind?: 'cycle' | 'no' | 'yes' | 'empty') => {
      if (phase !== 'play') return;
      setCursor(pos);
      const next =
        kind === 'no' || kind === 'yes' || kind === 'empty'
          ? setMark(grid, pos, kind, puzzle.categories)
          : cycleMark(grid, pos, puzzle.categories);
      if (JSON.stringify(next) === JSON.stringify(grid)) return;
      const nextMark = next[pos.grid][pos.row][pos.col];
      beep(nextMark === 'yes' ? 520 : nextMark === 'no' ? 280 : 340, 0.03);
      commitGrid(next);
    },
    [beep, commitGrid, grid, phase, puzzle.categories],
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
      setAudit('Nothing on the grid contradicts the case. Keep going.');
      beep(480, 0.06);
      return;
    }
    setAudit(
      wrong.length === 1 ? 'One mark does not fit the case.' : `${wrong.length} marks do not fit the case.`,
    );
    beep(200, 0.08);
  }, [beep, checks, finish, grid, mistakes, phase, puzzle, seconds]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/alibi');
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
          puzzle,
        );
        setCursor(next);
        beep(360, 0.02);
        return;
      }

      if (target?.tagName === 'BUTTON' && (event.code === 'Space' || event.code === 'Enter')) return;

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
      if (event.code === 'Slash' || event.key === '?' ) {
        event.preventDefault();
        checkGrid();
        return;
      }
      if (event.code === 'KeyX' || event.key === '-' || event.key === '/') {
        event.preventDefault();
        markCell(cursor, 'no');
        return;
      }
      if (event.code === 'KeyC' || event.code === 'KeyY' || event.code === 'Period') {
        event.preventDefault();
        markCell(cursor, 'yes');
        return;
      }
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        markCell(cursor, 'cycle');
        return;
      }
      if (event.code === 'Backspace' || event.code === 'Delete' || event.code === 'Digit0') {
        event.preventDefault();
        markCell(cursor, 'empty');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beep, checkGrid, cursor, markCell, phase, puzzle, undo]);

  const status = done && result
    ? `Closed · ${formatTime(result.seconds)} · ${result.points}/${MAX_SCORE}`
    : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${formatTime(seconds)} · ${checkLabel(checks)}`;

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
              Today’s case
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
          <EndScreen puzzle={puzzle} result={result} mode={mode} date={date} onShare={() => void share()} shareNote={shareNote} />
        ) : (
          <div className="px-3 py-5 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{puzzle.world.place}</p>
              {mode === 'daily' ? (
                <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                  Daily #{puzzleNumberForDate(date)}
                </span>
              ) : (
                <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Practice · 3×3
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{puzzle.world.hook}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
              Missing · {puzzle.world.item}
            </p>

            <div className={`mt-5 grid gap-5 ${puzzle.categories === 3 ? 'sm:grid-cols-2' : ''}`}>
              {boards.map((board) => (
                <LogicGrid
                  key={board.id}
                  board={board}
                  marks={grid[board.id]}
                  cursor={cursor}
                  flagged={flagged}
                  onMark={(row, col) => markCell({ grid: board.id, row, col })}
                  wide={board.id === 'roomTime'}
                />
              ))}
            </div>

            <p className="mt-3 hidden text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] sm:block">
              arrows move · X no · C or Space yes · U undo · ? check
            </p>

            <ol className="mt-5 space-y-2" aria-label="Clues">
              {puzzle.clues.map((clue, index) => {
                const ticked = used.has(clue.id);
                return (
                  <li key={clue.id}>
                    <button
                      type="button"
                      aria-pressed={ticked}
                      onClick={() => {
                        setUsed((current) => {
                          const next = new Set(current);
                          if (next.has(clue.id)) next.delete(clue.id);
                          else next.add(clue.id);
                          return next;
                        });
                        beep(400, 0.02);
                      }}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left sm:px-4 ${
                        ticked
                          ? 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                          : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] ${
                          ticked
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                            : 'border-[var(--line)] text-[var(--faint)]'
                        }`}
                      >
                        {ticked ? '✓' : index + 1}
                      </span>
                      <span className={`text-sm leading-relaxed ${ticked ? 'line-through' : ''}`}>{clue.text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <p className="mt-4 text-sm text-[var(--muted)]" aria-live="polite">
              {audit || `${mistakeLabel(mistakes)} · a check costs score`}
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

function LogicGrid({
  board,
  marks,
  cursor,
  flagged,
  onMark,
  wide = false,
}: {
  board: ReturnType<typeof visibleGrids>[number];
  marks: Grid['personRoom'];
  cursor: CellPos;
  flagged: Set<string>;
  onMark: (row: number, col: number) => void;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
        {board.rowTitle} × {board.colTitle}
      </p>
      <div
        className="mt-2 w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `minmax(3.4rem, 4.6rem) repeat(${board.cols.length}, minmax(2.1rem, 1fr))`,
          gap: '0.2rem',
        }}
        role="grid"
        aria-label={`${board.rowTitle} by ${board.colTitle} grid`}
      >
        <span />
        {board.cols.map((label) => (
          <span
            key={label}
            className="px-0.5 text-center text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--muted)]"
            title={label}
          >
            {label}
          </span>
        ))}
        {board.rows.map((rowLabel, row) => (
          <div key={rowLabel} className="contents">
            <span className="flex items-center pr-1 text-left text-[11px] font-medium leading-tight text-[var(--ink)] sm:text-xs">
              {rowLabel}
            </span>
            {board.cols.map((colLabel, col) => {
              const mark = marks[row][col];
              const pos = { grid: board.id, row, col };
              const selected = cursor.grid === board.id && cursor.row === row && cursor.col === col;
              const bad = flagged.has(cellKey(pos));
              return (
                <button
                  key={`${rowLabel}-${colLabel}`}
                  type="button"
                  role="gridcell"
                  aria-label={`${rowLabel} and ${colLabel}, ${mark === 'yes' ? 'yes' : mark === 'no' ? 'no' : 'empty'}`}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onMark(row, col)}
                  className={`flex min-h-9 items-center justify-center rounded-md border text-sm sm:min-h-10 ${
                    selected
                      ? 'border-[var(--ink)] bg-[var(--accent-soft)] text-[var(--ink)]'
                      : bad
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : mark === 'yes'
                          ? 'border-[var(--accent)]/50 bg-[var(--bg)] text-[var(--ink)]'
                          : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                  }`}
                >
                  {mark === 'yes' ? '✓' : mark === 'no' ? '×' : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function EndScreen({
  puzzle,
  result,
  mode,
  date,
  onShare,
  shareNote,
}: {
  puzzle: Puzzle;
  result: Result;
  mode: Mode;
  date: string;
  onShare: () => void;
  shareNote: string;
}) {
  const story = revealLines(result);
  const rows = solutionRows(puzzle);

  return (
    <div className="px-4 py-5 sm:px-7 sm:py-7">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
        {mode === 'daily' ? `Daily #${puzzleNumberForDate(date)}` : 'Practice case'}
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

      <blockquote className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent)]">Who took it</p>
        <p className="mt-2 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)]">{story[0]}</p>
        <p className="mt-3 leading-relaxed text-[var(--muted)]">{story[1]}</p>
      </blockquote>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">The arrangement</p>
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li
              key={row.person.name}
              className={`rounded-2xl border px-4 py-3 ${
                row.person.name === result.culprit.name
                  ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)]'
                  : 'border-[var(--line)] bg-[var(--bg)]'
              }`}
            >
              <p className="font-serif text-lg tracking-tight text-[var(--ink)]">
                {row.person.name}
                <span className="text-sm text-[var(--muted)]"> · the {row.person.role}</span>
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {row.room.name}
                {row.time ? ` · ${row.time.name}` : ''}
                {row.person.name === result.culprit.name ? ' · took it' : ''}
              </p>
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

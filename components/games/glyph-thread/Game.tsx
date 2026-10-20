'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { useGameChrome } from '../useGameChrome';
import { WORDS } from './words';

const meta = getGameBySlug('glyph-thread')!;
const SIZE = 4;
const TIME = 75;
const LETTERS = 'EEEEAAAAIIIIOOOOULLNRSTBCDGMPHFVWYKJXQZ';

type Cell = { row: number; col: number };

function keyOf(cell: Cell) {
  return `${cell.row},${cell.col}`;
}

function neighbors(a: Cell, b: Cell) {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) === 1;
}

function emptyGrid(): string[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ''));
}

function placeWord(grid: string[][], word: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const path: Cell[] = [];
    const used = new Set<string>();
    let row = Math.floor(Math.random() * SIZE);
    let col = Math.floor(Math.random() * SIZE);
    if (grid[row][col] && grid[row][col] !== word[0]) continue;
    path.push({ row, col });
    used.add(`${row},${col}`);
    let ok = true;
    for (let i = 1; i < word.length; i += 1) {
      const options: Cell[] = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
          if (used.has(`${nr},${nc}`)) continue;
          if (grid[nr][nc] && grid[nr][nc] !== word[i]) continue;
          options.push({ row: nr, col: nc });
        }
      }
      if (!options.length) {
        ok = false;
        break;
      }
      const next = options[Math.floor(Math.random() * options.length)];
      path.push(next);
      used.add(keyOf(next));
      row = next.row;
      col = next.col;
    }
    if (!ok) continue;
    path.forEach((cell, index) => {
      grid[cell.row][cell.col] = word[index].toUpperCase();
    });
    return true;
  }
  return false;
}

function makeGrid() {
  const grid = emptyGrid();
  const pool = [...WORDS].filter((word) => word.length >= 4 && word.length <= 6);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let placed = 0;
  for (const word of pool) {
    if (placed >= 3) break;
    if (placeWord(grid, word)) placed += 1;
  }
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!grid[row][col]) grid[row][col] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
  }
  return grid;
}

function cellFromEvent(event: PointerEvent<HTMLElement>): Cell | null {
  const node = document.elementFromPoint(event.clientX, event.clientY);
  const button = node?.closest('[data-row][data-col]');
  if (!(button instanceof HTMLElement)) return null;
  return { row: Number(button.dataset.row), col: Number(button.dataset.col) };
}

function wordScore(word: string) {
  if (word.length >= 6) return 80;
  if (word.length === 5) return 40;
  if (word.length === 4) return 20;
  return 10;
}

export default function GlyphThreadGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('glyph-thread-best');
  const [grid, setGrid] = useState(makeGrid);
  const [path, setPath] = useState<Cell[]>([]);
  const pathRef = useRef<Cell[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(TIME);
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState('Thread a word of three or more letters.');

  const current = useMemo(() => path.map((cell) => grid[cell.row][cell.col]).join(''), [grid, path]);
  const pathKeys = useMemo(() => new Set(path.map(keyOf)), [path]);

  const restart = useCallback(() => {
    setGrid(makeGrid());
    pathRef.current = [];
    setPath([]);
    setFound([]);
    setScore(0);
    setTime(TIME);
    setPlaying(true);
    setStatus('Thread a word of three or more letters.');
  }, []);

  const submit = useCallback(
    (cells: Cell[]) => {
      if (!playing) return;
      const word = cells.map((cell) => grid[cell.row][cell.col]).join('').toLowerCase();
      if (word.length < 3) {
        setStatus('Need three letters.');
        beep(200, 0.05);
        return;
      }
      if (!WORDS.has(word)) {
        setStatus(`“${word}” is not in the lexicon.`);
        beep(160, 0.06);
        return;
      }
      if (found.includes(word)) {
        setStatus('Already gathered.');
        beep(220, 0.05);
        return;
      }
      const gained = wordScore(word);
      const nextScore = score + gained;
      setFound((list) => [word, ...list]);
      setScore(nextScore);
      setStatus(`${word.toUpperCase()} · +${gained}`);
      beep(700 + word.length * 40, 0.08);
    },
    [beep, found, grid, playing, score],
  );

  const addCell = useCallback(
    (cell: Cell) => {
      if (!playing) return;
      setPath((currentPath) => {
        let next = currentPath;
        if (currentPath.some((item) => item.row === cell.row && item.col === cell.col)) {
          const index = currentPath.findIndex((item) => item.row === cell.row && item.col === cell.col);
          next = currentPath.slice(0, index + 1);
        } else if (!currentPath.length) {
          next = [cell];
        } else if (neighbors(currentPath[currentPath.length - 1], cell)) {
          next = [...currentPath, cell];
        }
        pathRef.current = next;
        return next;
      });
    },
    [playing],
  );

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setTime((left) => {
        if (left <= 1) {
          window.clearInterval(timer);
          setPlaying(false);
          setPath([]);
          commitBest(score);
          setStatus(score ? `Time. You threaded ${score}.` : 'Time. Another grid awaits.');
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [commitBest, playing, score]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Enter') {
        event.preventDefault();
        submit(pathRef.current);
        pathRef.current = [];
        setPath([]);
        return;
      }
      if (event.code === 'Backspace') {
        event.preventDefault();
        setPath((cells) => {
          const next = cells.slice(0, -1);
          pathRef.current = next;
          return next;
        });
        return;
      }
      if (event.code === 'Escape') {
        pathRef.current = [];
        setPath([]);
        return;
      }
      const letter = event.key.toLowerCase();
      if (!/^[a-z]$/.test(letter) || !playing) return;
      event.preventDefault();
      setPath((currentPath) => {
        let next = currentPath;
        if (!currentPath.length) {
          for (let row = 0; row < SIZE; row += 1) {
            for (let col = 0; col < SIZE; col += 1) {
              if (grid[row][col].toLowerCase() === letter) {
                next = [{ row, col }];
                pathRef.current = next;
                return next;
              }
            }
          }
          return currentPath;
        }
        const last = currentPath[currentPath.length - 1];
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (!dr && !dc) continue;
            const row = last.row + dr;
            const col = last.col + dc;
            if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) continue;
            if (currentPath.some((cell) => cell.row === row && cell.col === col)) continue;
            if (grid[row][col].toLowerCase() === letter) {
              next = [...currentPath, { row, col }];
              pathRef.current = next;
              return next;
            }
          }
        }
        pathRef.current = next;
        return next;
      });
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [grid, path, playing, submit]);

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={score}
      best={best ?? '—'}
      status={`${status} · ${time}s`}
      muted={muted}
      onMute={toggleMute}
      onRestart={restart}
    >
      <div className="px-4 py-6 sm:px-6">
        <p className="mb-4 min-h-7 text-center font-serif text-2xl tracking-[0.18em] text-[var(--ink)]">
          {current || '—'}
        </p>
        <div
          className="mx-auto grid max-w-sm grid-cols-4 gap-2 touch-none select-none"
          onPointerDown={(event) => {
            const cell = cellFromEvent(event);
            if (!cell) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            addCell(cell);
          }}
          onPointerMove={(event) => {
            if (!event.buttons && event.pressure === 0) return;
            const cell = cellFromEvent(event);
            if (cell) addCell(cell);
          }}
          onPointerUp={() => {
            if (pathRef.current.length) {
              submit(pathRef.current);
              pathRef.current = [];
              setPath([]);
            }
          }}
        >
          {grid.map((row, r) =>
            row.map((letter, c) => {
              const active = pathKeys.has(`${r},${c}`);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  data-row={r}
                  data-col={c}
                  className={`h-16 rounded-2xl border text-xl font-serif sm:h-[4.5rem] sm:text-2xl ${
                    active
                      ? 'border-[var(--ink)] bg-[var(--accent-soft)] text-[var(--ink)]'
                      : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                  }`}
                >
                  {letter}
                </button>
              );
            }),
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          {found.length ? found.map((word) => <span key={word}>{word}</span>) : <span>No words yet.</span>}
        </div>
      </div>
    </GameShell>
  );
}

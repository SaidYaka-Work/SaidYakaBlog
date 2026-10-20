'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { useGameChrome } from '../useGameChrome';

const meta = getGameBySlug('lantern-circuit')!;
const SIZE = 5;
const DIRS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] as const;

type Kind = 'I' | 'L' | 'T';
type Tile = { kind: Kind; rot: number };

function openings(kind: Kind, rot: number): boolean[] {
  const turn = ((rot % 4) + 4) % 4;
  if (kind === 'I') return turn % 2 === 0 ? [true, false, true, false] : [false, true, false, true];
  if (kind === 'L') {
    const base = [true, true, false, false];
    return base.map((_, index) => base[(index - turn + 4) % 4]);
  }
  const missing = turn;
  return [0, 1, 2, 3].map((dir) => dir !== missing);
}

function kindFor(mask: boolean[]): Kind {
  const count = mask.filter(Boolean).length;
  if (count >= 3) return 'T';
  const [n, e, s, w] = mask;
  if ((n && s && !e && !w) || (e && w && !n && !s)) return 'I';
  return 'L';
}

function rotationMatching(kind: Kind, mask: boolean[]): number {
  for (let rot = 0; rot < 4; rot += 1) {
    const open = openings(kind, rot);
    if (mask.every((needed, index) => !needed || open[index])) return rot;
  }
  return 0;
}

function inBounds(row: number, col: number) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function buildPuzzle(): Tile[][] {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const path = carvePath();
    if (!path) continue;
    const required: boolean[][][] = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => [false, false, false, false]),
    );
    required[path[0][0]][path[0][1]][3] = true;
    required[path[path.length - 1][0]][path[path.length - 1][1]][1] = true;
    for (let i = 0; i < path.length - 1; i += 1) {
      const [r1, c1] = path[i];
      const [r2, c2] = path[i + 1];
      const dir = DIRS.findIndex(([dr, dc]) => r1 + dr === r2 && c1 + dc === c2);
      required[r1][c1][dir] = true;
      required[r2][c2][(dir + 2) % 4] = true;
    }

    const grid: Tile[][] = Array.from({ length: SIZE }, (_, row) =>
      Array.from({ length: SIZE }, (__, col) => {
        const mask = required[row][col];
        const needed = mask.some(Boolean);
        const kind = needed ? kindFor(mask) : Math.random() < 0.55 ? 'L' : 'I';
        return { kind, rot: needed ? rotationMatching(kind, mask) : Math.floor(Math.random() * 4) };
      }),
    );

    for (const row of grid) {
      for (const tile of row) tile.rot = (tile.rot + 1 + Math.floor(Math.random() * 3)) % 4;
    }
    return grid;
  }
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ kind: 'L' as const, rot: 0 })),
  );
}

function carvePath(): [number, number][] | null {
  const start: [number, number] = [2, 0];
  const end: [number, number] = [2, SIZE - 1];
  const visited = new Set<string>(['2,0']);
  const path: [number, number][] = [start];

  const search = (row: number, col: number): boolean => {
    if (row === end[0] && col === end[1]) return true;
    const order = [1, 0, 2, 3].sort(() => Math.random() - 0.45);
    for (const dir of order) {
      const nr = row + DIRS[dir][0];
      const nc = col + DIRS[dir][1];
      const key = `${nr},${nc}`;
      if (!inBounds(nr, nc) || visited.has(key)) continue;
      visited.add(key);
      path.push([nr, nc]);
      if (search(nr, nc)) return true;
      path.pop();
      visited.delete(key);
    }
    return false;
  };

  return search(start[0], start[1]) ? path : null;
}

function poweredCells(grid: Tile[][]): Set<string> {
  const start = '2,0';
  if (!openings(grid[2][0].kind, grid[2][0].rot)[3]) return new Set();
  const seen = new Set<string>([start]);
  const queue = [[2, 0]];
  while (queue.length) {
    const [row, col] = queue.shift()!;
    const open = openings(grid[row][col].kind, grid[row][col].rot);
    open.forEach((isOpen, dir) => {
      if (!isOpen) return;
      const nr = row + DIRS[dir][0];
      const nc = col + DIRS[dir][1];
      if (!inBounds(nr, nc)) return;
      const back = (dir + 2) % 4;
      if (!openings(grid[nr][nc].kind, grid[nr][nc].rot)[back]) return;
      const key = `${nr},${nc}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push([nr, nc]);
    });
  }
  return seen;
}

function isSolved(grid: Tile[][], powered: Set<string>) {
  if (!powered.has(`2,${SIZE - 1}`)) return false;
  return openings(grid[2][SIZE - 1].kind, grid[2][SIZE - 1].rot)[1];
}

export default function LanternCircuitGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('lantern-circuit-best');
  const [grid, setGrid] = useState<Tile[][]>(() => buildPuzzle());
  const [turns, setTurns] = useState(0);
  const [score, setScore] = useState(0);
  const [cursor, setCursor] = useState<[number, number]>([2, 0]);
  const [status, setStatus] = useState('Rotate the copper until the lantern finds the gate.');
  const [won, setWon] = useState(false);

  const powered = useMemo(() => poweredCells(grid), [grid]);

  const rotateAt = useCallback(
    (row: number, col: number) => {
      if (won) return;
      setGrid((current) => {
        const next = current.map((line) => line.map((tile) => ({ ...tile })));
        next[row][col].rot = (next[row][col].rot + 1) % 4;
        const lit = poweredCells(next);
        setTurns((prev) => {
          const nextTurns = prev + 1;
          if (isSolved(next, lit)) {
            const earned = Math.max(40, 360 - nextTurns * 12);
            setScore(earned);
            setWon(true);
            setStatus(`The gate took the light in ${nextTurns} turns.`);
            commitBest(earned);
            beep(820, 0.14);
          } else {
            beep(390, 0.04);
          }
          return nextTurns;
        });
        return next;
      });
    },
    [beep, commitBest, won],
  );

  const restart = useCallback(() => {
    setGrid(buildPuzzle());
    setTurns(0);
    setScore(0);
    setWon(false);
    setCursor([2, 0]);
    setStatus('Rotate the copper until the lantern finds the gate.');
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'ArrowUp') setCursor(([r, c]) => [Math.max(0, r - 1), c]);
      if (event.code === 'ArrowDown') setCursor(([r, c]) => [Math.min(SIZE - 1, r + 1), c]);
      if (event.code === 'ArrowLeft') setCursor(([r, c]) => [r, Math.max(0, c - 1)]);
      if (event.code === 'ArrowRight') setCursor(([r, c]) => [r, Math.min(SIZE - 1, c + 1)]);
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        rotateAt(cursor[0], cursor[1]);
      }
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, rotateAt]);

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={score}
      best={best ?? '—'}
      status={`${status}${turns ? ` · ${turns} turns` : ''}`}
      muted={muted}
      onMute={toggleMute}
      onRestart={restart}
    >
      <div className="flex items-center justify-center gap-3 px-3 py-6 sm:gap-5 sm:px-6">
        <span className="font-serif text-sm text-[var(--accent)] sm:text-base">Lantern</span>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {grid.map((row, r) =>
            row.map((tile, c) => {
              const lit = powered.has(`${r},${c}`);
              const active = cursor[0] === r && cursor[1] === c;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  aria-label={`Rotate pipe at row ${r + 1}, column ${c + 1}`}
                  onClick={() => rotateAt(r, c)}
                  className={`relative h-14 w-14 rounded-xl border sm:h-16 sm:w-16 ${
                    active ? 'border-[var(--ink)]' : 'border-[var(--line)]'
                  } ${lit ? 'bg-[var(--accent-soft)]' : 'bg-[var(--bg)]'}`}
                >
                  <Pipe kind={tile.kind} rot={tile.rot} lit={lit} />
                </button>
              );
            }),
          )}
        </div>
        <span className="font-serif text-sm text-[var(--accent)] sm:text-base">Gate</span>
      </div>
    </GameShell>
  );
}

function Pipe({ kind, rot, lit }: { kind: Kind; rot: number; lit: boolean }) {
  const open = openings(kind, rot);
  const color = lit ? 'var(--accent)' : 'var(--muted)';
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
      <circle cx="20" cy="20" r="3.4" fill={color} />
      {open[0] && <rect x="17.2" y="2" width="5.6" height="18" rx="2" fill={color} />}
      {open[1] && <rect x="20" y="17.2" width="18" height="5.6" rx="2" fill={color} />}
      {open[2] && <rect x="17.2" y="20" width="5.6" height="18" rx="2" fill={color} />}
      {open[3] && <rect x="2" y="17.2" width="18" height="5.6" rx="2" fill={color} />}
    </svg>
  );
}

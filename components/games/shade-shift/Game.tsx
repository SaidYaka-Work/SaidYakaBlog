'use client';

import { useCallback, useEffect, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { useGameChrome } from '../useGameChrome';

const meta = getGameBySlug('shade-shift')!;
const SIZE = 5;

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => false));
}

function flipCell(board: boolean[][], row: number, col: number) {
  const next = board.map((line) => [...line]);
  const spots: [number, number][] = [
    [row, col],
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
  for (const [r, c] of spots) {
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) next[r][c] = !next[r][c];
  }
  return next;
}

function makePuzzle() {
  let board = emptyBoard();
  const presses = 8 + Math.floor(Math.random() * 5);
  const used = new Set<string>();
  while (used.size < presses) {
    const row = Math.floor(Math.random() * SIZE);
    const col = Math.floor(Math.random() * SIZE);
    const key = `${row},${col}`;
    if (used.has(key)) continue;
    used.add(key);
    board = flipCell(board, row, col);
  }
  return { board, par: used.size };
}

function allDark(board: boolean[][]) {
  return board.every((row) => row.every((lit) => !lit));
}

export default function ShadeShiftGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('shade-shift-best');
  const [{ board, par }, setPuzzle] = useState(makePuzzle);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [cursor, setCursor] = useState<[number, number]>([2, 2]);
  const [won, setWon] = useState(false);
  const [status, setStatus] = useState('Put the whole grid to sleep.');

  const restart = useCallback(() => {
    setPuzzle(makePuzzle());
    setMoves(0);
    setScore(0);
    setWon(false);
    setCursor([2, 2]);
    setStatus('Put the whole grid to sleep.');
  }, []);

  const press = useCallback(
    (row: number, col: number) => {
      if (won) return;
      setPuzzle((current) => {
        const nextBoard = flipCell(current.board, row, col);
        setMoves((prev) => {
          const nextMoves = prev + 1;
          if (allDark(nextBoard)) {
            const earned = Math.max(50, 220 - Math.max(0, nextMoves - current.par) * 16);
            setScore(earned);
            setWon(true);
            setStatus(`All shade. ${nextMoves} moves against par ${current.par}.`);
            commitBest(earned);
            beep(840, 0.14);
          } else {
            beep(430, 0.04);
          }
          return nextMoves;
        });
        return { board: nextBoard, par: current.par };
      });
    },
    [beep, commitBest, won],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'ArrowUp') setCursor(([r, c]) => [Math.max(0, r - 1), c]);
      if (event.code === 'ArrowDown') setCursor(([r, c]) => [Math.min(SIZE - 1, r + 1), c]);
      if (event.code === 'ArrowLeft') setCursor(([r, c]) => [r, Math.max(0, c - 1)]);
      if (event.code === 'ArrowRight') setCursor(([r, c]) => [r, Math.min(SIZE - 1, c + 1)]);
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        press(cursor[0], cursor[1]);
      }
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, press]);

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={score}
      best={best ?? '—'}
      status={`${status}${moves ? ` · ${moves} moves` : ''}`}
      muted={muted}
      onMute={toggleMute}
      onRestart={restart}
    >
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-sm grid-cols-5 gap-2">
          {board.map((row, r) =>
            row.map((lit, c) => {
              const active = cursor[0] === r && cursor[1] === c;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  aria-label={`${lit ? 'Lit' : 'Dark'} tile ${r + 1},${c + 1}`}
                  onClick={() => press(r, c)}
                  className={`h-14 rounded-2xl border transition-colors duration-150 sm:h-16 ${
                    lit
                      ? 'bg-[var(--accent)] border-[var(--accent)]'
                      : 'bg-[#16120f] border-[var(--line)]'
                  } ${active ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--bg-elevated)]' : ''}`}
                />
              );
            }),
          )}
        </div>
        <p className="mt-4 text-center text-sm text-[var(--muted)]">Par {par}</p>
      </div>
    </GameShell>
  );
}

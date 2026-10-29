import { SPECS } from './pictures';
import type { Cell, CellPos, Grade, Grid, Mode, PictureSpec, Puzzle, Result } from './types';

export const MAX_SCORE = 100;
export const CHECK_COST = 8;
export const MISTAKE_COST = 2;
export const TIME_STEP_SECONDS = 30;
export const TIME_STEP_COST = 2;
export const MIN_SOLVED_SCORE = 20;
export const LAUNCH_DATE = '2026-10-29';
export const ROTATION_SEED = 0x7e55e4a;

const GRADE_LABEL: Record<Grade, string> = {
  swift: 'Swift',
  steady: 'Steady',
  patient: 'Patient',
  checked: 'Checked',
  guided: 'Guided',
};

const placementCache = new Map<string, boolean[][]>();

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0x7e55e4a) >>> 0;
}

export function mulberry32(seed: number) {
  return () => {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function calendarDayIndex(date: string, launch = LAUNCH_DATE): number {
  const current = Date.parse(`${date}T00:00:00Z`);
  const origin = Date.parse(`${launch}T00:00:00Z`);
  return Math.floor((current - origin) / 86_400_000);
}

export function puzzleNumberForDate(date: string): number {
  return Math.max(1, calendarDayIndex(date) + 1);
}

export function addUtcDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function graceSeconds(size: number): number {
  if (size >= 15) return 360;
  if (size >= 12) return 240;
  return 180;
}

export function parseRows(rows: readonly string[], size: number): boolean[][] {
  return rows.map((row) => {
    if (row.length !== size) {
      throw new Error(`Tessera: row length ${row.length} does not match size ${size}`);
    }
    return Array.from(row, (ch) => {
      if (ch === '#') return true;
      if (ch === '.') return false;
      throw new Error(`Tessera: unexpected cell '${ch}'`);
    });
  });
}

export function cluesFromLine(cells: readonly boolean[]): number[] {
  const clues: number[] = [];
  let run = 0;
  for (const cell of cells) {
    if (cell) {
      run += 1;
    } else if (run) {
      clues.push(run);
      run = 0;
    }
  }
  if (run) clues.push(run);
  return clues;
}

export function cluesFromGrid(picture: readonly boolean[][]): { rowClues: number[][]; colClues: number[][] } {
  const size = picture.length;
  const rowClues = picture.map((row) => cluesFromLine(row));
  const colClues = Array.from({ length: size }, (_, col) => cluesFromLine(picture.map((row) => row[col])));
  return { rowClues, colClues };
}

export function lineKey(n: number, clues: readonly number[]): string {
  return `${n}:${clues.join(',')}`;
}

export function placementsFor(n: number, clues: readonly number[]): boolean[][] {
  const key = lineKey(n, clues);
  const hit = placementCache.get(key);
  if (hit) return hit;

  const out: boolean[][] = [];
  if (clues.length === 0) {
    out.push(Array.from({ length: n }, () => false));
    placementCache.set(key, out);
    return out;
  }

  const line = Array.from({ length: n }, () => false);
  const walk = (index: number, start: number) => {
    if (index === clues.length) {
      out.push(line.slice());
      return;
    }
    let needAfter = 0;
    for (let i = index + 1; i < clues.length; i += 1) needAfter += clues[i] + 1;
    const run = clues[index];
    const last = n - run - needAfter;
    for (let s = start; s <= last; s += 1) {
      for (let i = s; i < s + run; i += 1) line[i] = true;
      walk(index + 1, s + run + 1);
      for (let i = s; i < s + run; i += 1) line[i] = false;
    }
  };
  walk(0, 0);
  placementCache.set(key, out);
  return out;
}

function compatible(placement: readonly boolean[], known: readonly number[]): boolean {
  for (let i = 0; i < known.length; i += 1) {
    if (known[i] === 1 && !placement[i]) return false;
    if (known[i] === -1 && placement[i]) return false;
  }
  return true;
}

/** 0 unknown, 1 filled, -1 empty. Returns null on contradiction. */
export function deduceLine(known: readonly number[], clues: readonly number[]): number[] | null {
  const options = placementsFor(known.length, clues).filter((placement) => compatible(placement, known));
  if (options.length === 0) return null;
  const next = known.slice();
  for (let i = 0; i < known.length; i += 1) {
    if (known[i] !== 0) continue;
    const allFill = options.every((placement) => placement[i]);
    const allEmpty = options.every((placement) => !placement[i]);
    if (allFill) next[i] = 1;
    else if (allEmpty) next[i] = -1;
  }
  return next;
}

export type SolveResult = {
  grid: number[][];
  solved: boolean;
  unknown: number;
};

export function lineSolve(rowClues: readonly number[][], colClues: readonly number[][]): SolveResult {
  const height = rowClues.length;
  const width = colClues.length;
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
  let progress = true;
  let guard = 0;
  const limit = height * width + 4;

  while (progress && guard < limit) {
    progress = false;
    guard += 1;

    for (let row = 0; row < height; row += 1) {
      const next = deduceLine(grid[row], rowClues[row]);
      if (!next) return { grid, solved: false, unknown: countUnknown(grid) };
      for (let col = 0; col < width; col += 1) {
        if (next[col] !== grid[row][col]) {
          grid[row][col] = next[col];
          progress = true;
        }
      }
    }

    for (let col = 0; col < width; col += 1) {
      const column = grid.map((row) => row[col]);
      const next = deduceLine(column, colClues[col]);
      if (!next) return { grid, solved: false, unknown: countUnknown(grid) };
      for (let row = 0; row < height; row += 1) {
        if (next[row] !== grid[row][col]) {
          grid[row][col] = next[row];
          progress = true;
        }
      }
    }
  }

  const unknown = countUnknown(grid);
  return { grid, solved: unknown === 0, unknown };
}

function countUnknown(grid: readonly number[][]): number {
  return grid.reduce((sum, row) => sum + row.filter((cell) => cell === 0).length, 0);
}

export function isLineSolvable(picture: readonly boolean[][]): boolean {
  const { rowClues, colClues } = cluesFromGrid(picture);
  const result = lineSolve(rowClues, colClues);
  if (!result.solved) return false;
  return result.grid.every((row, r) => row.every((cell, c) => (cell === 1) === picture[r][c]));
}

export function emptyGrid(size: number): Grid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 'empty' as const));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

export function setCell(grid: Grid, row: number, col: number, value: Cell): Grid {
  if (grid[row][col] === value) return grid;
  const next = cloneGrid(grid);
  next[row][col] = value;
  return next;
}

export function paintLine(grid: Grid, from: CellPos, to: CellPos, value: Cell): Grid {
  if (from.row !== to.row && from.col !== to.col) return grid;
  const next = cloneGrid(grid);
  if (from.row === to.row) {
    const [start, end] = from.col <= to.col ? [from.col, to.col] : [to.col, from.col];
    for (let col = start; col <= end; col += 1) next[from.row][col] = value;
  } else {
    const [start, end] = from.row <= to.row ? [from.row, to.row] : [to.row, from.row];
    for (let row = start; row <= end; row += 1) next[row][from.col] = value;
  }
  return next;
}

export function isSolved(puzzle: Puzzle, grid: Grid): boolean {
  return grid.every((row, r) => row.every((cell, c) => (cell === 'fill') === puzzle.picture[r][c]));
}

export function wrongCells(puzzle: Puzzle, grid: Grid): CellPos[] {
  const out: CellPos[] = [];
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const cell = grid[row][col];
      const filled = puzzle.picture[row][col];
      if (cell === 'fill' && !filled) out.push({ row, col });
      else if (cell === 'mark' && filled) out.push({ row, col });
    }
  }
  return out;
}

export function cellKey(pos: CellPos): string {
  return `${pos.row}:${pos.col}`;
}

export function moveCell(pos: CellPos, dRow: number, dCol: number, size: number): CellPos {
  return {
    row: Math.min(size - 1, Math.max(0, pos.row + dRow)),
    col: Math.min(size - 1, Math.max(0, pos.col + dCol)),
  };
}

export function formatClue(clues: readonly number[]): string {
  return clues.length === 0 ? '0' : clues.join(' ');
}

export function maxClueCount(clues: readonly number[][]): number {
  return Math.max(1, ...clues.map((line) => Math.max(1, line.length)));
}

export function filledCount(picture: readonly boolean[][]): number {
  return picture.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

export function buildPuzzle(spec: PictureSpec): Puzzle {
  const picture = parseRows(spec.rows, spec.size);
  const { rowClues, colClues } = cluesFromGrid(picture);
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    size: spec.size,
    picture,
    rowClues,
    colClues,
    blurb: spec.blurb,
    source: spec.source,
  };
}

function sentenceCount(text: string): number {
  return text.split(/[.?!](?:\s|$)/).filter((part) => part.trim().length > 20).length;
}

function validateBank(specs: readonly PictureSpec[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  const failures: string[] = [];
  let large = 0;
  for (const spec of specs) {
    if (ids.has(spec.id)) throw new Error(`Tessera: duplicate id ${spec.id}`);
    ids.add(spec.id);
    const nameKey = spec.name.toLowerCase();
    if (names.has(nameKey)) throw new Error(`Tessera: duplicate name ${spec.name}`);
    names.add(nameKey);
    if (spec.size !== 10 && spec.size !== 12 && spec.size !== 15) {
      throw new Error(`Tessera: ${spec.id} has invalid size ${spec.size}`);
    }
    if (spec.rows.length !== spec.size) {
      throw new Error(`Tessera: ${spec.id} has ${spec.rows.length} rows, expected ${spec.size}`);
    }
    const picture = parseRows(spec.rows, spec.size);
    const filled = filledCount(picture);
    if (filled < spec.size) throw new Error(`Tessera: ${spec.id} is too sparse (${filled} cells)`);
    if (!spec.blurb.trim() || !spec.source.trim()) throw new Error(`Tessera: ${spec.id} is missing copy`);
    if (sentenceCount(spec.blurb) < 2) {
      throw new Error(`Tessera: ${spec.id} blurb should be two or three sentences`);
    }
    if (!isLineSolvable(picture)) {
      const { rowClues, colClues } = cluesFromGrid(picture);
      const { unknown } = lineSolve(rowClues, colClues);
      failures.push(`${spec.id} (${unknown} cells remain)`);
    }
    if (spec.size >= 12) large += 1;
  }
  if (failures.length) {
    throw new Error(`Tessera: not line-solvable: ${failures.join(', ')}`);
  }
  if (specs.length < 40) throw new Error(`Tessera: bank has ${specs.length} pictures; need at least 40`);
  if (large < 6) throw new Error(`Tessera: need at least 6 weekend-size pictures, got ${large}`);
}

validateBank(SPECS);

export const PUZZLES: Puzzle[] = SPECS.map(buildPuzzle);

export function weekdaySpecs(specs: readonly PictureSpec[] = SPECS): PictureSpec[] {
  return specs.filter((spec) => spec.size === 10);
}

export function weekendSpecs(specs: readonly PictureSpec[] = SPECS): PictureSpec[] {
  return specs.filter((spec) => spec.size >= 12);
}

export function rotationOrder(specs: readonly PictureSpec[], seed = ROTATION_SEED): PictureSpec[] {
  return shuffle(specs, mulberry32(seed));
}

function poolIndex(date: string, weekend: boolean): number {
  let count = 0;
  const days = calendarDayIndex(date);
  const start = days >= 0 ? 0 : days;
  const end = days >= 0 ? days : 0;
  for (let offset = start; offset <= end; offset += 1) {
    const current = addUtcDays(LAUNCH_DATE, offset);
    if (isWeekend(current) === weekend) {
      if (offset === days) return count;
      count += 1;
    }
  }
  return Math.max(0, count);
}

export function dailySpec(date = utcDate()): PictureSpec {
  const weekend = isWeekend(date);
  const pool = weekend ? weekendSpecs() : weekdaySpecs();
  const order = rotationOrder(pool, ROTATION_SEED ^ (weekend ? 1 : 0));
  const index = poolIndex(date, weekend);
  const wrapped = ((index % order.length) + order.length) % order.length;
  return order[wrapped];
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  return buildPuzzle(dailySpec(date));
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000), date = utcDate()): Puzzle {
  const today = dailySpec(date);
  const pool = SPECS.filter((spec) => spec.id !== today.id);
  const random = mulberry32(seed);
  return buildPuzzle(pool[Math.floor(random() * pool.length)] ?? today);
}

export function scoreRun(seconds: number, checks: number, mistakes: number, size: number): number {
  let points = MAX_SCORE - checks * CHECK_COST - mistakes * MISTAKE_COST;
  const grace = graceSeconds(size);
  if (seconds > grace) {
    const extra = Math.floor((seconds - grace) / TIME_STEP_SECONDS);
    points -= extra * TIME_STEP_COST;
  }
  return Math.max(MIN_SOLVED_SCORE, points);
}

export function gradeFor(seconds: number, checks: number, size: number): Grade {
  if (checks >= 3) return 'guided';
  if (checks > 0) return 'checked';
  const grace = graceSeconds(size);
  if (seconds <= grace) return 'swift';
  if (seconds <= grace * 2) return 'steady';
  return 'patient';
}

export function makeResult(puzzle: Puzzle, seconds: number, checks: number, mistakes: number): Result {
  return {
    puzzle,
    seconds,
    checks,
    mistakes,
    points: scoreRun(seconds, checks, mistakes, puzzle.size),
    grade: gradeFor(seconds, checks, puzzle.size),
  };
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function checkLabel(count: number) {
  return count === 1 ? '1 check' : `${count} checks`;
}

export function mistakeLabel(count: number) {
  return count === 1 ? '1 mistake' : `${count} mistakes`;
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Tessera #${puzzleNumberForDate(date)}` : 'Tessera · practice';
  return [
    title,
    `${result.puzzle.size}×${result.puzzle.size} · ${formatTime(result.seconds)} · ${checkLabel(result.checks)}`,
    `${result.points}/${MAX_SCORE}`,
  ];
}

export { SPECS };

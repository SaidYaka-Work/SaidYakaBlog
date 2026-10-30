import type { BridgeCount, Bridges, EdgeKey, Grade, Island, Mode, Pair, Puzzle, Result } from './types';

export const MAX_SCORE = 100;
export const TIME_STEP_SECONDS = 30;
export const TIME_STEP_COST = 2;
export const MOVE_COST = 1;
export const MIN_SOLVED_SCORE = 20;
export const LAUNCH_DATE = '2026-10-30';
export const ROTATION_SEED = 0x51471d;

const GRADE_LABEL: Record<Grade, string> = {
  swift: 'Swift',
  steady: 'Steady',
  patient: 'Patient',
};

const dailyCache = new Map<string, Puzzle>();

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ ROTATION_SEED) >>> 0;
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

export function edgeKey(a: number, b: number): EdgeKey {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function parseEdgeKey(key: EdgeKey): [number, number] {
  const [a, b] = key.split('-').map(Number);
  return [a, b];
}

export function emptyBridges(): Bridges {
  return {};
}

export function bridgeCount(bridges: Bridges, a: number, b: number): BridgeCount {
  return bridges[edgeKey(a, b)] ?? 0;
}

export function setBridge(bridges: Bridges, a: number, b: number, count: BridgeCount): Bridges {
  const key = edgeKey(a, b);
  if (count === 0) {
    if (!(key in bridges)) return bridges;
    const next = { ...bridges };
    delete next[key];
    return next;
  }
  if (bridges[key] === count) return bridges;
  return { ...bridges, [key]: count };
}

export function cycleBridge(bridges: Bridges, a: number, b: number): Bridges {
  const current = bridgeCount(bridges, a, b);
  const next = ((current + 1) % 3) as BridgeCount;
  return setBridge(bridges, a, b, next);
}

function betweenClear(
  islands: readonly Island[],
  a: Pick<Island, 'row' | 'col'>,
  b: Pick<Island, 'row' | 'col'>,
): boolean {
  if (a.row === b.row) {
    const min = Math.min(a.col, b.col);
    const max = Math.max(a.col, b.col);
    if (max - min < 2) return true;
    return islands.every((island) => island.row !== a.row || island.col <= min || island.col >= max);
  }
  if (a.col === b.col) {
    const min = Math.min(a.row, b.row);
    const max = Math.max(a.row, b.row);
    if (max - min < 2) return true;
    return islands.every((island) => island.col !== a.col || island.row <= min || island.row >= max);
  }
  return false;
}

export function aligned(a: Pick<Island, 'row' | 'col'>, b: Pick<Island, 'row' | 'col'>): boolean {
  return a.row === b.row || a.col === b.col;
}

export function canConnect(islands: readonly Island[], a: number, b: number): boolean {
  if (a === b) return false;
  const left = islands[a];
  const right = islands[b];
  if (!left || !right) return false;
  if (!aligned(left, right)) return false;
  return betweenClear(islands, left, right);
}

export function possiblePairs(islands: readonly Island[]): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < islands.length; i += 1) {
    for (let j = i + 1; j < islands.length; j += 1) {
      if (canConnect(islands, i, j)) pairs.push([i, j]);
    }
  }
  return pairs;
}

export function pairIndex(pairs: readonly Pair[], a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return pairs.findIndex(([left, right]) => left === lo && right === hi);
}

export function segmentsCross(
  islands: readonly Island[],
  a: number,
  b: number,
  c: number,
  d: number,
): boolean {
  if (a === c || a === d || b === c || b === d) return false;
  const first = [islands[a], islands[b]];
  const second = [islands[c], islands[d]];
  const horizontal = first[0].row === first[1].row ? first : second[0].row === second[1].row ? second : null;
  const vertical = first[0].col === first[1].col ? first : second[0].col === second[1].col ? second : null;
  if (!horizontal || !vertical) return false;
  if (horizontal === vertical) return false;
  const row = horizontal[0].row;
  const col = vertical[0].col;
  const colMin = Math.min(horizontal[0].col, horizontal[1].col);
  const colMax = Math.max(horizontal[0].col, horizontal[1].col);
  const rowMin = Math.min(vertical[0].row, vertical[1].row);
  const rowMax = Math.max(vertical[0].row, vertical[1].row);
  return rowMin < row && row < rowMax && colMin < col && col < colMax;
}

export function wouldCross(
  islands: readonly Island[],
  pairs: readonly Pair[],
  bridges: Bridges,
  a: number,
  b: number,
): boolean {
  for (const [c, d] of pairs) {
    if (bridgeCount(bridges, c, d) === 0) continue;
    if (segmentsCross(islands, a, b, c, d)) return true;
  }
  return false;
}

export function nextLegalCount(
  puzzle: Puzzle,
  bridges: Bridges,
  a: number,
  b: number,
): BridgeCount | null {
  if (!canConnect(puzzle.islands, a, b)) return null;
  const current = bridgeCount(bridges, a, b);
  const next = ((current + 1) % 3) as BridgeCount;
  if (next > 0 && current === 0 && wouldCross(puzzle.islands, puzzle.pairs, bridges, a, b)) {
    return null;
  }
  return next;
}

export function degreeOf(islandId: number, bridges: Bridges, pairs: readonly Pair[]): number {
  let total = 0;
  for (const [a, b] of pairs) {
    if (a === islandId || b === islandId) total += bridgeCount(bridges, a, b);
  }
  return total;
}

export function islandState(
  island: Island,
  bridges: Bridges,
  pairs: readonly Pair[],
): 'under' | 'met' | 'over' {
  const have = degreeOf(island.id, bridges, pairs);
  if (have === island.need) return 'met';
  if (have > island.need) return 'over';
  return 'under';
}

function connected(islands: readonly Island[], bridges: Bridges, pairs: readonly Pair[]): boolean {
  if (islands.length <= 1) return true;
  const parent = islands.map((_, index) => index);
  const find = (node: number): number => {
    if (parent[node] !== node) parent[node] = find(parent[node]);
    return parent[node];
  };
  const unite = (x: number, y: number) => {
    const px = find(x);
    const py = find(y);
    if (px !== py) parent[px] = py;
  };
  for (const [a, b] of pairs) {
    if (bridgeCount(bridges, a, b) > 0) unite(a, b);
  }
  const root = find(0);
  return islands.every((_, index) => find(index) === root);
}

export function isSolved(puzzle: Puzzle, bridges: Bridges): boolean {
  if (!puzzle.islands.every((island) => degreeOf(island.id, bridges, puzzle.pairs) === island.need)) {
    return false;
  }
  if (!connected(puzzle.islands, bridges, puzzle.pairs)) return false;
  for (let i = 0; i < puzzle.pairs.length; i += 1) {
    const [a, b] = puzzle.pairs[i];
    if (bridgeCount(bridges, a, b) === 0) continue;
    for (let j = i + 1; j < puzzle.pairs.length; j += 1) {
      const [c, d] = puzzle.pairs[j];
      if (bridgeCount(bridges, c, d) === 0) continue;
      if (segmentsCross(puzzle.islands, a, b, c, d)) return false;
    }
  }
  return true;
}

export function solutionBridges(puzzle: Puzzle): Bridges {
  const next: Bridges = {};
  for (const [key, count] of Object.entries(puzzle.solution)) {
    next[key] = count;
  }
  return next;
}

type SolverHit = {
  count: number;
  first?: Bridges;
};

function possibleGraphConnected(
  islandCount: number,
  pairs: readonly Pair[],
  values: readonly (BridgeCount | null)[],
): boolean {
  const parent = Array.from({ length: islandCount }, (_, index) => index);
  const find = (node: number): number => {
    if (parent[node] !== node) parent[node] = find(parent[node]);
    return parent[node];
  };
  const unite = (x: number, y: number) => {
    const px = find(x);
    const py = find(y);
    if (px !== py) parent[px] = py;
  };
  for (let i = 0; i < pairs.length; i += 1) {
    if (values[i] === 0) continue;
    unite(pairs[i][0], pairs[i][1]);
  }
  const root = find(0);
  for (let i = 1; i < islandCount; i += 1) {
    if (find(i) !== root) return false;
  }
  return true;
}

function buildCrosses(islands: readonly Island[], pairs: readonly Pair[]): number[][] {
  return pairs.map((pair, i) => {
    const hits: number[] = [];
    for (let j = 0; j < pairs.length; j += 1) {
      if (i === j) continue;
      if (segmentsCross(islands, pair[0], pair[1], pairs[j][0], pairs[j][1])) hits.push(j);
    }
    return hits;
  });
}

function buildIncidents(islandCount: number, pairs: readonly Pair[]): number[][] {
  const incidents = Array.from({ length: islandCount }, () => [] as number[]);
  pairs.forEach((pair, index) => {
    incidents[pair[0]].push(index);
    incidents[pair[1]].push(index);
  });
  return incidents;
}

/**
 * Count solutions up to `limit` with constraint propagation + backtracking.
 * Hashi at this size (6–14 islands) is tiny; uniqueness is cheap to prove.
 */
export function countSolutions(puzzle: Puzzle, limit = 2): SolverHit {
  const { islands, pairs } = puzzle;
  const needs = islands.map((island) => island.need);
  const crosses = buildCrosses(islands, pairs);
  const incidents = buildIncidents(islands.length, pairs);
  const values: (BridgeCount | null)[] = Array.from({ length: pairs.length }, () => null);
  const hit: SolverHit = { count: 0 };

  const propagate = (): boolean => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < values.length; i += 1) {
        if ((values[i] ?? 0) === 0) continue;
        if ((values[i] ?? 0) < 1) continue;
        for (const other of crosses[i]) {
          if (values[other] === null) {
            values[other] = 0;
            changed = true;
          } else if (values[other] > 0) {
            return false;
          }
        }
      }

      for (let island = 0; island < islands.length; island += 1) {
        let sum = 0;
        let maxRemain = 0;
        const unknown: number[] = [];
        for (const edge of incidents[island]) {
          const value = values[edge];
          if (value === null) {
            unknown.push(edge);
            maxRemain += 2;
          } else {
            sum += value;
          }
        }
        const need = needs[island];
        if (sum > need || sum + maxRemain < need) return false;
        if (unknown.length === 0) continue;
        if (sum + maxRemain === need) {
          for (const edge of unknown) {
            if (values[edge] !== 2) {
              values[edge] = 2;
              changed = true;
            }
          }
        } else if (sum === need) {
          for (const edge of unknown) {
            if (values[edge] !== 0) {
              values[edge] = 0;
              changed = true;
            }
          }
        } else if (unknown.length === 1) {
          const rest = (need - sum) as number;
          if (rest < 0 || rest > 2) return false;
          if (values[unknown[0]] !== rest) {
            values[unknown[0]] = rest as BridgeCount;
            changed = true;
          }
        }
      }

      if (!possibleGraphConnected(islands.length, pairs, values)) return false;
    }
    return true;
  };

  const snapshot = () => values.slice();
  const restore = (saved: (BridgeCount | null)[]) => {
    for (let i = 0; i < values.length; i += 1) values[i] = saved[i];
  };

  const pick = (): number => {
    let best = -1;
    let bestUnknown = 99;
    let bestNeed = -1;
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] !== null) continue;
      const leftover = Math.max(
        needs[pairs[i][0]] - incidents[pairs[i][0]].reduce((sum, edge) => sum + (values[edge] ?? 0), 0),
        needs[pairs[i][1]] - incidents[pairs[i][1]].reduce((sum, edge) => sum + (values[edge] ?? 0), 0),
      );
      const unknownNear = incidents[pairs[i][0]].filter((edge) => values[edge] === null).length
        + incidents[pairs[i][1]].filter((edge) => values[edge] === null).length;
      if (best === -1 || unknownNear < bestUnknown || (unknownNear === bestUnknown && leftover > bestNeed)) {
        best = i;
        bestUnknown = unknownNear;
        bestNeed = leftover;
      }
    }
    return best;
  };

  const search = () => {
    if (hit.count >= limit) return;
    const saved = snapshot();
    if (!propagate()) {
      restore(saved);
      return;
    }
    const edge = pick();
    if (edge === -1) {
      const bridges: Bridges = {};
      for (let i = 0; i < pairs.length; i += 1) {
        const value = values[i] ?? 0;
        if (value > 0) bridges[edgeKey(pairs[i][0], pairs[i][1])] = value;
      }
      if (isSolved(puzzle, bridges)) {
        hit.count += 1;
        if (!hit.first) hit.first = bridges;
      }
      restore(saved);
      return;
    }

    for (const value of [2, 1, 0] as const) {
      if (hit.count >= limit) break;
      const before = snapshot();
      values[edge] = value;
      search();
      restore(before);
    }
    restore(saved);
  };

  search();
  return hit;
}

export function solve(puzzle: Puzzle): Bridges | null {
  if (puzzle.solution && Object.keys(puzzle.solution).length) {
    const hinted = solutionBridges(puzzle);
    if (isSolved(puzzle, hinted)) return hinted;
  }
  return countSolutions(puzzle, 1).first ?? null;
}

function hasSight(
  placed: readonly Pick<Island, 'row' | 'col'>[],
  row: number,
  col: number,
  other: Pick<Island, 'row' | 'col'>,
): boolean {
  return betweenClear(placed as Island[], { row, col }, other) && aligned({ row, col }, other);
}

function extraSight(
  placed: readonly Pick<Island, 'row' | 'col'>[],
  row: number,
  col: number,
  parentIndex: number,
): boolean {
  return placed.some((island, index) => index !== parentIndex && hasSight(placed, row, col, island));
}

const DIRS = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;

type GrowSpec = {
  size: number;
  islands: number;
};

function tryGrowTree(random: () => number, spec: GrowSpec): { islands: Island[]; edges: Pair[]; doubles: Set<string> } | null {
  const { size, islands: target } = spec;
  const firstRow = Math.floor(random() * size);
  const firstCol = Math.floor(random() * size);
  const placed: { row: number; col: number }[] = [{ row: firstRow, col: firstCol }];
  const edges: Pair[] = [];

  let guard = 0;
  while (placed.length < target && guard < target * 40) {
    guard += 1;
    const parent = Math.floor(random() * placed.length);
    const dirs = shuffle(DIRS, random);
    const steps = random() < 0.35 ? [2, 3, 2] : [2, 2, 3];
    let added = false;
    for (const [dr, dc] of dirs) {
      for (const step of steps) {
        const row = placed[parent].row + dr * step;
        const col = placed[parent].col + dc * step;
        if (row < 0 || col < 0 || row >= size || col >= size) continue;
        if (placed.some((island) => island.row === row && island.col === col)) continue;
        if (!hasSight(placed, row, col, placed[parent])) continue;
        if (extraSight(placed, row, col, parent)) continue;
        const child = placed.length;
        placed.push({ row, col });
        edges.push([parent, child]);
        added = true;
        break;
      }
      if (added) break;
    }
  }

  if (placed.length < target) return null;
  if (edges.length !== placed.length - 1) return null;

  const doubles = new Set<string>();
  for (const [a, b] of edges) {
    if (random() < 0.42) doubles.add(edgeKey(a, b));
  }

  const degree = Array.from({ length: placed.length }, () => 0);
  for (const [a, b] of edges) {
    const weight = doubles.has(edgeKey(a, b)) ? 2 : 1;
    degree[a] += weight;
    degree[b] += weight;
  }
  if (degree.some((need) => need < 1 || need > 8)) return null;

  const islands: Island[] = placed.map((spot, id) => ({
    id,
    row: spot.row,
    col: spot.col,
    need: degree[id],
  }));

  return { islands, edges, doubles };
}

function staircase(random: () => number, spec: GrowSpec): { islands: Island[]; edges: Pair[]; doubles: Set<string> } {
  const { size, islands: target } = spec;
  const startRow = random() < 0.5 ? 0 : size % 2 === 0 ? 1 : 0;
  const startCol = random() < 0.5 ? 0 : size % 2 === 0 ? 1 : 0;
  const placed: { row: number; col: number }[] = [{ row: startRow, col: startCol }];
  const edges: Pair[] = [];
  let horizontal = random() < 0.5;
  let rowDir = 1;
  let colDir = 1;

  while (placed.length < target) {
    const last = placed[placed.length - 1];
    let next: { row: number; col: number } | null = null;
    if (horizontal) {
      const col = last.col + 2 * colDir;
      if (col >= 0 && col < size && !placed.some((spot) => spot.row === last.row && spot.col === col)) {
        next = { row: last.row, col };
      } else {
        colDir *= -1;
        const row = last.row + 2 * rowDir;
        if (row >= 0 && row < size && !placed.some((spot) => spot.row === row && spot.col === last.col)) {
          next = { row, col: last.col };
        }
      }
    } else {
      const row = last.row + 2 * rowDir;
      if (row >= 0 && row < size && !placed.some((spot) => spot.row === row && spot.col === last.col)) {
        next = { row, col: last.col };
      } else {
        rowDir *= -1;
        const col = last.col + 2 * colDir;
        if (col >= 0 && col < size && !placed.some((spot) => spot.row === last.row && spot.col === col)) {
          next = { row: last.row, col };
        }
      }
    }

    if (!next) {
      const fallback = placed.find((spot, index) => {
        void index;
        for (const [dr, dc] of DIRS) {
          const row = spot.row + dr * 2;
          const col = spot.col + dc * 2;
          if (row < 0 || col < 0 || row >= size || col >= size) continue;
          if (placed.some((other) => other.row === row && other.col === col)) continue;
          next = { row, col };
          return true;
        }
        return false;
      });
      if (!fallback || !next) break;
      const parent = placed.findIndex((spot) => spot.row === fallback.row && spot.col === fallback.col);
      placed.push(next);
      edges.push([parent, placed.length - 1]);
      horizontal = !horizontal;
      continue;
    }

    placed.push(next);
    edges.push([placed.length - 2, placed.length - 1]);
    horizontal = !horizontal;
  }

  const doubles = new Set<string>();
  for (const [a, b] of edges) {
    if (random() < 0.38) doubles.add(edgeKey(a, b));
  }

  const degree = Array.from({ length: placed.length }, () => 0);
  for (const [a, b] of edges) {
    const weight = doubles.has(edgeKey(a, b)) ? 2 : 1;
    degree[a] += weight;
    degree[b] += weight;
  }

  const islands: Island[] = placed.map((spot, id) => ({
    id,
    row: spot.row,
    col: spot.col,
    need: degree[id],
  }));

  return { islands, edges, doubles };
}

function packPuzzle(
  id: string,
  size: number,
  grown: { islands: Island[]; edges: Pair[]; doubles: Set<string> },
): Puzzle | null {
  const pairs = possiblePairs(grown.islands);
  if (pairs.length < grown.edges.length) return null;
  const solution: Record<EdgeKey, 1 | 2> = {};
  for (const [a, b] of grown.edges) {
    if (!canConnect(grown.islands, a, b)) return null;
    solution[edgeKey(a, b)] = grown.doubles.has(edgeKey(a, b)) ? 2 : 1;
  }
  const puzzle: Puzzle = {
    id,
    size,
    islands: grown.islands,
    pairs,
    solution,
  };
  if (!isSolved(puzzle, solutionBridges(puzzle))) return null;
  const found = countSolutions(puzzle, 2);
  if (found.count !== 1) return null;
  return puzzle;
}

export type GenerateOptions = {
  size: number;
  islands: number;
  id: string;
};

export function generatePuzzle(seed: number, options: GenerateOptions): Puzzle {
  const random = mulberry32(seed);
  const spec = { size: options.size, islands: options.islands };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const grown = tryGrowTree(random, spec);
    if (!grown) continue;
    const packed = packPuzzle(options.id, options.size, grown);
    if (packed) return packed;
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const grown = staircase(random, spec);
    if (grown.islands.length < 4) continue;
    const packed = packPuzzle(options.id, options.size, grown);
    if (packed) return packed;
  }

  const fallback = staircase(() => 0.31, { size: Math.max(6, options.size), islands: Math.min(7, options.islands) });
  const packed = packPuzzle(options.id, Math.max(6, options.size), fallback);
  if (packed) return packed;
  return HOWTO_PUZZLE;
}

export function difficultyForDate(date: string): { size: number; islands: number } {
  const weekend = isWeekend(date);
  const random = mulberry32(dateSeed(date) ^ 0x2f);
  if (weekend) {
    return {
      size: 8,
      islands: 12 + Math.floor(random() * 3),
    };
  }
  return {
    size: 7,
    islands: 8 + Math.floor(random() * 3),
  };
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  const cached = dailyCache.get(date);
  if (cached) return cached;
  const difficulty = difficultyForDate(date);
  const puzzle = generatePuzzle(dateSeed(date), {
    ...difficulty,
    id: `span-${date}`,
  });
  dailyCache.set(date, puzzle);
  return puzzle;
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000)): Puzzle {
  const random = mulberry32(seed >>> 0);
  const weekend = random() < 0.28;
  const size = weekend ? 8 : 6 + Math.floor(random() * 2);
  const islands = weekend ? 11 + Math.floor(random() * 4) : 7 + Math.floor(random() * 4);
  return generatePuzzle(seed >>> 0, {
    size,
    islands,
    id: `span-practice-${seed >>> 0}`,
  });
}

export function graceSeconds(islandCount: number): number {
  return Math.max(90, islandCount * 14);
}

export function moveGrace(puzzle: Puzzle): number {
  const needed = Object.values(puzzle.solution).reduce((sum, count) => sum + count, 0);
  return needed + 4;
}

export function scoreRun(seconds: number, moves: number, puzzle: Puzzle): number {
  let points = MAX_SCORE;
  const grace = graceSeconds(puzzle.islands.length);
  if (seconds > grace) {
    points -= Math.floor((seconds - grace) / TIME_STEP_SECONDS) * TIME_STEP_COST;
  }
  const allowed = moveGrace(puzzle);
  if (moves > allowed) points -= (moves - allowed) * MOVE_COST;
  return Math.max(MIN_SOLVED_SCORE, points);
}

export function gradeFor(seconds: number, puzzle: Puzzle): Grade {
  const grace = graceSeconds(puzzle.islands.length);
  if (seconds <= grace) return 'swift';
  if (seconds <= grace * 2) return 'steady';
  return 'patient';
}

export function makeResult(puzzle: Puzzle, seconds: number, moves: number): Result {
  return {
    puzzle,
    seconds,
    moves,
    points: scoreRun(seconds, moves, puzzle),
    grade: gradeFor(seconds, puzzle),
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

export function moveLabel(count: number) {
  return count === 1 ? '1 move' : `${count} moves`;
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Span #${puzzleNumberForDate(date)}` : 'Span · practice';
  return [
    title,
    `${result.puzzle.size}×${result.puzzle.size} · ${result.puzzle.islands.length} islands · ${formatTime(result.seconds)} · ${moveLabel(result.moves)}`,
    `${result.points}/${MAX_SCORE}`,
  ];
}

/** Tiny unique 2×2 used as the in-game how-to. */
export const HOWTO_PUZZLE: Puzzle = {
  id: 'span-how-to',
  size: 3,
  islands: [
    { id: 0, row: 0, col: 0, need: 3 },
    { id: 1, row: 0, col: 2, need: 3 },
    { id: 2, row: 2, col: 0, need: 1 },
    { id: 3, row: 2, col: 2, need: 1 },
  ],
  pairs: [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
  ],
  solution: {
    '0-1': 2,
    '0-2': 1,
    '1-3': 1,
  },
};

export function neighborsOf(puzzle: Puzzle, islandId: number): number[] {
  return puzzle.pairs
    .filter(([a, b]) => a === islandId || b === islandId)
    .map(([a, b]) => (a === islandId ? b : a));
}

export function nearestIsland(
  puzzle: Puzzle,
  fromId: number,
  dRow: number,
  dCol: number,
): number | null {
  const from = puzzle.islands[fromId];
  if (!from) return null;
  let alignedId: number | null = null;
  let alignedDist = Infinity;
  let anyId: number | null = null;
  let anyDist = Infinity;
  for (const island of puzzle.islands) {
    if (island.id === fromId) continue;
    const dr = island.row - from.row;
    const dc = island.col - from.col;
    if (dRow !== 0 && Math.sign(dr) !== dRow) continue;
    if (dCol !== 0 && Math.sign(dc) !== dCol) continue;
    const dist = Math.abs(dr) + Math.abs(dc);
    if (dist === 0) continue;
    if (dist < anyDist) {
      anyId = island.id;
      anyDist = dist;
    }
    const axisAligned = dRow === 0 ? dr === 0 : dc === 0;
    if (axisAligned && dist < alignedDist) {
      alignedId = island.id;
      alignedDist = dist;
    }
  }
  return alignedId ?? anyId;
}

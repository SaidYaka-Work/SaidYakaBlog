import type { Goal, Grade, Held, LessonStep, Mode, Move, Puzzle, Result } from './types';

export const MAX_SCORE = 100;
export const MIN_SOLVED_SCORE = 20;
export const EXTRA_POUR_COST = 12;
export const LAUNCH_DATE = '2026-11-02';
export const ROTATION_SEED = 0xdec2a71;

const TWO_CAPS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16] as const;
const TRIPLES: readonly (readonly [number, number, number])[] = [
  [8, 5, 3],
  [12, 8, 5],
  [12, 7, 5],
  [10, 7, 3],
  [9, 6, 4],
  [16, 9, 7],
  [12, 9, 5],
  [15, 9, 6],
  [10, 6, 4],
  [14, 9, 5],
  [11, 7, 3],
  [13, 8, 5],
  [15, 10, 6],
  [12, 8, 3],
  [16, 10, 6],
  [18, 11, 7],
  [14, 8, 5],
  [15, 8, 3],
  [16, 11, 7],
  [20, 13, 7],
];

const GRADE_LABEL: Record<Grade, string> = {
  par: 'On par',
  close: 'Close',
  steady: 'Steady',
  patient: 'Patient',
};

const GRADE_EMOJI: Record<Grade, string> = {
  par: '🎯',
  close: '✨',
  steady: '🟢',
  patient: '🟠',
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

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const rest = x % y;
    x = y;
    y = rest;
  }
  return x;
}

export function gcdAll(values: readonly number[]): number {
  return values.reduce((acc, value) => gcd(acc, value), 0);
}

export function extendedGcd(a: number, b: number): { g: number; x: number; y: number } {
  if (b === 0) return { g: Math.abs(a), x: a >= 0 ? 1 : -1, y: 0 };
  const next = extendedGcd(b, a % b);
  return { g: next.g, x: next.y, y: next.x - Math.floor(a / b) * next.y };
}

export function bezoutFor(a: number, b: number, target: number): { x: number; y: number; g: number } | null {
  const { g, x, y } = extendedGcd(a, b);
  if (target % g !== 0) return null;
  const scale = target / g;
  const x0 = x * scale;
  const y0 = y * scale;
  const stepX = b / g;
  const stepY = a / g;
  let best = { x: x0, y: y0, score: Math.abs(x0) + Math.abs(y0) };
  for (let k = -40; k <= 40; k += 1) {
    const xx = x0 + k * stepX;
    const yy = y0 - k * stepY;
    const score = Math.abs(xx) + Math.abs(yy);
    if (score < best.score || (score === best.score && Math.abs(xx) + Math.abs(yy) < Math.abs(best.x) + Math.abs(best.y))) {
      best = { x: xx, y: yy, score };
    }
  }
  return { x: best.x, y: best.y, g };
}

export function euclidSteps(a: number, b: number): { a: number; b: number; q: number; r: number }[] {
  const steps: { a: number; b: number; q: number; r: number }[] = [];
  let x = Math.abs(a);
  let y = Math.abs(b);
  if (y > x) [x, y] = [y, x];
  while (y !== 0) {
    const q = Math.floor(x / y);
    const r = x % y;
    steps.push({ a: x, b: y, q, r });
    x = y;
    y = r;
  }
  return steps;
}

export function keyOf(state: readonly number[]): string {
  return state.join(',');
}

export function emptyState(caps: readonly number[]): number[] {
  return caps.map(() => 0);
}

export function neighbors(caps: readonly number[], state: readonly number[]): { move: Move; next: number[] }[] {
  const out: { move: Move; next: number[] }[] = [];
  const n = caps.length;
  for (let i = 0; i < n; i += 1) {
    if (state[i] < caps[i]) {
      const next = state.slice();
      next[i] = caps[i];
      out.push({ move: { kind: 'fill', jug: i }, next });
    }
    if (state[i] > 0) {
      const next = state.slice();
      next[i] = 0;
      out.push({ move: { kind: 'empty', jug: i }, next });
    }
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const room = caps[j] - state[j];
      if (state[i] === 0 || room === 0) continue;
      const amount = Math.min(state[i], room);
      const next = state.slice();
      next[i] -= amount;
      next[j] += amount;
      out.push({ move: { kind: 'pour', from: i, to: j }, next });
    }
  }
  return out;
}

export function blockedReason(caps: readonly number[], state: readonly number[], move: Move): string | null {
  if (move.kind === 'fill') {
    return state[move.jug] === caps[move.jug] ? 'That jug is already full.' : null;
  }
  if (move.kind === 'empty') {
    return state[move.jug] === 0 ? 'That jug is already empty.' : null;
  }
  if (state[move.from] === 0) return 'Nothing left to pour.';
  if (state[move.to] === caps[move.to]) return 'That jug is already full.';
  return null;
}

export function applyMove(caps: readonly number[], state: readonly number[], move: Move): number[] | null {
  const next = state.slice();
  if (move.kind === 'fill') {
    if (next[move.jug] === caps[move.jug]) return null;
    next[move.jug] = caps[move.jug];
    return next;
  }
  if (move.kind === 'empty') {
    if (next[move.jug] === 0) return null;
    next[move.jug] = 0;
    return next;
  }
  const room = caps[move.to] - next[move.to];
  if (next[move.from] === 0 || room === 0) return null;
  const amount = Math.min(next[move.from], room);
  next[move.from] -= amount;
  next[move.to] += amount;
  return next;
}

export function applyMoves(caps: readonly number[], start: readonly number[], moves: readonly Move[]): number[] | null {
  let state = start.slice();
  for (const move of moves) {
    const next = applyMove(caps, state, move);
    if (!next) return null;
    state = next;
  }
  return state;
}

export function meetsGoal(state: readonly number[], goal: Goal): boolean {
  if (goal.kind === 'any') return state.some((value) => value === goal.amount);
  return goal.amounts.every((amount, index) => amount === null || state[index] === amount);
}

export function solve(
  caps: readonly number[],
  start: readonly number[],
  goal: Goal,
): { moves: Move[]; end: number[] } | null {
  const startKey = keyOf(start);
  const seen = new Map<string, { move: Move | null; prev: string | null }>();
  seen.set(startKey, { move: null, prev: null });
  const queue = [start.slice()];

  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index];
    if (meetsGoal(state, goal)) {
      const moves: Move[] = [];
      let key = keyOf(state);
      while (true) {
        const rec = seen.get(key);
        if (!rec || rec.prev === null) break;
        moves.push(rec.move as Move);
        key = rec.prev;
      }
      moves.reverse();
      return { moves, end: state };
    }
    for (const { move, next } of neighbors(caps, state)) {
      const nextKey = keyOf(next);
      if (seen.has(nextKey)) continue;
      seen.set(nextKey, { move, prev: keyOf(state) });
      queue.push(next);
    }
  }
  return null;
}

type ReachRecord = { state: number[]; dist: number; move: Move | null; prev: string | null };

export function explore(caps: readonly number[], start: readonly number[]): Map<string, ReachRecord> {
  const seen = new Map<string, ReachRecord>();
  const startKey = keyOf(start);
  seen.set(startKey, { state: start.slice(), dist: 0, move: null, prev: null });
  const queue = [start.slice()];
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index];
    const rec = seen.get(keyOf(state));
    if (!rec) continue;
    for (const { move, next } of neighbors(caps, state)) {
      const nextKey = keyOf(next);
      if (seen.has(nextKey)) continue;
      seen.set(nextKey, { state: next, dist: rec.dist + 1, move, prev: keyOf(state) });
      queue.push(next);
    }
  }
  return seen;
}

export function reconstruct(seen: Map<string, ReachRecord>, endKey: string): Move[] {
  const moves: Move[] = [];
  let key = endKey;
  while (true) {
    const rec = seen.get(key);
    if (!rec || rec.prev === null) break;
    moves.push(rec.move as Move);
    key = rec.prev;
  }
  moves.reverse();
  return moves;
}

export function jugName(cap: number): string {
  return `${cap} L jug`;
}

export function describeMove(caps: readonly number[], state: readonly number[], move: Move): string {
  if (move.kind === 'fill') return `Fill the ${jugName(caps[move.jug])}`;
  if (move.kind === 'empty') return `Empty the ${jugName(caps[move.jug])}`;
  const room = caps[move.to] - state[move.to];
  const amount = Math.min(state[move.from], room);
  return `Pour ${amount} L from the ${jugName(caps[move.from])} into the ${jugName(caps[move.to])}`;
}

export function describePath(caps: readonly number[], start: readonly number[], moves: readonly Move[]): string[] {
  const lines: string[] = [];
  let state = start.slice();
  for (const move of moves) {
    lines.push(describeMove(caps, state, move));
    const next = applyMove(caps, state, move);
    if (!next) break;
    state = next;
  }
  return lines;
}

export function goalPrompt(caps: readonly number[], goal: Goal): string {
  if (goal.kind === 'any') return `Measure exactly ${goal.amount} L.`;
  const parts = goal.amounts
    .map((amount, index) => (amount === null ? null : `${amount} L in the ${jugName(caps[index])}`))
    .filter((part): part is string => Boolean(part));
  if (parts.length === 1) return `Leave ${parts[0]}.`;
  if (parts.length === 2) return `Leave ${parts[0]} and ${parts[1]}.`;
  return `Leave ${parts.join(', ')}.`;
}

export function shortGoal(caps: readonly number[], goal: Goal): string {
  if (goal.kind === 'any') return `${caps.join(' · ')} → ${goal.amount} L`;
  const bits = goal.amounts
    .map((amount, index) => (amount === null ? null : `${caps[index]}:${amount}`))
    .filter((part): part is string => Boolean(part));
  return `${caps.join(' · ')} → ${bits.join(' · ')}`;
}

function measurableLine(caps: readonly number[], goal: Goal): string {
  const g = gcdAll(caps);
  if (goal.kind === 'any') {
    if (caps.length === 2) {
      return `Jugs of ${caps[0]} L and ${caps[1]} L can measure any multiple of ${g} L that fits in the larger jug. ${goal.amount} is on that list.`;
    }
    return `With jugs of ${caps.join(', ')} L you can still only make multiples of ${g} L, their overall gcd. ${goal.amount} is one of those.`;
  }
  const named = goal.amounts
    .map((amount, index) => (amount === null ? null : `${amount} L in the ${caps[index]} L`))
    .filter((part): part is string => Boolean(part));
  return `Three jugs still only make multiples of gcd(${caps.join(', ')}) = ${g}. The extra jug is a workspace, so you can leave ${named.join(' and ')}.`;
}

function euclidLine(a: number, b: number): string {
  const steps = euclidSteps(a, b);
  if (!steps.length) return `${a} and ${b} already share a remainder of ${gcd(a, b)}.`;
  const chain = steps
    .map((step) => `${step.a} = ${step.q}×${step.b} + ${step.r}`)
    .join('; then ');
  const last = steps[steps.length - 1];
  const g = last.r === 0 ? last.b : gcd(a, b);
  return `${chain}. The last nonzero remainder is ${g} — Euclid’s gcd.`;
}

function bezoutLine(a: number, b: number, target: number): string {
  const found = bezoutFor(a, b, target);
  if (!found) return `${target} is not a combination of ${a} and ${b}.`;
  const left = `${found.x === 0 ? '' : `${signed(found.x)}×${a}`}${found.y === 0 ? '' : ` ${signed(found.y)}×${b}`}`.trim();
  const fills = found.x > 0 ? `${found.x} fill${found.x === 1 ? '' : 's'} of the ${a} L` : `${Math.abs(found.x)} empty${Math.abs(found.x) === 1 ? '' : 'ings'} of the ${a} L`;
  const other =
    found.y > 0
      ? `${found.y} fill${found.y === 1 ? '' : 's'} of the ${b} L`
      : `${Math.abs(found.y)} empty${Math.abs(found.y) === 1 ? '' : 'ings'} of the ${b} L`;
  return `Bézout’s identity says ${target} = ${left || '0'}. In the jugs that is a net ${fills} and ${other} — each fill adds a capacity, each empty subtracts one. The pours are just how those credits move.`;
}

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export function lessonFor(caps: readonly number[], start: readonly number[], goal: Goal, solution: readonly Move[]): LessonStep[] {
  const g = gcdAll(caps);
  const steps: LessonStep[] = [
    {
      title: 'What you can measure',
      text: measurableLine(caps, goal),
    },
  ];

  if (caps.length === 2) {
    const target = goal.kind === 'any' ? goal.amount : goal.amounts.find((amount): amount is number => amount !== null) ?? g;
    steps.push({
      title: 'Euclid’s remainders',
      text: euclidLine(caps[0], caps[1]),
    });
    steps.push({
      title: 'The same arithmetic, poured',
      text: bezoutLine(caps[0], caps[1], target),
    });
  } else {
    steps.push({
      title: 'Why a third jug helps',
      text: `gcd(${caps.join(', ')}) is still ${g}. The extra jug does not create new measurable amounts — it holds a remainder so you can empty or refill without losing the piece you already measured.`,
    });
    steps.push({
      title: 'Euclid still runs the show',
      text: euclidLine(caps[0], caps[1]),
    });
  }

  const path = describePath(caps, start, solution);
  steps.push({
    title: `A shortest way · ${solution.length} ${solution.length === 1 ? 'pour' : 'pours'}`,
    text: path.length ? path.map((line, index) => `${index + 1}. ${line}`).join(' ') : 'Already measured.',
  });

  return steps;
}

function blurbFor(caps: readonly number[], goal: Goal, optimal: number): string {
  const g = gcdAll(caps);
  if (caps.length === 2 && goal.kind === 'any') {
    return `Jugs of ${caps[0]} L and ${caps[1]} L can measure any whole number of liters that is a multiple of ${g}, their greatest common divisor. ${goal.amount} is on that list; the shortest dance takes ${optimal} pours.`;
  }
  return `You can still only make multiples of ${g} L. The extra jug is a workspace. A shortest measuring dance takes ${optimal} pours.`;
}

function buildPuzzle(
  id: string,
  caps: readonly number[],
  start: readonly number[],
  goal: Goal,
  solved: { moves: Move[]; end: number[] },
): Puzzle {
  return {
    id,
    capacities: caps,
    start,
    goal,
    optimal: solved.moves.length,
    solution: solved.moves,
    prompt: goalPrompt(caps, goal),
    blurb: blurbFor(caps, goal, solved.moves.length),
    lesson: lessonFor(caps, start, goal, solved.moves),
  };
}

function generateTwo(random: () => number, id: string): Puzzle | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < TWO_CAPS.length; i += 1) {
    for (let j = i + 1; j < TWO_CAPS.length; j += 1) {
      pairs.push([TWO_CAPS[j], TWO_CAPS[i]]);
    }
  }
  const order = shuffle(pairs, random);
  const hits: Puzzle[] = [];

  for (const caps of order) {
    const g = gcd(caps[0], caps[1]);
    const start = emptyState(caps);
    const targets = shuffle(
      Array.from({ length: caps[0] - 1 }, (_, index) => index + 1).filter(
        (target) => target !== caps[1] && target % g === 0,
      ),
      random,
    );
    for (const target of targets) {
      const goal: Goal = { kind: 'any', amount: target };
      const solved = solve(caps, start, goal);
      if (!solved) continue;
      if (solved.moves.length < 4 || solved.moves.length > 12) continue;
      hits.push(buildPuzzle(id, caps, start, goal, solved));
      if (hits.length >= 8) break;
    }
    if (hits.length >= 8) break;
  }

  if (!hits.length) return null;
  return hits[Math.floor(random() * hits.length)] ?? null;
}

function generateThree(random: () => number, id: string): Puzzle | null {
  const triples = shuffle(TRIPLES, random);
  const hits: Puzzle[] = [];

  for (const caps of triples) {
    const start = emptyState(caps);
    const reached = explore(caps, start);
    const splits: { goal: Goal; solved: { moves: Move[]; end: number[] } }[] = [];
    const partials: { goal: Goal; solved: { moves: Move[]; end: number[] } }[] = [];

    for (const rec of Array.from(reached.values())) {
      if (rec.dist < 6 || rec.dist > 14) continue;
      const { state } = rec;
      const hasPartial = state.some((value, index) => value > 0 && value < caps[index]);
      if (!hasPartial) continue;

      for (let i = 0; i < 3; i += 1) {
        for (let j = i + 1; j < 3; j += 1) {
          if (state[i] >= 2 && state[i] === state[j] && state[i] !== caps[i] && state[j] !== caps[j]) {
            const amounts: (number | null)[] = [null, null, null];
            amounts[i] = state[i];
            amounts[j] = state[j];
            const goal: Goal = { kind: 'match', amounts };
            const solved = solve(caps, start, goal);
            if (solved && solved.moves.length >= 6 && solved.moves.length <= 14) splits.push({ goal, solved });
          }
        }
      }

      const largest = 0;
      if (state[largest] > 0 && state[largest] < caps[largest] && state[largest] % gcdAll(caps) === 0) {
        const amounts: (number | null)[] = [state[largest], null, null];
        const goal: Goal = { kind: 'match', amounts };
        const solved = solve(caps, start, goal);
        if (solved && solved.moves.length >= 6 && solved.moves.length <= 14) partials.push({ goal, solved });
      }
    }

    const pool = splits.length ? splits : partials;
    const unique = new Map<string, { goal: Goal; solved: { moves: Move[]; end: number[] } }>();
    for (const hit of pool) {
      const stamp = `${hit.goal.kind}:${hit.goal.kind === 'match' ? hit.goal.amounts.join(',') : ''}:${hit.solved.moves.length}`;
      if (!unique.has(stamp)) unique.set(stamp, hit);
    }
    const choices = Array.from(unique.values());
    if (!choices.length) continue;
    const pick = choices[Math.floor(random() * choices.length)];
    hits.push(buildPuzzle(id, caps, start, pick.goal, pick.solved));
    if (hits.length >= 4) break;
  }

  if (!hits.length) return null;
  return hits[Math.floor(random() * hits.length)] ?? null;
}

export const HOWTO_PUZZLE: Puzzle = (() => {
  const caps = [5, 3] as const;
  const start = [0, 0];
  const goal: Goal = { kind: 'any', amount: 4 };
  const solved = solve(caps, start, goal);
  if (!solved) throw new Error('Decant: how-to 5 and 3 must measure 4');
  return buildPuzzle('decant-how-to', caps, start, goal, solved);
})();

const FALLBACK_TWO: Puzzle = HOWTO_PUZZLE;

const FALLBACK_THREE: Puzzle = (() => {
  const caps = [8, 5, 3] as const;
  const start = [0, 0, 0];
  const goal: Goal = { kind: 'match', amounts: [4, 4, null] };
  const solved = solve(caps, start, goal);
  if (!solved) throw new Error('Decant: fallback 8-5-3 must split 4 and 4');
  return buildPuzzle('decant-fallback-three', caps, start, goal, solved);
})();

export function generatePuzzle(seed: number, three: boolean, id: string): Puzzle {
  const random = mulberry32(seed);
  const built = three ? generateThree(random, id) : generateTwo(random, id);
  if (built) return { ...built, id };
  const fallback = three ? FALLBACK_THREE : FALLBACK_TWO;
  return { ...fallback, id };
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  const cached = dailyCache.get(date);
  if (cached) return cached;
  const puzzle = generatePuzzle(dateSeed(date), isWeekend(date), `decant-${date}`);
  dailyCache.set(date, puzzle);
  return puzzle;
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000), date = utcDate()): Puzzle {
  const today = dailyPuzzle(date);
  const three = seed % 5 === 0;
  const puzzle = generatePuzzle((seed ^ 0x9e3779b9) >>> 0, three, `decant-practice-${seed >>> 0}`);
  if (shortGoal(puzzle.capacities, puzzle.goal) === shortGoal(today.capacities, today.goal)) {
    return generatePuzzle((seed + 17) >>> 0, !three, `decant-practice-${seed >>> 0}`);
  }
  return puzzle;
}

export function scorePours(pours: number, optimal: number): number {
  const extra = Math.max(0, pours - optimal);
  return Math.max(MIN_SOLVED_SCORE, MAX_SCORE - extra * EXTRA_POUR_COST);
}

export function gradeFor(pours: number, optimal: number): Grade {
  const extra = Math.max(0, pours - optimal);
  if (extra === 0) return 'par';
  if (extra === 1) return 'close';
  if (extra <= 3) return 'steady';
  return 'patient';
}

export function makeResult(puzzle: Puzzle, pours: number, end: readonly number[]): Result {
  return {
    puzzle,
    pours,
    extra: Math.max(0, pours - puzzle.optimal),
    points: scorePours(pours, puzzle.optimal),
    grade: gradeFor(pours, puzzle.optimal),
    end,
  };
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function gradeEmoji(grade: Grade) {
  return GRADE_EMOJI[grade];
}

export function pourLabel(count: number) {
  return count === 1 ? '1 pour' : `${count} pours`;
}

export function shareDrops(pours: number): string {
  const shown = Math.min(12, Math.max(0, pours));
  return `${'💧'.repeat(shown)}${pours > 12 ? '…' : ''}`;
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Decant #${puzzleNumberForDate(date)}` : 'Decant · practice';
  return [
    title,
    shortGoal(result.puzzle.capacities, result.puzzle.goal),
    shareDrops(result.pours),
    `${pourLabel(result.pours)} · par ${result.puzzle.optimal} · ${result.points}/${MAX_SCORE}`,
  ];
}

export function fingerprint(puzzle: Puzzle): string {
  return `${puzzle.capacities.join('x')}|${shortGoal(puzzle.capacities, puzzle.goal)}|${puzzle.optimal}`;
}

export function isHeldJug(held: Held, index: number): boolean {
  return held?.kind === 'jug' && held.index === index;
}

export { TWO_CAPS, TRIPLES, FALLBACK_TWO, FALLBACK_THREE };

import type { Card, Color, Count, Fill, Grade, Mode, Puzzle, Result, Shape, Triad } from './types';

export const BOARD_SIZE = 12;
export const MIN_TRIADS = 4;
export const MAX_TRIADS = 8;
export const MAX_HINTS = 3;
export const MAX_SCORE = 100;
export const MISTAKE_COST = 10;
export const HINT_COST = 15;
export const MIN_SOLVED_SCORE = 25;
export const LAUNCH_DATE = '2026-11-04';
export const ROTATION_SEED = 0x7241ad;

export const SHAPE_NAMES = ['diamond', 'oval', 'squiggle'] as const;
export const COLOR_NAMES = ['rust', 'ink', 'moss'] as const;
export const COUNT_NAMES = ['one', 'two', 'three'] as const;
export const FILL_NAMES = ['solid', 'striped', 'empty'] as const;

const GRADE_LABEL: Record<Grade, string> = {
  clean: 'Clean sweep',
  sharp: 'Sharp eye',
  steady: 'Steady',
  guided: 'Guided',
  messy: 'Found them all',
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

export function cardFrom(shape: Shape, color: Color, count: Count, fill: Fill): Card {
  return {
    id: shape + 3 * color + 9 * count + 27 * fill,
    shape,
    color,
    count,
    fill,
  };
}

export function cardFromId(id: number): Card {
  return {
    id,
    shape: (id % 3) as Shape,
    color: (Math.floor(id / 3) % 3) as Color,
    count: (Math.floor(id / 9) % 3) as Count,
    fill: (Math.floor(id / 27) % 3) as Fill,
  };
}

export const ALL_CARDS: readonly Card[] = Array.from({ length: 81 }, (_, id) => cardFromId(id));

export function completeCard(a: Card, b: Card): Card {
  return cardFrom(
    ((3 - ((a.shape + b.shape) % 3)) % 3) as Shape,
    ((3 - ((a.color + b.color) % 3)) % 3) as Color,
    ((3 - ((a.count + b.count) % 3)) % 3) as Count,
    ((3 - ((a.fill + b.fill) % 3)) % 3) as Fill,
  );
}

export function isTriad(a: Card, b: Card, c: Card): boolean {
  return (
    (a.shape + b.shape + c.shape) % 3 === 0 &&
    (a.color + b.color + c.color) % 3 === 0 &&
    (a.count + b.count + c.count) % 3 === 0 &&
    (a.fill + b.fill + c.fill) % 3 === 0
  );
}

export function triadKey(ids: readonly number[]): string {
  return [...ids].sort((a, b) => a - b).join('-');
}

export function asTriad(ids: readonly number[]): Triad {
  const [a, b, c] = [...ids].sort((left, right) => left - right);
  return [a, b, c];
}

export function findTriads(cards: readonly Card[]): Triad[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const ids = cards.map((card) => card.id);
  const found: Triad[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      for (let k = j + 1; k < ids.length; k += 1) {
        const a = byId.get(ids[i]);
        const b = byId.get(ids[j]);
        const c = byId.get(ids[k]);
        if (a && b && c && isTriad(a, b, c)) found.push([ids[i], ids[j], ids[k]]);
      }
    }
  }
  return found;
}

export function cardsById(cards: readonly Card[], ids: readonly number[]): Card[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return ids.map((id) => byId.get(id)).filter((card): card is Card => Boolean(card));
}

function uniqueIds(cards: readonly Card[]): boolean {
  return new Set(cards.map((card) => card.id)).size === cards.length;
}

function inRange(count: number): boolean {
  return count >= MIN_TRIADS && count <= MAX_TRIADS;
}

function randomBoard(random: () => number): Card[] {
  return shuffle(ALL_CARDS, random).slice(0, BOARD_SIZE);
}

function plantedBoard(random: () => number, plants: number): Card[] | null {
  const used = new Set<number>();
  const planted: Card[] = [];

  for (let index = 0; index < plants; index += 1) {
    let placed = false;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const a = ALL_CARDS[Math.floor(random() * ALL_CARDS.length)]!;
      const b = ALL_CARDS[Math.floor(random() * ALL_CARDS.length)]!;
      if (a.id === b.id) continue;
      const c = completeCard(a, b);
      if (new Set([a.id, b.id, c.id]).size !== 3) continue;
      if (used.has(a.id) || used.has(b.id) || used.has(c.id)) continue;
      used.add(a.id);
      used.add(b.id);
      used.add(c.id);
      planted.push(a, b, c);
      placed = true;
      break;
    }
    if (!placed) return null;
  }

  const extras = shuffle(
    ALL_CARDS.filter((card) => !used.has(card.id)),
    random,
  ).slice(0, BOARD_SIZE - planted.length);
  return shuffle([...planted, ...extras], random);
}

function buildPuzzle(id: string, cards: readonly Card[]): Puzzle | null {
  if (cards.length !== BOARD_SIZE || !uniqueIds(cards)) return null;
  const triads = findTriads(cards);
  if (!inRange(triads.length)) return null;
  return { id, cards, triads };
}

export const HOWTO_CARDS: readonly Card[] = [
  cardFrom(0, 0, 0, 0),
  cardFrom(1, 0, 0, 1),
  cardFrom(2, 0, 0, 2),
];

export const HOWTO_TRIAD: Triad = [HOWTO_CARDS[0]!.id, HOWTO_CARDS[1]!.id, HOWTO_CARDS[2]!.id];

export const FALLBACK_CARDS: readonly Card[] = [
  cardFrom(0, 0, 0, 0),
  cardFrom(1, 0, 0, 0),
  cardFrom(2, 0, 0, 0),
  cardFrom(0, 1, 0, 1),
  cardFrom(1, 1, 0, 1),
  cardFrom(2, 1, 0, 1),
  cardFrom(0, 2, 1, 2),
  cardFrom(1, 2, 1, 2),
  cardFrom(2, 2, 1, 2),
  cardFrom(0, 0, 2, 1),
  cardFrom(1, 1, 2, 2),
  cardFrom(2, 2, 2, 0),
];

export const FALLBACK_PUZZLE: Puzzle = (() => {
  const triads = findTriads(FALLBACK_CARDS);
  if (!inRange(triads.length)) {
    throw new Error(`Triad: fallback board must have ${MIN_TRIADS}–${MAX_TRIADS} triads, got ${triads.length}`);
  }
  return { id: 'triad-fallback', cards: FALLBACK_CARDS, triads };
})();

export function generatePuzzle(seed: number, id: string): Puzzle {
  const random = mulberry32(seed);

  for (let attempt = 0; attempt < 280; attempt += 1) {
    const built = buildPuzzle(id, randomBoard(random));
    if (built) return built;
  }

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const plants = attempt % 2 === 0 ? 2 : 3;
    const board = plantedBoard(random, plants);
    if (!board) continue;
    const built = buildPuzzle(id, board);
    if (built) return built;
  }

  return { ...FALLBACK_PUZZLE, id };
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  const cached = dailyCache.get(date);
  if (cached) return cached;
  const puzzle = generatePuzzle(dateSeed(date), `triad-${date}`);
  dailyCache.set(date, puzzle);
  return puzzle;
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000), date = utcDate()): Puzzle {
  const today = dailyPuzzle(date);
  const puzzle = generatePuzzle((seed ^ 0x9e3779b9) >>> 0, `triad-practice-${seed >>> 0}`);
  if (fingerprint(puzzle) === fingerprint(today)) {
    return generatePuzzle((seed + 29) >>> 0, `triad-practice-${seed >>> 0}`);
  }
  return puzzle;
}

export function scoreRun(mistakes: number, hints: number): number {
  return Math.max(MIN_SOLVED_SCORE, MAX_SCORE - mistakes * MISTAKE_COST - hints * HINT_COST);
}

export function gradeFor(mistakes: number, hints: number): Grade {
  if (hints === 0 && mistakes === 0) return 'clean';
  if (hints === 0 && mistakes <= 2) return 'sharp';
  if (hints > 0 && mistakes <= 2) return 'guided';
  if (mistakes <= 5) return 'steady';
  return 'messy';
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function makeResult(puzzle: Puzzle, found: readonly Triad[], mistakes: number, hints: number): Result {
  const solved = found.length === puzzle.triads.length;
  return {
    puzzle,
    found,
    mistakes,
    hints,
    solved,
    points: solved ? scoreRun(mistakes, hints) : 0,
    grade: gradeFor(mistakes, hints),
  };
}

export function describeCard(card: Card): string {
  return `${COUNT_NAMES[card.count]} ${COLOR_NAMES[card.color]} ${FILL_NAMES[card.fill]} ${SHAPE_NAMES[card.shape]}`;
}

export function describeTriad(cards: readonly Card[]): string {
  return cards.map(describeCard).join('; ');
}

export function missWord(count: number) {
  return count === 1 ? 'miss' : 'misses';
}

export function hintWord(count: number) {
  return count === 1 ? 'hint' : 'hints';
}

export function triadWord(count: number) {
  return count === 1 ? 'triad' : 'triads';
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Triad #${puzzleNumberForDate(date)}` : 'Triad · practice';
  const found = `${result.found.length}/${result.puzzle.triads.length}`;
  return [
    title,
    `🎴 ${found} · ${result.mistakes} ${missWord(result.mistakes)} · ${result.hints} ${hintWord(result.hints)}`,
    `${result.points}/${MAX_SCORE}`,
  ];
}

export function fingerprint(puzzle: Puzzle): string {
  const cards = puzzle.cards.map((card) => card.id).slice().sort((a, b) => a - b);
  const triads = puzzle.triads.map((triad) => triadKey(triad)).slice().sort();
  return `${cards.join(',')}|${triads.join(';')}`;
}

export function remainingTriads(puzzle: Puzzle, found: readonly string[]): Triad[] {
  const seen = new Set(found);
  return puzzle.triads.filter((triad) => !seen.has(triadKey(triad)));
}

export function hintCardId(puzzle: Puzzle, found: readonly string[], selected: readonly number[]): number | null {
  const open = remainingTriads(puzzle, found);
  if (!open.length) return null;
  const pick = open[0]!;
  const unused = pick.find((id) => !selected.includes(id));
  return unused ?? pick[0]!;
}

export function selectionOutcome(
  puzzle: Puzzle,
  selected: readonly number[],
  found: readonly string[],
): 'short' | 'valid' | 'repeat' | 'invalid' {
  if (selected.length !== 3) return 'short';
  const cards = cardsById(puzzle.cards, selected);
  if (cards.length !== 3) return 'invalid';
  if (!isTriad(cards[0]!, cards[1]!, cards[2]!)) return 'invalid';
  return found.includes(triadKey(selected)) ? 'repeat' : 'valid';
}

import { WORDS } from './words';
import type { Difficulty, Grade, Mode, PlayTile, Puzzle, Result } from './types';

export const ROUND_SIZE = 6;
export const MAX_TRIES = 3;
export const MAX_HINTS = 1;
export const MAX_PER_ROUND = 100;
export const MAX_SCORE = MAX_PER_ROUND * ROUND_SIZE;
export const LAUNCH_DATE = '2026-10-23';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const GRADE_EMOJI: Record<Grade, string> = {
  first: '🟩',
  firstHint: '🟦',
  second: '🟨',
  third: '🟧',
  miss: '🟥',
};

const GRADE_LABEL: Record<Grade, string> = {
  first: 'First try',
  firstHint: 'First try · hinted',
  second: 'Second try',
  third: 'Last try',
  miss: 'Missed',
};

export function localDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0x91ed3a7b) >>> 0;
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

export function pickRound(seed: number): Puzzle[] {
  const random = mulberry32(seed);
  const buckets = new Map<Difficulty, Puzzle[]>();
  for (const difficulty of DIFFICULTIES) buckets.set(difficulty, []);
  for (const puzzle of shuffle(WORDS, random)) {
    buckets.get(puzzle.difficulty)?.push(puzzle);
  }

  const picked: Puzzle[] = [];
  const used = new Set<string>();

  for (const difficulty of DIFFICULTIES) {
    const pool = buckets.get(difficulty) ?? [];
    let taken = 0;
    for (const puzzle of pool) {
      if (taken >= 2 || picked.length >= ROUND_SIZE) break;
      if (used.has(puzzle.id)) continue;
      used.add(puzzle.id);
      picked.push(puzzle);
      taken += 1;
    }
  }

  if (picked.length < ROUND_SIZE) {
    for (const puzzle of shuffle(WORDS, random)) {
      if (picked.length >= ROUND_SIZE) break;
      if (used.has(puzzle.id)) continue;
      used.add(puzzle.id);
      picked.push(puzzle);
    }
  }

  return shuffle(picked, random).slice(0, ROUND_SIZE);
}

export function dailyPuzzles(date = localDate()): Puzzle[] {
  return pickRound(dateSeed(date));
}

export function practicePuzzles(seed = Math.floor(Math.random() * 1_000_000_000)): Puzzle[] {
  return pickRound(seed);
}

export function dealTiles(puzzle: Puzzle, seed: number): PlayTile[] {
  const random = mulberry32(seed);
  const tiles: PlayTile[] = [
    ...puzzle.roots.map((root, index) => ({
      id: `${puzzle.id}-r-${index}`,
      form: root.form,
      gloss: root.gloss,
      correct: true,
      order: index,
    })),
    ...puzzle.decoys.map((form, index) => ({
      id: `${puzzle.id}-d-${index}`,
      form,
      correct: false,
    })),
  ];
  return shuffle(tiles, random);
}

export function assembledWord(tiles: PlayTile[]): string {
  return tiles.map((tile) => tile.form).join('');
}

export function isSolved(tiles: PlayTile[], puzzle: Puzzle): boolean {
  return assembledWord(tiles) === puzzle.word;
}

export function gradeAttempt(tries: number, hints: number, solved: boolean): Grade {
  if (!solved) return 'miss';
  if (tries <= 1) return hints > 0 ? 'firstHint' : 'first';
  if (tries === 2) return 'second';
  return 'third';
}

export function scoreAttempt(tries: number, hints: number, solved: boolean): number {
  if (!solved) return 0;
  const hinted = hints > 0;
  if (tries <= 1) return hinted ? 80 : 100;
  if (tries === 2) return hinted ? 50 : 70;
  return hinted ? 25 : 40;
}

export function makeResult(puzzle: Puzzle, tries: number, hints: number, solved: boolean): Result {
  return {
    puzzle,
    tries,
    hints,
    solved,
    points: scoreAttempt(tries, hints, solved),
    grade: gradeAttempt(tries, hints, solved),
  };
}

export function gradeEmoji(grade: Grade) {
  return GRADE_EMOJI[grade];
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function totalScore(results: Result[]): number {
  return results.reduce((sum, result) => sum + result.points, 0);
}

export function hintTile(tiles: PlayTile[], usedIds: Set<string>): PlayTile | undefined {
  return tiles
    .filter((tile) => tile.correct && !usedIds.has(tile.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
}

export function shareLines(results: Result[], mode: Mode, date: string): string[] {
  const emojis = results.map((result) => gradeEmoji(result.grade)).join('');
  const total = totalScore(results);
  const title = mode === 'daily' ? `Root Words #${puzzleNumberForDate(date)}` : 'Root Words · practice';
  return [title, emojis, `${total}/${MAX_SCORE}`];
}

export function familyLabel(family: Puzzle['family']): string {
  if (family === 'greek') return 'Greek';
  if (family === 'latin') return 'Latin';
  if (family === 'germanic') return 'Old English';
  return 'Mixed';
}

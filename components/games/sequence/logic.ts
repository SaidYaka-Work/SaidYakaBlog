import { SPECS } from './sequences';
import type { Attempt, Grade, Mode, Puzzle, Result, SequenceSpec, Tone } from './types';

export const MAX_TRIES = 5;
export const MAX_SCORE = 100;
export const MAX_HINTS = 4;
export const LAUNCH_DATE = '2026-10-27';
export const ROTATION_SEED = 0x5e9e17e1;

const GRADE_EMOJI: Record<Grade, string> = {
  first: '🎯',
  second: '✨',
  third: '🟢',
  fourth: '🟡',
  fifth: '🟠',
  miss: '🔴',
};

const GRADE_LABEL: Record<Grade, string> = {
  first: 'First try',
  second: 'Second try',
  third: 'Third try',
  fourth: 'Fourth try',
  fifth: 'Last try',
  miss: 'Missed',
};

const TONE_EMOJI: Record<Tone, string> = {
  hit: '🟩',
  close: '🟨',
  miss: '⬛',
};

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0x51e9ce1e) >>> 0;
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

export function formatTerm(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatList(values: readonly number[]): string {
  return values.map(formatTerm).join(', ');
}

export function parseGuess(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, '').replace(/_/g, '').replace(/\s+/g, '');
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

export function digitCount(value: number): number {
  return String(Math.abs(value)).length;
}

export function guessTone(guess: number, answer: number): Tone {
  if (guess === answer) return 'hit';
  if (Math.abs(guess - answer) === 1) return 'close';
  const scale = Math.max(Math.abs(answer), 1);
  if (digitCount(guess) === digitCount(answer) && Math.abs(guess - answer) / scale <= 0.2) {
    return 'close';
  }
  return 'miss';
}

function defaultOpeningHint(shown: readonly number[]): string {
  const diffs = shown.slice(1).map((term, index) => term - shown[index]);
  if (diffs.length === 0) return 'Look at how the terms grow.';
  if (diffs.every((diff) => diff === diffs[0])) {
    if (diffs[0] === 0) return 'The first differences are all zero — the visible terms stay put.';
    const verb = diffs[0] > 0 ? 'adds' : 'subtracts';
    return `The first differences are constant: each step ${verb} ${formatTerm(Math.abs(diffs[0]))}.`;
  }
  return `The first differences are ${formatList(diffs)}.`;
}

function scaleHint(answer: number, shown: readonly number[]): string {
  const digits = digitCount(answer);
  const last = shown[shown.length - 1];
  const relation =
    last === undefined
      ? ''
      : answer > last
        ? ' It is larger than the last shown term.'
        : answer < last
          ? ' It is smaller than the last shown term.'
          : '';
  return `The next term is a ${digits}-digit number.${relation}`;
}

export function buildPuzzle(spec: SequenceSpec): Puzzle {
  const need = spec.shownCount + 2;
  const terms = spec.generate(need);
  if (terms.length < spec.shownCount + 1) {
    throw new Error(`Sequence: ${spec.id} generated ${terms.length} terms`);
  }
  const shown = terms.slice(0, spec.shownCount);
  const answer = terms[spec.shownCount];
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    shown,
    answer,
    continuation: terms.slice(spec.shownCount, spec.shownCount + 4),
    rule: spec.rule,
    blurb: spec.blurb,
    source: spec.source,
    hints: [
      spec.openingHint ?? defaultOpeningHint(shown),
      spec.categoryHint,
      spec.giveaway,
      scaleHint(answer, shown),
    ],
  };
}

function validateBank(specs: readonly SequenceSpec[]) {
  const ids = new Set<string>();
  for (const spec of specs) {
    if (ids.has(spec.id)) throw new Error(`Sequence: duplicate id ${spec.id}`);
    ids.add(spec.id);
    if (spec.shownCount < 3) throw new Error(`Sequence: ${spec.id} shows too few terms`);
    if (spec.expected.length !== spec.shownCount + 1) {
      throw new Error(`Sequence: ${spec.id} expected length ${spec.expected.length}, need ${spec.shownCount + 1}`);
    }
    const generated = spec.generate(spec.expected.length);
    if (generated.length < spec.expected.length) {
      throw new Error(`Sequence: ${spec.id} generate() returned ${generated.length} terms`);
    }
    for (let i = 0; i < spec.expected.length; i += 1) {
      if (generated[i] !== spec.expected[i]) {
        throw new Error(`Sequence: ${spec.id} term ${i} is ${generated[i]}, expected ${spec.expected[i]}`);
      }
      if (!Number.isSafeInteger(generated[i])) {
        throw new Error(`Sequence: ${spec.id} term ${i} is not a safe integer`);
      }
    }
    const answer = spec.expected[spec.expected.length - 1];
    if (digitCount(answer) > 7) {
      throw new Error(`Sequence: ${spec.id} answer ${answer} is too large to type comfortably`);
    }
    if (!spec.name.trim() || !spec.rule.trim() || !spec.blurb.trim() || !spec.source.trim()) {
      throw new Error(`Sequence: ${spec.id} is missing copy`);
    }
    if (!spec.categoryHint.trim() || !spec.giveaway.trim()) {
      throw new Error(`Sequence: ${spec.id} is missing hints`);
    }
    const sentences = spec.blurb.split(/[.?!](?:\s|$)/).filter((part) => part.trim().length > 20);
    if (sentences.length < 2) {
      throw new Error(`Sequence: ${spec.id} blurb should be two sentences`);
    }
  }
  if (specs.length < 40) {
    throw new Error(`Sequence: bank has ${specs.length} sequences; need at least 40`);
  }
}

validateBank(SPECS);

export const PUZZLES: Puzzle[] = SPECS.map(buildPuzzle);

export function rotationOrder(specs: readonly SequenceSpec[] = SPECS): SequenceSpec[] {
  return shuffle(specs, mulberry32(ROTATION_SEED));
}

export function dailySpec(date = utcDate()): SequenceSpec {
  const order = rotationOrder();
  const index = calendarDayIndex(date);
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

export function scoreAttempt(tries: number, solved: boolean): number {
  if (!solved) return 0;
  if (tries <= 1) return 100;
  if (tries === 2) return 80;
  if (tries === 3) return 60;
  if (tries === 4) return 40;
  return 20;
}

export function gradeFor(tries: number, solved: boolean): Grade {
  if (!solved) return 'miss';
  if (tries <= 1) return 'first';
  if (tries === 2) return 'second';
  if (tries === 3) return 'third';
  if (tries === 4) return 'fourth';
  return 'fifth';
}

export function makeResult(puzzle: Puzzle, attempts: Attempt[], solved: boolean): Result {
  const tries = attempts.length;
  return {
    puzzle,
    attempts,
    solved,
    tries,
    points: scoreAttempt(tries, solved),
    grade: gradeFor(tries, solved),
  };
}

export function gradeEmoji(grade: Grade) {
  return GRADE_EMOJI[grade];
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function toneEmoji(tone: Tone) {
  return TONE_EMOJI[tone];
}

export function shareGrid(attempts: readonly Attempt[]): string {
  return attempts.map((attempt) => toneEmoji(attempt.tone)).join('');
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Sequence #${puzzleNumberForDate(date)}` : 'Sequence · practice';
  const tries = result.solved ? `${result.tries}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
  return [title, shareGrid(result.attempts), `${tries} · ${result.points}/${MAX_SCORE}`];
}

export function unlockedHintCount(misses: number): number {
  return Math.min(MAX_HINTS, Math.max(0, misses));
}

export { SPECS };

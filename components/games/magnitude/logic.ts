import { QUESTIONS } from './questions';
import type { Category, Grade, Mode, Question, Result, Scale } from './types';

export const ROUND_SIZE = 5;
export const MAX_PER_QUESTION = 150;
export const MAX_SCORE = MAX_PER_QUESTION * ROUND_SIZE;
export const LAUNCH_DATE = '2026-10-22';

const CATEGORIES: Category[] = ['science', 'geography', 'history', 'body', 'space', 'everyday'];

const GRADE_EMOJI: Record<Grade, string> = {
  spot: '🎯',
  close: '✨',
  near: '🟢',
  order: '🟡',
  far: '🟠',
  miss: '🔴',
};

const GRADE_LABEL: Record<Grade, string> = {
  spot: 'Spot on',
  close: 'Close',
  near: 'In range',
  order: 'Order-ish',
  far: 'Distant',
  miss: 'Way off',
};

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0x5f3759df) >>> 0;
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

export function pickRound(seed: number): Question[] {
  const random = mulberry32(seed);
  const buckets = new Map<Category, Question[]>();
  for (const category of CATEGORIES) buckets.set(category, []);
  for (const question of shuffle(QUESTIONS, random)) {
    buckets.get(question.category)?.push(question);
  }

  const picked: Question[] = [];
  const used = new Set<string>();
  const order = shuffle(CATEGORIES, random);

  for (const category of order) {
    if (picked.length >= ROUND_SIZE) break;
    const next = (buckets.get(category) ?? []).find((row) => !used.has(row.id));
    if (!next) continue;
    used.add(next.id);
    picked.push(next);
  }

  if (picked.length < ROUND_SIZE) {
    for (const question of shuffle(QUESTIONS, random)) {
      if (picked.length >= ROUND_SIZE) break;
      if (used.has(question.id)) continue;
      used.add(question.id);
      picked.push(question);
    }
  }

  return shuffle(picked, random).slice(0, ROUND_SIZE);
}

export function dailyQuestions(date = utcDate()): Question[] {
  return pickRound(dateSeed(date));
}

export function practiceQuestions(seed = Math.floor(Math.random() * 1_000_000_000)): Question[] {
  return pickRound(seed);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function magnitudeError(guess: number, answer: number, scale: Scale): number {
  if (!Number.isFinite(guess) || !Number.isFinite(answer)) return 2;
  if (scale === 'year') {
    return Math.log10(Math.abs(guess - answer) / 10 + 1);
  }
  const safeGuess = Math.max(Math.abs(guess), 1e-12);
  const safeAnswer = Math.max(Math.abs(answer), 1e-12);
  return Math.abs(Math.log10(safeGuess) - Math.log10(safeAnswer));
}

export function gradeFor(error: number): Grade {
  if (error < 0.05) return 'spot';
  if (error < 0.15) return 'close';
  if (error < 0.5) return 'near';
  if (error < 1) return 'order';
  if (error < 2) return 'far';
  return 'miss';
}

export function scoreGuess(guess: number, question: Question): Result {
  const clamped = clamp(guess, question.min, question.max);
  const error = magnitudeError(clamped, question.answer, question.scale);
  const base = Math.round(Math.max(0, 100 * (1 - error / 2)));
  const bonus = error < 0.05 ? 50 : error < 0.15 ? 20 : 0;
  return {
    question,
    guess: clamped,
    error,
    points: base + bonus,
    grade: gradeFor(error),
  };
}

export function gradeEmoji(grade: Grade) {
  return GRADE_EMOJI[grade];
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function describeError(result: Result): string {
  if (result.question.scale === 'year') {
    const years = Math.round(Math.abs(result.guess - result.question.answer));
    if (years < 1) return 'the same year';
    if (years === 1) return '1 year off';
    return `${years.toLocaleString('en-US')} years off`;
  }
  const ratio = 10 ** result.error;
  if (result.error < 0.05) return 'within about 12%';
  if (result.error < 0.3) return `about ${ratio.toFixed(1)}× off`;
  return `about ${Math.round(ratio)}× off`;
}

const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function toSuperscript(value: number): string {
  return String(value)
    .split('')
    .map((char) => (char === '-' ? '⁻' : SUPER[Number(char)] ?? char))
    .join('');
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e15 || (abs > 0 && abs < 0.01)) {
    const [coeff, exp] = value.toExponential(2).split('e');
    return `${coeff.replace(/\.?0+$/, '')}×10${toSuperscript(Number(exp))}`;
  }
  if (Number.isInteger(value)) {
    if (abs >= 1e9 && abs % 1e9 === 0) return `${(value / 1e9).toLocaleString('en-US')} billion`;
    if (abs >= 1e6 && abs % 1e6 === 0) return `${(value / 1e6).toLocaleString('en-US')} million`;
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (abs >= 1e12) return `${trimNumber(value / 1e12)} trillion`;
  if (abs >= 1e9) return `${trimNumber(value / 1e9)} billion`;
  if (abs >= 1e6) return `${trimNumber(value / 1e6)} million`;
  if (abs >= 100) return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (abs >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return trimNumber(value);
}

function trimNumber(value: number): string {
  return Number(value.toPrecision(3)).toString();
}

export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(Math.round(year)).toLocaleString('en-US')} BCE`;
  return `${Math.round(year)} CE`;
}

export function formatValue(value: number, question: Question): string {
  const formatted = question.scale === 'year' ? formatYear(value) : formatQuantity(value);
  if (!question.unit || question.scale === 'year') return formatted;
  return `${formatted} ${question.unit}`;
}

export function parseGuess(raw: string, scale: Scale): number | null {
  const trimmed = raw.trim().toLowerCase().replace(/,/g, '').replace(/_/g, '');
  if (!trimmed) return null;

  if (scale === 'year') {
    const compact = trimmed.replace(/\s+/g, '');
    const bce = /(?:bce|bc)$/.test(compact);
    const stripped = compact.replace(/(?:bce|bc|ce)$/i, '');
    const numeric = Number(stripped.replace(/[^0-9.+-]/g, ''));
    if (!Number.isFinite(numeric) || numeric === 0) return null;
    return bce ? -Math.abs(numeric) : numeric;
  }

  const suffixes: [RegExp, number][] = [
    [/trillion$/, 1e12],
    [/billion$/, 1e9],
    [/million$/, 1e6],
    [/thousand$/, 1e3],
    [/k$/, 1e3],
  ];
  let text = trimmed;
  let factor = 1;
  for (const [pattern, amount] of suffixes) {
    if (pattern.test(text)) {
      text = text.replace(pattern, '').trim();
      factor = amount;
      break;
    }
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  return numeric * factor;
}

export function valueToT(value: number, question: Question): number {
  if (question.scale === 'year') {
    return (value - question.min) / (question.max - question.min);
  }
  const minLog = Math.log10(question.min);
  const maxLog = Math.log10(question.max);
  return (Math.log10(Math.max(value, question.min)) - minLog) / (maxLog - minLog);
}

export function tToValue(t: number, question: Question): number {
  const clamped = clamp(t, 0, 1);
  if (question.scale === 'year') {
    return question.min + clamped * (question.max - question.min);
  }
  const minLog = Math.log10(question.min);
  const maxLog = Math.log10(question.max);
  return 10 ** (minLog + clamped * (maxLog - minLog));
}

export function midpoint(question: Question): number {
  return tToValue(0.5, question);
}

export function stepValue(value: number, question: Question, steps: number): number {
  if (question.scale === 'year') {
    const span = question.max - question.min;
    const unit = span > 4000 ? 50 : span > 1500 ? 10 : 1;
    return clamp(value + steps * unit, question.min, question.max);
  }
  const log = Math.log10(Math.max(value, question.min));
  return clamp(10 ** (log + steps * 0.05), question.min, question.max);
}

export type Tick = { value: number; t: number; label: string };

export function ticksFor(question: Question): Tick[] {
  if (question.scale === 'year') {
    const candidates = [-3000, -2000, -1000, -500, 1, 500, 1000, 1500, 1800, 1900, 2000];
    return candidates
      .filter((year) => year >= question.min && year <= question.max)
      .map((value) => ({ value, t: valueToT(value, question), label: formatYear(value) }));
  }

  const minLog = Math.ceil(Math.log10(question.min) - 1e-9);
  const maxLog = Math.floor(Math.log10(question.max) + 1e-9);
  const ticks: Tick[] = [];
  for (let exp = minLog; exp <= maxLog; exp += 1) {
    const value = 10 ** exp;
    if (value < question.min * 0.999 || value > question.max * 1.001) continue;
    ticks.push({ value, t: valueToT(value, question), label: formatQuantity(value) });
  }
  if (ticks.length <= 6) return ticks;
  const step = Math.ceil(ticks.length / 5);
  return ticks.filter((tick, index) => index === 0 || index === ticks.length - 1 || index % step === 0);
}

export function shareLines(results: Result[], mode: Mode, date: string): string[] {
  const emojis = results.map((result) => gradeEmoji(result.grade)).join('');
  const total = results.reduce((sum, result) => sum + result.points, 0);
  const title = mode === 'daily' ? `Magnitude #${puzzleNumberForDate(date)}` : 'Magnitude · practice';
  return [title, emojis, `${total}/${MAX_SCORE}`];
}

export function totalScore(results: Result[]): number {
  return results.reduce((sum, result) => sum + result.points, 0);
}

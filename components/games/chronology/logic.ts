import { EVENTS } from './events';
import type { Attempt, Era, Grade, HistoricalEvent, Mode, Region, Result } from './types';

export const ROUND_SIZE = 6;
export const MAX_TRIES = 4;
export const MAX_SCORE = 100;
export const LAUNCH_DATE = '2026-10-24';

const ERAS: Era[] = ['ancient', 'classical', 'medieval', 'early-modern', 'modern', 'contemporary'];

const GRADE_EMOJI: Record<Grade, string> = {
  first: '🎯',
  second: '✨',
  third: '🟢',
  fourth: '🟡',
  miss: '🔴',
};

const GRADE_LABEL: Record<Grade, string> = {
  first: 'First try',
  second: 'Second try',
  third: 'Third try',
  fourth: 'Last try',
  miss: 'Missed',
};

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0x4b1d7e3c) >>> 0;
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

function validateBank(events: readonly HistoricalEvent[]) {
  const ids = new Set<string>();
  const years = new Map<number, string>();
  for (const event of events) {
    if (ids.has(event.id)) throw new Error(`Chronology: duplicate id ${event.id}`);
    ids.add(event.id);
    const prior = years.get(event.year);
    if (prior) throw new Error(`Chronology: year ${event.year} used by ${prior} and ${event.id}`);
    years.set(event.year, event.id);
    if (!event.title.trim() || !event.note.trim()) {
      throw new Error(`Chronology: incomplete ${event.id}`);
    }
  }
  if (events.length < 80) {
    throw new Error(`Chronology: bank has ${events.length} events; need at least 80`);
  }
}

validateBank(EVENTS);

export function chronological(events: readonly HistoricalEvent[]): HistoricalEvent[] {
  return [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}

export function pickRound(seed: number): HistoricalEvent[] {
  const random = mulberry32(seed);
  const buckets = new Map<Era, HistoricalEvent[]>();
  for (const era of ERAS) buckets.set(era, []);
  for (const event of shuffle(EVENTS, random)) {
    buckets.get(event.era)?.push(event);
  }

  const picked: HistoricalEvent[] = [];
  const used = new Set<string>();
  const usedRegions = new Set<Region>();
  const eraOrder = shuffle(ERAS, random);

  for (const era of eraOrder) {
    if (picked.length >= 4) break;
    const pool = (buckets.get(era) ?? []).filter((event) => !used.has(event.id));
    if (!pool.length) continue;
    const choice = pool.find((event) => !usedRegions.has(event.region)) ?? pool[0];
    used.add(choice.id);
    usedRegions.add(choice.region);
    picked.push(choice);
  }

  for (const event of shuffle(EVENTS, random)) {
    if (picked.length >= ROUND_SIZE) break;
    if (used.has(event.id)) continue;
    used.add(event.id);
    picked.push(event);
  }

  let dealt = shuffle(picked, random).slice(0, ROUND_SIZE);
  const solution = chronological(dealt);
  if (dealt.every((event, index) => event.id === solution[index].id)) {
    dealt = shuffle(dealt, random);
  }
  return dealt;
}

export function dailyEvents(date = utcDate()): HistoricalEvent[] {
  return pickRound(dateSeed(date));
}

export function practiceEvents(seed = Math.floor(Math.random() * 1_000_000_000)): HistoricalEvent[] {
  return pickRound(seed);
}

export function dealOrder(events: readonly HistoricalEvent[], seed: number): HistoricalEvent[] {
  let dealt = shuffle(events, mulberry32(seed));
  const solution = chronological(events);
  if (dealt.every((event, index) => event.id === solution[index].id)) {
    dealt = shuffle(dealt, mulberry32(seed ^ 0x9e3779b9));
  }
  return dealt;
}

export function lockMask(order: readonly HistoricalEvent[], solution: readonly HistoricalEvent[]): boolean[] {
  return order.map((event, index) => event.id === solution[index]?.id);
}

export function allLocked(locked: readonly boolean[]): boolean {
  return locked.length > 0 && locked.every(Boolean);
}

export function unlockedIndices(locked: readonly boolean[]): number[] {
  return locked.flatMap((isLocked, index) => (isLocked ? [] : [index]));
}

export function moveAmongUnlocked<T>(items: readonly T[], locked: readonly boolean[], from: number, to: number): T[] {
  if (from === to || locked[from] || locked[to]) return [...items];
  const slots = unlockedIndices(locked);
  const fromPos = slots.indexOf(from);
  const toPos = slots.indexOf(to);
  if (fromPos < 0 || toPos < 0) return [...items];

  const unlocked = slots.map((index) => items[index]);
  const [moved] = unlocked.splice(fromPos, 1);
  unlocked.splice(toPos, 0, moved);

  const next = [...items];
  slots.forEach((index, order) => {
    next[index] = unlocked[order];
  });
  return next;
}

export function neighborUnlocked(locked: readonly boolean[], from: number, direction: -1 | 1): number | null {
  const slots = unlockedIndices(locked);
  const pos = slots.indexOf(from);
  if (pos < 0) return null;
  return slots[pos + direction] ?? null;
}

export function scoreAttempt(tries: number, solved: boolean): number {
  if (!solved) return 0;
  if (tries <= 1) return 100;
  if (tries === 2) return 70;
  if (tries === 3) return 40;
  return 20;
}

export function gradeFor(tries: number, solved: boolean): Grade {
  if (!solved) return 'miss';
  if (tries <= 1) return 'first';
  if (tries === 2) return 'second';
  if (tries === 3) return 'third';
  return 'fourth';
}

export function makeResult(
  events: HistoricalEvent[],
  attempts: Attempt[],
  solved: boolean,
): Result {
  const tries = attempts.length;
  return {
    events: chronological(events),
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

export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(Math.round(year)).toLocaleString('en-US')} BCE`;
  if (year < 1000) return `${Math.round(year)} CE`;
  return String(Math.round(year));
}

export function eraLabel(era: Era): string {
  if (era === 'ancient') return 'Ancient';
  if (era === 'classical') return 'Classical';
  if (era === 'early-modern') return 'Early modern';
  if (era === 'contemporary') return 'Contemporary';
  return era.slice(0, 1).toUpperCase() + era.slice(1);
}

export function shareGrid(attempts: readonly Attempt[]): string[] {
  return attempts.map((attempt) => attempt.placed.map((correct) => (correct ? '🟩' : '⬛')).join(''));
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Chronology #${puzzleNumberForDate(date)}` : 'Chronology · practice';
  return [title, ...shareGrid(result.attempts), `${result.points}/${MAX_SCORE}`];
}

export { EVENTS };

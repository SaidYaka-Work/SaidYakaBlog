import { dateSeed } from '../../../../workers/fakegpt/src/schema';
import { mulberry32, shuffle } from '../logic';
import { generateDailyPuzzles } from './puzzles';
import {
  DAILY_BANK_COUNT,
  DAILY_GEN_COUNT,
  EPOCH_DATE,
  WINDOW_DAYS,
  type BankKind,
  type BankQuestion,
} from './types';

const KIND_ORDER: BankKind[] = [
  'trivia',
  'translate',
  'math',
  'unit',
  'weekday',
  'spell',
  'unscramble',
  'order',
  'tone',
  'fill',
];

export function addUtcDays(date: string, days: number): string {
  const value = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(value)) return date;
  return new Date(value + days * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function takeMixed(available: readonly BankQuestion[], count: number, random: () => number): BankQuestion[] {
  const buckets = new Map<BankKind, BankQuestion[]>();
  for (const kind of KIND_ORDER) buckets.set(kind, []);
  for (const row of shuffle(available, random)) {
    buckets.get(row.kind)?.push(row);
  }
  const picked: BankQuestion[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (picked.length < count && guard < count * KIND_ORDER.length * 3) {
    const kind = KIND_ORDER[guard % KIND_ORDER.length];
    const next = (buckets.get(kind) ?? []).find((row) => !used.has(row.id));
    if (next) {
      used.add(next.id);
      picked.push(next);
    }
    guard += 1;
  }
  if (picked.length < count) {
    for (const row of shuffle(available, random)) {
      if (picked.length >= count) break;
      if (used.has(row.id)) continue;
      used.add(row.id);
      picked.push(row);
    }
  }
  return picked.slice(0, count);
}

export function bankPicksByDate(bank: readonly BankQuestion[], endDate: string, windowDays = WINDOW_DAYS): Map<string, string[]> {
  const start = daysBetween(EPOCH_DATE, endDate) < 0 ? endDate : EPOCH_DATE;
  const total = Math.max(0, daysBetween(start, endDate));
  const recent: string[][] = [];
  const byDate = new Map<string, string[]>();
  for (let i = 0; i <= total; i += 1) {
    const date = addUtcDays(start, i);
    const forbidden = new Set(recent.flat());
    const available = bank.filter((row) => !forbidden.has(row.id));
    const picked = takeMixed(available, DAILY_BANK_COUNT, mulberry32(dateSeed(date)));
    const ids = picked.map((row) => row.id);
    byDate.set(date, ids);
    recent.push(ids);
    if (recent.length >= windowDays) recent.shift();
  }
  return byDate;
}

export function pickBankForDate(bank: readonly BankQuestion[], date: string, windowDays = WINDOW_DAYS): BankQuestion[] {
  const ids = bankPicksByDate(bank, date, windowDays).get(date) ?? [];
  const map = new Map(bank.map((row) => [row.id, row]));
  return ids.map((id) => map.get(id)).filter((row): row is BankQuestion => Boolean(row));
}

export function usedBankIdsInWindow(bank: readonly BankQuestion[], date: string, windowDays = WINDOW_DAYS): Set<string> {
  const byDate = bankPicksByDate(bank, date, windowDays);
  const used = new Set<string>();
  for (let i = 1; i < windowDays; i += 1) {
    const prev = addUtcDays(date, -i);
    for (const id of byDate.get(prev) ?? []) used.add(id);
  }
  return used;
}

export function pickDailyQuestions(bank: readonly BankQuestion[], date: string): BankQuestion[] {
  const bankRows = pickBankForDate(bank, date);
  const generated = generateDailyPuzzles(dateSeed(date), DAILY_GEN_COUNT);
  return [...bankRows, ...generated];
}

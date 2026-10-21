import { FIGURES } from './figures';
import { GLOBE_STEPS, globeStepIndex } from './globe';
import type { DayState, Figure, GameStats, GameStatus } from './types';

export const MAX_CLUES = 6;
export const SUSPECT_POOL_SIZE = 16;
export const LAUNCH_DATE = '2026-10-21';
export const NY_TZ = 'America/New_York';
export const DAY_STORAGE_KEY = 'unknown-number-day';
export const STATS_STORAGE_KEY = 'unknown-number-stats';
export const SHARE_PATH = '/games/unknown-number';

const SHUFFLE_SEED = 20261021;

export function nyDateParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function nyCalendarDate(date: Date = new Date()): string {
  const parts = nyDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function calendarDayIndex(date: string, launch = LAUNCH_DATE): number {
  const [year, month, day] = date.split('-').map(Number);
  const [launchYear, launchMonth, launchDay] = launch.split('-').map(Number);
  const current = Date.UTC(year, month - 1, day);
  const origin = Date.UTC(launchYear, launchMonth - 1, launchDay);
  return Math.floor((current - origin) / 86_400_000);
}

export function puzzleNumberForDate(date: string): number {
  return Math.max(1, calendarDayIndex(date) + 1);
}

function mulberry32(seed: number) {
  return () => {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledIndexes(length: number, seed = SHUFFLE_SEED): number[] {
  const random = mulberry32(seed);
  const indexes = Array.from({ length }, (_, index) => index);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

const ORDER = shuffledIndexes(FIGURES.length);

export function figureForDate(date: string): Figure {
  const index = calendarDayIndex(date);
  const safe = ((index % FIGURES.length) + FIGURES.length) % FIGURES.length;
  return FIGURES[ORDER[safe]];
}

export function nextNyMidnight(date: Date = new Date()): Date {
  const today = nyCalendarDate(date);
  let low = date.getTime();
  let high = low + 36 * 60 * 60 * 1000;
  while (high - low > 250) {
    const mid = Math.floor((low + high) / 2);
    if (nyCalendarDate(new Date(mid)) === today) low = mid;
    else high = mid;
  }
  return new Date(high);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function figureNames(figure: Figure): string[] {
  return [figure.name, ...figure.aliases];
}

export function matchesFigure(guess: string, figure: Figure): boolean {
  const needle = normalizeName(guess);
  if (!needle) return false;
  return figureNames(figure).some((alias) => normalizeName(alias) === needle);
}

export function findFigureByGuess(guess: string): Figure | undefined {
  return FIGURES.find((figure) => matchesFigure(guess, figure));
}

export function filterFigureChoices(
  query: string,
  limit = 8,
  candidates: Figure[] = FIGURES,
  excluded: readonly string[] = [],
): Figure[] {
  const needle = normalizeName(query);
  if (!needle) return [];
  const blocked = new Set(excluded);
  const scored = candidates
    .filter((figure) => !blocked.has(figure.id))
    .map((figure) => {
      const names = figureNames(figure).map(normalizeName);
      const exact = names.some((name) => name === needle);
      const starts = names.some((name) => name.startsWith(needle));
      const contains = names.some((name) => name.includes(needle));
      if (!contains) return null;
      return { figure, rank: exact ? 0 : starts ? 1 : 2 };
    })
    .filter((row): row is { figure: Figure; rank: number } => row !== null);
  scored.sort((a, b) => a.rank - b.rank || a.figure.name.localeCompare(b.figure.name));
  return scored.slice(0, limit).map((row) => row.figure);
}

function fieldFamily(field: string): string {
  const value = field.toLowerCase();
  if (/physic|chemist|math|astron|comput|biolog|medic|science|invent/.test(value)) return 'science';
  if (/paint|sculpt|literatur|music|poet|drama|animat|print|perform|comic|film/.test(value)) return 'arts';
  if (/politic|lead|activ|rights|diplom|rule|philan|public/.test(value)) return 'public';
  if (/athlet|football|box|baseball|golf|gymnast|motor|swim|surf|tennis|cricket|basket/.test(value)) return 'sport';
  if (/explor|navig|aviat|space|climb|travel|pilot/.test(value)) return 'exploration';
  return 'other';
}

function geoRegion(lat: number, lng: number): string {
  if (lat > 34 && lng > -25 && lng < 40) return 'europe';
  if (lat > 8 && lng >= 25 && lng < 100) return 'west-asia';
  if (lat > -10 && lng >= 95) return 'east-asia';
  if (lat <= 36 && lat > -36 && lng > -20 && lng < 55) return 'africa';
  if (lat > 14 && lng < -50) return 'n-america';
  if (lat <= 14 && lng < -30) return 'latam';
  if (lng > 110 && lat < 0) return 'oceania';
  return 'other';
}

function birthYear(figure: Figure): number {
  const match = figure.years.match(/-?\d{3,4}/);
  return match ? Number(match[0]) : 0;
}

function takeUnique(target: Figure[], source: Figure[], count: number) {
  const have = new Set(target.map((figure) => figure.id));
  for (const figure of source) {
    if (target.length >= count) break;
    if (have.has(figure.id)) continue;
    have.add(figure.id);
    target.push(figure);
  }
}

export function suspectPool(answer: Figure, date: string, size = SUSPECT_POOL_SIZE): Figure[] {
  const seed = calendarDayIndex(date) * 409 + SHUFFLE_SEED + 17;
  const random = mulberry32(seed);
  const shuffle = <T,>(list: T[]) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const others = FIGURES.filter((figure) => figure.id !== answer.id);
  const family = fieldFamily(answer.field);
  const region = geoRegion(answer.birthplace.lat, answer.birthplace.lng);
  const year = birthYear(answer);

  const sameField = shuffle(others.filter((figure) => fieldFamily(figure.field) === family));
  const sameRegion = shuffle(
    others.filter((figure) => geoRegion(figure.birthplace.lat, figure.birthplace.lng) === region),
  );
  const sameEra = shuffle(others.filter((figure) => Math.abs(birthYear(figure) - year) <= 80));
  const diverse = shuffle(
    others.filter((figure) => {
      const otherFamily = fieldFamily(figure.field);
      const otherRegion = geoRegion(figure.birthplace.lat, figure.birthplace.lng);
      return otherFamily !== family && otherRegion !== region;
    }),
  );
  const leftover = shuffle(others);

  const picked: Figure[] = [answer];
  takeUnique(picked, sameField, Math.min(6, size));
  takeUnique(picked, sameRegion, Math.min(9, size));
  takeUnique(picked, sameEra, Math.min(12, size));
  takeUnique(picked, diverse, size);
  takeUnique(picked, leftover, size);

  return shuffle(picked).slice(0, size);
}

export function emptyStats(): GameStats {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayed: null,
    lastWon: null,
    distribution: [0, 0, 0, 0, 0, 0],
  };
}

export function winPercent(stats: GameStats): number {
  if (!stats.played) return 0;
  return Math.round((stats.wins / stats.played) * 100);
}

export function recordFinish(stats: GameStats, date: string, status: GameStatus, guesses: number): GameStats {
  if (stats.lastPlayed === date) return stats;
  const won = status === 'won';
  const continued = stats.lastPlayed !== null && calendarDayIndex(date, stats.lastPlayed) === 1;
  const currentStreak = won ? (continued ? stats.currentStreak + 1 : 1) : 0;
  const distribution = [...stats.distribution] as GameStats['distribution'];
  if (won && guesses >= 1 && guesses <= MAX_CLUES) {
    distribution[guesses - 1] += 1;
  }
  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    lastPlayed: date,
    lastWon: won ? date : stats.lastWon,
    distribution,
  };
}

export function initials(name: string): string {
  const parts = name.replace(/[()]/g, '').split(/\s+/).filter((part) => !/^(of|the|ibn|al|da|de|van|von)$/i.test(part));
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

export function licenseLabel(license: string): string {
  return license;
}

export function shareLines(
  puzzleNumber: number,
  status: GameStatus,
  guesses: number,
  options?: { globeStep?: number },
): string[] {
  const score = status === 'won' ? `${guesses}/${MAX_CLUES}` : `X/${MAX_CLUES}`;
  const bubbles = `${'💬'.repeat(status === 'won' ? guesses : MAX_CLUES)}${status === 'won' ? '✅' : '❌'}`;
  const lines = [`Unknown Number #${puzzleNumber} ${score}`, bubbles];
  if (options?.globeStep !== undefined) {
    const step = GLOBE_STEPS[globeStepIndex(options.globeStep)];
    lines.push(`🌍 ${step.id}`);
  }
  return lines;
}

export function wrongGuessCount(guesses: { correct: boolean }[]): number {
  return guesses.filter((guess) => !guess.correct).length;
}

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function buildTimestamps(count: number, now = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => {
    const offset = (count - index) * 4;
    return formatTimestamp(new Date(now.getTime() - offset * 60_000));
  });
}

export function createDayState(date: string, now = new Date()): DayState {
  const figure = figureForDate(date);
  return {
    date,
    puzzleNumber: puzzleNumberForDate(date),
    figureId: figure.id,
    guesses: [],
    revealed: 1,
    status: 'playing',
    timestamps: buildTimestamps(1, now),
    eliminated: [],
  };
}

export function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadStats(): GameStats {
  const saved = readJson<GameStats>(STATS_STORAGE_KEY);
  if (!saved) return emptyStats();
  return {
    ...emptyStats(),
    ...saved,
    distribution: [
      saved.distribution?.[0] ?? 0,
      saved.distribution?.[1] ?? 0,
      saved.distribution?.[2] ?? 0,
      saved.distribution?.[3] ?? 0,
      saved.distribution?.[4] ?? 0,
      saved.distribution?.[5] ?? 0,
    ],
  };
}

export function eliminatedIds(state: Pick<DayState, 'guesses' | 'eliminated'>): string[] {
  if (state.eliminated?.length) return [...new Set(state.eliminated)];
  return [
    ...new Set(
      state.guesses
        .filter((guess) => !guess.correct)
        .map((guess) => findFigureByGuess(guess.text)?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

export function loadDayState(today: string): DayState | null {
  const saved = readJson<DayState>(DAY_STORAGE_KEY);
  if (!saved || saved.date !== today) return null;
  const figure = figureForDate(today);
  if (saved.figureId !== figure.id) return null;
  return { ...saved, eliminated: eliminatedIds(saved) };
}

export function getFigure(id: string): Figure | undefined {
  return FIGURES.find((figure) => figure.id === id);
}

export { FIGURES };

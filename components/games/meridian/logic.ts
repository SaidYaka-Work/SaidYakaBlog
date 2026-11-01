import { CITIES } from './cities';
import type { Attempt, City, CompassPoint, Grade, LonLat, Mode, Puzzle, Region, Result, Tone } from './types';

export const MAX_TRIES = 6;
export const MAX_SCORE = 100;
export const MAX_STARS = 5;
export const EARTH_RADIUS_KM = 6371;
export const LAUNCH_DATE = '2026-11-01';
export const ROTATION_SEED = 0x4e71d1a1;
export const GREAT_CIRCLE_EXPLAINER =
  'The shortest path on Earth is a great circle — the curve where a plane through both cities and the planet’s center meets the surface — and that curve bows on this flat map even though it is the straightest route in space.';

const REGIONS: Region[] = [
  'n-america',
  's-america',
  'europe',
  'africa',
  'w-asia',
  's-asia',
  'se-asia',
  'e-asia',
  'oceania',
];

const COMPASS: CompassPoint[] = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];

const COMPASS_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const;

const TONE_EMOJI: Record<Tone, string> = {
  hit: '🟩',
  close: '🟨',
  near: '🟧',
  far: '⬛',
};

const GRADE_EMOJI: Record<Grade, string> = {
  first: '🎯',
  second: '✨',
  third: '🟢',
  fourth: '🟡',
  fifth: '🟠',
  sixth: '🌙',
  miss: '🔴',
};

const GRADE_LABEL: Record<Grade, string> = {
  first: 'First bearing',
  second: 'Second try',
  third: 'Third try',
  fourth: 'Fourth try',
  fifth: 'Fifth try',
  sixth: 'Last try',
  miss: 'Over the horizon',
};

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0x4e71d1a1) >>> 0;
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

function toRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDeg(radians: number) {
  return (radians * 180) / Math.PI;
}

export function cityPoint(city: City): LonLat {
  return { lat: city.lat, lng: city.lng };
}

export function angularDistance(a: LonLat, b: LonLat): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function greatCircleKm(a: LonLat, b: LonLat): number {
  return angularDistance(a, b) * EARTH_RADIUS_KM;
}

export function initialBearing(from: LonLat, to: LonLat): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassPoint(bearing: number): CompassPoint {
  const index = Math.round(bearing / 22.5) % COMPASS.length;
  return COMPASS[index];
}

export function bearingArrow(bearing: number): string {
  return COMPASS_ARROWS[Math.round(bearing / 45) % COMPASS_ARROWS.length];
}

export function interpolateGreatCircle(from: LonLat, to: LonLat, t: number): LonLat {
  const d = angularDistance(from, to);
  if (d < 1e-12) return from;
  const φ1 = toRad(from.lat);
  const λ1 = toRad(from.lng);
  const φ2 = toRad(to.lat);
  const λ2 = toRad(to.lng);
  const s0 = Math.sin((1 - t) * d) / Math.sin(d);
  const s1 = Math.sin(t * d) / Math.sin(d);
  const x = s0 * Math.cos(φ1) * Math.cos(λ1) + s1 * Math.cos(φ2) * Math.cos(λ2);
  const y = s0 * Math.cos(φ1) * Math.sin(λ1) + s1 * Math.cos(φ2) * Math.sin(λ2);
  const z = s0 * Math.sin(φ1) + s1 * Math.sin(φ2);
  return { lat: toDeg(Math.asin(Math.max(-1, Math.min(1, z)))), lng: toDeg(Math.atan2(y, x)) };
}

export function destinationPoint(from: LonLat, bearing: number, km: number): LonLat {
  const δ = km / EARTH_RADIUS_KM;
  const θ = toRad(bearing);
  const φ1 = toRad(from.lat);
  const λ1 = toRad(from.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

/** A short geodesic that shows curvature without reaching the hidden city. */
export function headingArcKm(distanceKm: number): number {
  if (distanceKm <= 1) return 0;
  return Math.max(280, Math.min(distanceKm * 0.38, 4000));
}

export function greatCirclePath(from: LonLat, to: LonLat, steps = 64): LonLat[] {
  const points: LonLat[] = [];
  for (let i = 0; i <= steps; i += 1) {
    points.push(interpolateGreatCircle(from, to, i / steps));
  }
  return points;
}

export function headingPath(from: LonLat, bearing: number, km: number, steps = 28): LonLat[] {
  if (km <= 1) return [from];
  return greatCirclePath(from, destinationPoint(from, bearing, km), steps);
}

export function guessTone(km: number, hit: boolean): Tone {
  if (hit) return 'hit';
  if (km <= 500) return 'close';
  if (km <= 2000) return 'near';
  return 'far';
}

export function formatKm(km: number): string {
  if (km < 0.5) return '0 km';
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

export function formatBearing(bearing: number): string {
  return `${String(Math.round(bearing) % 360).padStart(3, '0')}°`;
}

export function formatCoords(city: City): string {
  const latHem = city.lat >= 0 ? 'N' : 'S';
  const lngHem = city.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(city.lat).toFixed(2)}°${latHem} ${Math.abs(city.lng).toFixed(2)}°${lngHem}`;
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function cityNames(city: City): string[] {
  return [city.name, city.country, `${city.name} ${city.country}`, ...(city.aliases ?? [])];
}

export function matchesCity(query: string, city: City): boolean {
  const needle = normalizeName(query);
  if (!needle) return false;
  return cityNames(city).some((alias) => normalizeName(alias) === needle);
}

export function findCityByGuess(query: string, pool: readonly City[] = CITIES): City | undefined {
  const exact = pool.find((city) => matchesCity(query, city));
  if (exact) return exact;
  const choices = filterCityChoices(query, 1, pool);
  return choices[0];
}

export function filterCityChoices(
  query: string,
  limit = 8,
  pool: readonly City[] = CITIES,
  excluded: readonly string[] = [],
): City[] {
  const needle = normalizeName(query);
  if (!needle) return [];
  const blocked = new Set(excluded);
  const scored = pool
    .filter((city) => !blocked.has(city.id))
    .map((city) => {
      const names = cityNames(city).map(normalizeName);
      const exact = names.some((name) => name === needle);
      const starts = names.some((name) => name.startsWith(needle));
      const contains = names.some((name) => name.includes(needle));
      if (!contains) return null;
      return { city, rank: exact ? 0 : starts ? 1 : 2 };
    })
    .filter((row): row is { city: City; rank: number } => row !== null);
  scored.sort((a, b) => a.rank - b.rank || a.city.name.localeCompare(b.city.name));
  return scored.slice(0, limit).map((row) => row.city);
}

function validateBank(cities: readonly City[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  const byRegion = new Map<Region, number>();
  for (const region of REGIONS) byRegion.set(region, 0);

  for (const city of cities) {
    if (ids.has(city.id)) throw new Error(`Meridian: duplicate id ${city.id}`);
    ids.add(city.id);
    const nameKey = normalizeName(city.name);
    if (names.has(nameKey)) throw new Error(`Meridian: duplicate name ${city.name}`);
    names.add(nameKey);
    if (!Number.isFinite(city.lat) || city.lat < -90 || city.lat > 90) {
      throw new Error(`Meridian: ${city.id} has a bad latitude`);
    }
    if (!Number.isFinite(city.lng) || city.lng < -180 || city.lng > 180) {
      throw new Error(`Meridian: ${city.id} has a bad longitude`);
    }
    if (city.fact.trim().length < 40) throw new Error(`Meridian: ${city.id} fact is too short`);
    if (!REGIONS.includes(city.region)) throw new Error(`Meridian: ${city.id} has unknown region`);
    byRegion.set(city.region, (byRegion.get(city.region) ?? 0) + 1);
  }

  if (cities.length < 80) {
    throw new Error(`Meridian: bank has ${cities.length} cities; need at least 80`);
  }
  for (const region of REGIONS) {
    const count = byRegion.get(region) ?? 0;
    if (count < 6) throw new Error(`Meridian: region ${region} has only ${count} cities`);
  }
}

validateBank(CITIES);

export function rotationOrder(cities: readonly City[] = CITIES): City[] {
  const random = mulberry32(ROTATION_SEED);
  const buckets = new Map<Region, City[]>();
  for (const region of REGIONS) buckets.set(region, []);
  for (const city of cities) buckets.get(city.region)?.push(city);
  buckets.forEach((list, region) => {
    buckets.set(region, shuffle(list, random));
  });

  const order: City[] = [];
  let last: Region | null = null;
  const leftover = (): Region[] => REGIONS.filter((region) => (buckets.get(region)?.length ?? 0) > 0);

  while (leftover().length) {
    const options = leftover();
    const preferred: Region[] = last ? options.filter((region) => region !== last) : options;
    const pool: Region[] = preferred.length ? preferred : options;
    const region: Region = pool[Math.floor(random() * pool.length)];
    const city = buckets.get(region)?.shift();
    if (!city) break;
    order.push(city);
    last = region;
  }
  return order;
}

const ORDER = rotationOrder();

export function dailyCity(date = utcDate()): City {
  const index = calendarDayIndex(date);
  const wrapped = ((index % ORDER.length) + ORDER.length) % ORDER.length;
  return ORDER[wrapped];
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  const city = dailyCity(date);
  return { id: city.id, city };
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000), date = utcDate()): Puzzle {
  const today = dailyCity(date);
  const pool = CITIES.filter((city) => city.id !== today.id);
  const random = mulberry32(seed);
  const city = pool[Math.floor(random() * pool.length)] ?? today;
  return { id: city.id, city };
}

export function makeAttempt(guess: City, target: City): Attempt {
  const from = cityPoint(guess);
  const to = cityPoint(target);
  const km = greatCircleKm(from, to);
  const bearing = initialBearing(from, to);
  return {
    city: guess,
    km,
    bearing,
    point: compassPoint(bearing),
    tone: guessTone(km, guess.id === target.id),
  };
}

export function scoreAttempt(tries: number, solved: boolean): number {
  if (!solved) return 0;
  if (tries <= 1) return 100;
  if (tries === 2) return 80;
  if (tries === 3) return 65;
  if (tries === 4) return 50;
  if (tries === 5) return 35;
  return 20;
}

export function starsFor(tries: number, solved: boolean): number {
  if (!solved) return 0;
  if (tries <= 1) return 5;
  if (tries === 2) return 4;
  if (tries === 3) return 4;
  if (tries === 4) return 3;
  if (tries === 5) return 2;
  return 1;
}

export function starLabel(stars: number): string {
  return `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, MAX_STARS - stars))}`;
}

export function gradeFor(tries: number, solved: boolean): Grade {
  if (!solved) return 'miss';
  if (tries <= 1) return 'first';
  if (tries === 2) return 'second';
  if (tries === 3) return 'third';
  if (tries === 4) return 'fourth';
  if (tries === 5) return 'fifth';
  return 'sixth';
}

export function makeResult(puzzle: Puzzle, attempts: Attempt[], solved: boolean): Result {
  const tries = attempts.length;
  return {
    puzzle,
    attempts,
    solved,
    tries,
    points: scoreAttempt(tries, solved),
    stars: starsFor(tries, solved),
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
  return attempts
    .map((attempt) =>
      attempt.tone === 'hit' ? '🟩' : `${toneEmoji(attempt.tone)}${bearingArrow(attempt.bearing)}`,
    )
    .join('');
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Meridian #${puzzleNumberForDate(date)}` : 'Meridian · practice';
  const tries = result.solved ? `${result.tries}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
  return [title, shareGrid(result.attempts), `${starLabel(result.stars)} · ${tries} · ${result.points}/${MAX_SCORE}`];
}

export { CITIES, COMPASS, REGIONS };

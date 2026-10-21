/**
 * Anonymous daily puzzle totals for Unknown Number.
 * Isolated from the dog room: own Durable Object, own keys, own alarm.
 *
 * Counts live in memory. SQLite is written only when dirty, at most once
 * every FLUSH_MS, one row per day key. Alarms are scheduled only if dirty.
 * No cookies, IPs, or player identifiers are persisted.
 */

import { originAllowed } from './logic';

export const DAILY_FLUSH_MS = 60_000;
export const DAILY_GAME = 'unknown-number';
export const DAILY_LAUNCH = '2026-10-21';
export const DAILY_TZ = 'America/New_York';
export const RATE_WINDOW_MS = 60_000;
export const RATE_MAX = 8;

export type ResultKey = '1' | '2' | '3' | '4' | '5' | '6' | 'X';

export type DayCounts = {
  played: number;
  solved: number;
  distribution: Record<ResultKey, number>;
};

export type DailyEnv = {
  DAILY: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
};

export function emptyCounts(): DayCounts {
  return {
    played: 0,
    solved: 0,
    distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, X: 0 },
  };
}

export function cloneCounts(counts: DayCounts): DayCounts {
  return {
    played: counts.played,
    solved: counts.solved,
    distribution: { ...counts.distribution },
  };
}

export function parseResult(value: unknown): ResultKey | null {
  if (value === 'X' || value === 'x') return 'X';
  if (value === 1 || value === '1') return '1';
  if (value === 2 || value === '2') return '2';
  if (value === 3 || value === '3') return '3';
  if (value === 4 || value === '4') return '4';
  if (value === 5 || value === '5') return '5';
  if (value === 6 || value === '6') return '6';
  return null;
}

export function parseDay(value: unknown): number | null {
  const day = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(day) || day < 1 || day > 100_000) return null;
  return day;
}

export function nyCalendarDate(now: number, timeZone = DAILY_TZ): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(now))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function puzzleNumberAt(now: number, launch = DAILY_LAUNCH): number {
  const [year, month, day] = nyCalendarDate(now).split('-').map(Number);
  const [launchYear, launchMonth, launchDay] = launch.split('-').map(Number);
  const index = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(launchYear, launchMonth - 1, launchDay)) / 86_400_000);
  return Math.max(1, index + 1);
}

export function dayAllowed(day: number, now: number): boolean {
  return Math.abs(day - puzzleNumberAt(now)) <= 1;
}

export type RateBucket = { count: number; windowStart: number };

export function takeDailyRate(
  bucket: RateBucket | undefined,
  now: number,
): { ok: true; bucket: RateBucket } | { ok: false; bucket: RateBucket; retryAfterMs: number } {
  const current = bucket ?? { count: 0, windowStart: now };
  const windowStart = now - current.windowStart > RATE_WINDOW_MS ? now : current.windowStart;
  const count = windowStart === current.windowStart ? current.count + 1 : 1;
  if (count > RATE_MAX) {
    return {
      ok: false,
      bucket: { count: current.count, windowStart },
      retryAfterMs: Math.max(0, RATE_WINDOW_MS - (now - windowStart)),
    };
  }
  return { ok: true, bucket: { count, windowStart } };
}

export function dayKey(day: number): string {
  return `day:${day}`;
}

export class DailyStore {
  readonly counts = new Map<number, DayCounts>();
  readonly dirty = new Set<number>();
  lastFlushAt = 0;
  alarmAt: number | null = null;

  hydrate(day: number, saved: DayCounts | undefined) {
    if (this.counts.has(day)) return;
    this.counts.set(day, saved ? cloneCounts(saved) : emptyCounts());
  }

  record(day: number, result: ResultKey) {
    const current = this.counts.get(day) ?? emptyCounts();
    current.played += 1;
    if (result !== 'X') current.solved += 1;
    current.distribution[result] += 1;
    this.counts.set(day, current);
    this.dirty.add(day);
  }

  stats(day: number): DayCounts {
    return cloneCounts(this.counts.get(day) ?? emptyCounts());
  }

  pendingDays(now: number, force = false): number[] {
    if (!this.dirty.size) return [];
    if (!force && (this.lastFlushAt === 0 || now - this.lastFlushAt < DAILY_FLUSH_MS)) return [];
    return [...this.dirty];
  }

  markFlushed(days: number[], now: number) {
    for (const day of days) this.dirty.delete(day);
    this.lastFlushAt = now;
    if (!this.dirty.size) this.alarmAt = null;
  }

  needsAlarm(now: number): boolean {
    return this.dirty.size > 0 && (this.alarmAt === null || this.alarmAt <= now);
  }

  scheduleAlarm(now: number): number {
    this.alarmAt = now + DAILY_FLUSH_MS;
    return this.alarmAt;
  }
}

export type DailyStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  getAlarm(): Promise<number | null | undefined>;
  setAlarm(at: number): Promise<void>;
};

export class MemoryDailyStorage implements DailyStorage {
  map = new Map<string, unknown>();
  writes = 0;
  alarms = 0;
  alarmAt: number | null = null;

  async get<T>(key: string) {
    return this.map.get(key) as T | undefined;
  }

  async put(key: string, value: unknown) {
    this.writes += 1;
    this.map.set(key, value);
  }

  async getAlarm() {
    return this.alarmAt;
  }

  async setAlarm(at: number) {
    this.alarms += 1;
    this.alarmAt = at;
  }
}

export async function loadDay(store: DailyStore, storage: DailyStorage, day: number): Promise<void> {
  if (store.counts.has(day)) return;
  store.hydrate(day, await storage.get<DayCounts>(dayKey(day)));
}

export async function flushDirty(
  store: DailyStore,
  storage: DailyStorage,
  now: number,
  force = false,
): Promise<number> {
  const days = store.pendingDays(now, force);
  for (const day of days) {
    const counts = store.counts.get(day);
    if (!counts) continue;
    await storage.put(dayKey(day), cloneCounts(counts));
  }
  if (days.length) store.markFlushed(days, now);
  return days.length;
}

export async function scheduleIfDirty(store: DailyStore, storage: DailyStorage, now: number): Promise<boolean> {
  if (!store.needsAlarm(now)) return false;
  const existing = await storage.getAlarm();
  if (existing && existing > now) {
    store.alarmAt = existing;
    return false;
  }
  const at = store.scheduleAlarm(now);
  await storage.setAlarm(at);
  return true;
}

function corsHeaders(origin: string | null, env: { ALLOWED_ORIGINS?: string }): HeadersInit {
  const allowed = origin && originAllowed(origin, env.ALLOWED_ORIGINS) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null, env: { ALLOWED_ORIGINS?: string }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin, env),
      'Content-Type': 'application/json',
    },
  });
}

export class DailyStats {
  private readonly store = new DailyStore();
  private readonly rates = new Map<string, RateBucket>();
  private readonly ready: Promise<void>;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: DailyEnv,
  ) {
    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      const alarm = await this.ctx.storage.getAlarm();
      this.store.alarmAt = alarm ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, this.env) });
    }

    if (origin && !originAllowed(origin, this.env.ALLOWED_ORIGINS)) {
      return new Response('origin not allowed', { status: 403 });
    }

    if (url.pathname !== `/daily/${DAILY_GAME}/stats` && url.pathname !== `/daily/${DAILY_GAME}/result`) {
      return json({ error: 'not_found' }, 404, origin, this.env);
    }

    const now = Date.now();
    const storage = this.storage();

    if (request.method === 'GET' && url.pathname.endsWith('/stats')) {
      const day = parseDay(url.searchParams.get('day'));
      if (day === null || !dayAllowed(day, now)) {
        return json({ error: 'invalid' }, 400, origin, this.env);
      }
      await loadDay(this.store, storage, day);
      return json(this.store.stats(day), 200, origin, this.env);
    }

    if (request.method === 'POST' && url.pathname.endsWith('/result')) {
      if (!origin) return json({ error: 'origin' }, 403, origin, this.env);
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '0.0.0.0';
      const limited = takeDailyRate(this.rates.get(ip), now);
      this.rates.set(ip, limited.bucket);
      if (!limited.ok) {
        return json({ error: 'rate_limited', retryAfterMs: limited.retryAfterMs }, 429, origin, this.env);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid' }, 400, origin, this.env);
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json({ error: 'invalid' }, 400, origin, this.env);
      }
      const record = body as Record<string, unknown>;
      if (Object.keys(record).some((key) => key !== 'day' && key !== 'result')) {
        return json({ error: 'invalid' }, 400, origin, this.env);
      }
      const day = parseDay(record.day);
      const result = parseResult(record.result);
      if (day === null || result === null || !dayAllowed(day, now)) {
        return json({ error: 'invalid' }, 400, origin, this.env);
      }
      await loadDay(this.store, storage, day);
      this.store.record(day, result);
      await scheduleIfDirty(this.store, storage, now);
      return json({ ok: true }, 200, origin, this.env);
    }

    return json({ error: 'method' }, 405, origin, this.env);
  }

  async alarm(): Promise<void> {
    await this.ready;
    const now = Date.now();
    await flushDirty(this.store, this.storage(), now, true);
    if (this.store.dirty.size) await scheduleIfDirty(this.store, this.storage(), now);
  }

  private storage(): DailyStorage {
    return {
      get: (key) => this.ctx.storage.get(key),
      put: (key, value) => this.ctx.storage.put(key, value),
      getAlarm: () => this.ctx.storage.getAlarm(),
      setAlarm: (at) => this.ctx.storage.setAlarm(at),
    };
  }
}

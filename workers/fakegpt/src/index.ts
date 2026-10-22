import { chatTurn, generateDailySet, gradeTyped, judgeRound, logAiFailure, todayOr, type AiRunner } from './ai';
import { kvGetJson, kvPutJson, takeBudget, takeWindow, type Counter, type KVNamespace } from './budget';
import { fallbackDailySet } from './fallback';
import {
  AI_DAILY_CACHE_TTL_SEC,
  AI_TIMEOUT_MS_CRON,
  AI_TIMEOUT_MS_DAILY,
  DAILY_GENERATE_ATTEMPTS_MAX,
  DAILY_GENERATE_BACKOFF_MS,
  DAILY_GENERATE_LOCK_MS,
  DAILY_GENERATE_SPEND,
  dailyAttemptKey,
  dailyCacheKey,
  dailyCacheTtlSec,
  dailyLockKey,
  GLOBAL_AI_CALLS_PER_DAY,
  IP_CHAT_PER_HOUR,
  IP_DAILY_GET_PER_HOUR,
  IP_GRADE_PER_HOUR,
  IP_JUDGE_PER_HOUR,
} from './models';
import { clientIp, parseChatRequest, parseGradeRequest, parseJudgeRequest, type DailySet, utcDate } from './schema';

export type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

export type Env = {
  AI?: AiRunner;
  FAKEGPT?: KVNamespace;
  ALLOWED_ORIGINS?: string;
};

const HOUR = 60 * 60 * 1000;
const BUDGET_TTL_SEC = 26 * 60 * 60;

const ALLOWED_DEFAULTS = [
  'https://saidyaka.com',
  'https://www.saidyaka.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
];

export function originAllowed(origin: string | null, rawAllowlist?: string) {
  if (!origin) return false;
  const extra = (rawAllowlist || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set([...ALLOWED_DEFAULTS, ...extra]).has(origin);
}

function cors(origin: string | null, env: Env, extra?: HeadersInit): Headers {
  const allowed = origin && originAllowed(origin, env.ALLOWED_ORIGINS) ? origin : '';
  const headers = new Headers(extra);
  if (allowed) headers.set('Access-Control-Allow-Origin', allowed);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Vary', 'Origin');
  return headers;
}

function json(body: unknown, status: number, origin: string | null, env: Env, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(origin, env, {
      'Content-Type': 'application/json',
      'Cache-Control': cache,
    }),
  });
}

async function limited(env: Env, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const current = await kvGetJson<Counter>(env.FAKEGPT, key);
  const taken = takeWindow(current ?? undefined, now, limit, windowMs);
  await kvPutJson(env.FAKEGPT, key, taken.next, Math.ceil(windowMs / 1000) + 30);
  return taken.ok;
}

async function spend(env: Env, date: string, cost: number): Promise<boolean> {
  const key = `budget:${date}`;
  const used = (await kvGetJson<{ used: number }>(env.FAKEGPT, key))?.used ?? 0;
  const next = takeBudget(used, cost, GLOBAL_AI_CALLS_PER_DAY);
  if (!next.ok) return false;
  await kvPutJson(env.FAKEGPT, key, { used: next.used }, BUDGET_TTL_SEC);
  return true;
}

export type AttemptMarker = {
  count: number;
  at: number;
};

export type GenerationClaim = {
  claimed: boolean;
  attempts: number;
  reason?: 'have-ai' | 'locked' | 'backoff' | 'capped';
};

export type GenerateAndCacheOpts = {
  claimed?: boolean;
  now?: number;
};

export type DailySetOpts = {
  /** Serve a fallback immediately and generate in the background. */
  waitUntil?: (promise: Promise<unknown>) => void;
  timeoutMs?: number;
  now?: number;
};

export function dailyAiCount(set: DailySet | null | undefined): number {
  if (!set) return 0;
  if (typeof set.aiCount === 'number' && Number.isFinite(set.aiCount)) {
    return Math.max(0, Math.round(set.aiCount));
  }
  return set.source === 'ai' ? set.rounds.length : 0;
}

export function pickBetterDailySet(cached: DailySet | null | undefined, next: DailySet): DailySet {
  if (!cached?.rounds?.length) return next;
  if (dailyAiCount(next) > dailyAiCount(cached)) return next;
  if (next.source === 'ai' && cached.source !== 'ai') return next;
  return cached;
}

async function readAttempt(env: Env, date: string): Promise<AttemptMarker> {
  const raw = await kvGetJson<AttemptMarker>(env.FAKEGPT, dailyAttemptKey(date));
  const count = typeof raw?.count === 'number' && Number.isFinite(raw.count) ? Math.max(0, Math.round(raw.count)) : 0;
  const at = typeof raw?.at === 'number' && Number.isFinite(raw.at) ? raw.at : 0;
  return { count, at };
}

export type LockMarker = {
  id: string;
  at: number;
};

function newLockId(now: number): string {
  const unique = globalThis.crypto?.randomUUID?.() ?? `lock-${now}-${Math.random().toString(36).slice(2)}`;
  return unique;
}

function lockIsHeld(lock: LockMarker | { at?: number; id?: string } | null, now: number): boolean {
  if (!lock || typeof lock.at !== 'number' || lock.at <= 0) return false;
  return now - lock.at < DAILY_GENERATE_LOCK_MS;
}

export async function clearGenerationLock(env: Env, date: string): Promise<void> {
  await kvPutJson(env.FAKEGPT, dailyLockKey(date), { id: '', at: 0 }, 60);
}

export async function claimGeneration(
  env: Env,
  date: string,
  opts: { now?: number; owner?: string } = {},
): Promise<GenerationClaim> {
  const now = opts.now ?? Date.now();
  const owner = opts.owner ?? newLockId(now);
  const cached = await kvGetJson<DailySet>(env.FAKEGPT, dailyCacheKey(date));
  const attempts = await readAttempt(env, date);
  if (cached?.rounds?.length && cached.source === 'ai') {
    return { claimed: false, attempts: attempts.count, reason: 'have-ai' };
  }

  const lock = await kvGetJson<LockMarker>(env.FAKEGPT, dailyLockKey(date));
  if (lockIsHeld(lock, now)) {
    return { claimed: false, attempts: attempts.count, reason: 'locked' };
  }
  if (attempts.count >= DAILY_GENERATE_ATTEMPTS_MAX) {
    return { claimed: false, attempts: attempts.count, reason: 'capped' };
  }
  if (attempts.at > 0 && now - attempts.at < DAILY_GENERATE_BACKOFF_MS) {
    return { claimed: false, attempts: attempts.count, reason: 'backoff' };
  }

  await kvPutJson(env.FAKEGPT, dailyLockKey(date), { id: owner, at: now }, Math.ceil(DAILY_GENERATE_LOCK_MS / 1000) + 30);
  const confirm = await kvGetJson<LockMarker>(env.FAKEGPT, dailyLockKey(date));
  if (confirm?.id !== owner) {
    return { claimed: false, attempts: attempts.count, reason: 'locked' };
  }

  const latestCache = await kvGetJson<DailySet>(env.FAKEGPT, dailyCacheKey(date));
  if (latestCache?.rounds?.length && latestCache.source === 'ai') {
    await clearGenerationLock(env, date);
    return { claimed: false, attempts: attempts.count, reason: 'have-ai' };
  }
  const latestAttempt = await readAttempt(env, date);
  if (latestAttempt.count >= DAILY_GENERATE_ATTEMPTS_MAX) {
    await clearGenerationLock(env, date);
    return { claimed: false, attempts: latestAttempt.count, reason: 'capped' };
  }
  if (latestAttempt.at > 0 && now - latestAttempt.at < DAILY_GENERATE_BACKOFF_MS) {
    await clearGenerationLock(env, date);
    return { claimed: false, attempts: latestAttempt.count, reason: 'backoff' };
  }

  const next = { count: latestAttempt.count + 1, at: now };
  await kvPutJson(env.FAKEGPT, dailyAttemptKey(date), next, AI_DAILY_CACHE_TTL_SEC);
  return { claimed: true, attempts: next.count };
}

export async function commitDailySet(env: Env, date: string, generated: DailySet): Promise<DailySet> {
  const key = dailyCacheKey(date);
  const latest = await kvGetJson<DailySet>(env.FAKEGPT, key);
  const next = pickBetterDailySet(latest, generated);
  await kvPutJson(env.FAKEGPT, key, next, dailyCacheTtlSec(next.source, dailyAiCount(next)));
  return next;
}

export async function generateAndCache(
  env: Env,
  date: string,
  timeoutMs = AI_TIMEOUT_MS_CRON,
  opts: GenerateAndCacheOpts = {},
): Promise<DailySet> {
  const now = opts.now ?? Date.now();
  if (!opts.claimed) {
    const claim = await claimGeneration(env, date, { now });
    if (!claim.claimed) {
      const cached = await kvGetJson<DailySet>(env.FAKEGPT, dailyCacheKey(date));
      return cached?.rounds?.length ? cached : fallbackDailySet(date);
    }
  }

  try {
    const generated = (await spend(env, date, DAILY_GENERATE_SPEND))
      ? await generateDailySet(env.AI, date, { timeoutMs })
      : fallbackDailySet(date);
    return commitDailySet(env, date, generated);
  } finally {
    await clearGenerationLock(env, date);
  }
}

export async function dailySet(env: Env, date: string, opts: DailySetOpts = {}): Promise<DailySet> {
  const now = opts.now ?? Date.now();
  const key = dailyCacheKey(date);
  const cached = await kvGetJson<DailySet>(env.FAKEGPT, key);
  if (cached?.rounds?.length && cached.source === 'ai') return cached;

  if (opts.waitUntil) {
    const fallback = cached?.rounds?.length ? cached : fallbackDailySet(date);
    if (!cached?.rounds?.length) {
      await kvPutJson(env.FAKEGPT, key, fallback, dailyCacheTtlSec(fallback.source, dailyAiCount(fallback)));
    }
    const claim = await claimGeneration(env, date, { now });
    if (claim.claimed) {
      opts.waitUntil(
        generateAndCache(env, date, opts.timeoutMs ?? AI_TIMEOUT_MS_DAILY, { claimed: true, now }).catch((error) => {
          logAiFailure('daily-bg', error);
        }),
      );
    }
    return fallback;
  }

  const claim = await claimGeneration(env, date, { now });
  if (!claim.claimed) {
    return cached?.rounds?.length ? cached : fallbackDailySet(date);
  }
  return generateAndCache(env, date, opts.timeoutMs ?? AI_TIMEOUT_MS_CRON, { claimed: true, now });
}

async function readJson(request: Request): Promise<unknown> {
  return request.json();
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContextLike): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin, env) });
    }

    if (url.pathname === '/health') {
      return new Response('ok', { headers: cors(origin, env) });
    }

    if (origin && !originAllowed(origin, env.ALLOWED_ORIGINS)) {
      return new Response('origin not allowed', { status: 403, headers: cors(origin, env) });
    }

    const ip = clientIp(request).replace(/[^a-z0-9.:-]/gi, '').slice(0, 64) || 'local';
    const date = todayOr(url.searchParams.get('date'));

    if (request.method === 'GET' && url.pathname === '/daily') {
      if (!(await limited(env, `rl:daily:${date}:${ip}`, IP_DAILY_GET_PER_HOUR, HOUR))) {
        return json({ error: 'rate' }, 429, origin, env);
      }
      const set = await dailySet(env, date, {
        waitUntil: (promise) => {
          if (ctx?.waitUntil) ctx.waitUntil(promise);
        },
      });
      return json(set, 200, origin, env, 'public, max-age=60');
    }

    if (request.method === 'POST' && url.pathname === '/judge') {
      if (!(await limited(env, `rl:judge:${date}:${ip}`, IP_JUDGE_PER_HOUR, HOUR))) {
        return json({ error: 'rate', fallback: true }, 429, origin, env);
      }
      let parsed;
      try {
        parsed = parseJudgeRequest(await readJson(request));
      } catch {
        return json({ error: 'invalid' }, 400, origin, env);
      }
      if (!parsed.ok) return json({ error: parsed.error }, 400, origin, env);
      if (!(await spend(env, parsed.value.date, parsed.value.kind === 'draw' ? 2 : 2))) {
        return json({ fallback: true, reason: 'budget' }, 200, origin, env);
      }
      const result = await judgeRound(env.AI, parsed.value);
      return json(result, 200, origin, env);
    }

    if (request.method === 'POST' && url.pathname === '/grade') {
      if (!(await limited(env, `rl:grade:${date}:${ip}`, IP_GRADE_PER_HOUR, HOUR))) {
        return json({ error: 'rate', fallback: true, correct: false }, 429, origin, env);
      }
      let parsed;
      try {
        parsed = parseGradeRequest(await readJson(request));
      } catch {
        return json({ error: 'invalid' }, 400, origin, env);
      }
      if (!parsed.ok) return json({ error: parsed.error }, 400, origin, env);
      if (!(await spend(env, parsed.value.date, 1))) {
        return json({ fallback: true, correct: false, reason: 'budget' }, 200, origin, env);
      }
      const result = await gradeTyped(env.AI, parsed.value);
      return json(result, 200, origin, env);
    }

    if (request.method === 'POST' && url.pathname === '/chat') {
      if (!(await limited(env, `rl:chat:${date}:${ip}`, IP_CHAT_PER_HOUR, HOUR))) {
        return json({ error: 'rate', fallback: true }, 429, origin, env);
      }
      let parsed;
      try {
        parsed = parseChatRequest(await readJson(request));
      } catch {
        return json({ error: 'invalid' }, 400, origin, env);
      }
      if (!parsed.ok) return json({ error: parsed.error }, 400, origin, env);
      if (!(await spend(env, parsed.value.date, 1))) {
        return json({ fallback: true, messages: ['budget says go offline.'] }, 200, origin, env);
      }
      const result = await chatTurn(env.AI, parsed.value);
      return json(result, 200, origin, env);
    }

    return new Response('not found', { status: 404, headers: cors(origin, env) });
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    const date = utcDate();
    await dailySet(env, date, { timeoutMs: AI_TIMEOUT_MS_CRON });
  },
};

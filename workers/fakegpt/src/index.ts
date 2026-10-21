import { chatTurn, generateDailySet, judgeRound, todayOr, type AiRunner } from './ai';
import { kvGetJson, kvPutJson, takeBudget, takeWindow, type Counter, type KVNamespace } from './budget';
import { fallbackDailySet } from './fallback';
import { GLOBAL_AI_CALLS_PER_DAY, IP_CHAT_PER_HOUR, IP_DAILY_GET_PER_HOUR, IP_JUDGE_PER_HOUR } from './models';
import { clientIp, parseChatRequest, parseJudgeRequest, utcDate } from './schema';

export type Env = {
  AI?: AiRunner;
  FAKEGPT?: KVNamespace;
  ALLOWED_ORIGINS?: string;
};

const HOUR = 60 * 60 * 1000;
const DAY = 26 * 60 * 60;

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
  await kvPutJson(env.FAKEGPT, key, { used: next.used }, DAY);
  return true;
}

async function dailySet(env: Env, date: string) {
  const key = `daily:${date}`;
  const cached = await kvGetJson<ReturnType<typeof fallbackDailySet>>(env.FAKEGPT, key);
  if (cached?.rounds?.length) return cached;
  const generated = (await spend(env, date, 1)) ? await generateDailySet(env.AI, date) : fallbackDailySet(date);
  await kvPutJson(env.FAKEGPT, key, generated, DAY);
  return generated;
}

async function readJson(request: Request): Promise<unknown> {
  return request.json();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
      const set = await dailySet(env, date);
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
    await dailySet(env, date);
  },
};

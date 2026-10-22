import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  claimGeneration,
  dailyAiCount,
  dailySet,
  generateAndCache,
  pickBetterDailySet,
  type Env,
} from '../src/index.ts';
import { fallbackDailySet, fillDailySet } from '../src/fallback.ts';
import {
  AI_DAILY_CACHE_TTL_SEC,
  DAILY_CACHE_KEY_PREFIX,
  DAILY_GENERATE_ATTEMPTS_MAX,
  DAILY_GENERATE_BACKOFF_MS,
  DAILY_GENERATE_LOCK_MS,
  DAILY_GENERATE_SPEND,
  DAILY_TASK_BATCHES,
  DAILY_TASKS_PER_BATCH,
  FALLBACK_DAILY_CACHE_TTL_SEC,
  TEXT_MAX_TOKENS_PERSONAS,
  TEXT_MAX_TOKENS_VERIFY,
  dailyAttemptKey,
  dailyCacheKey,
  dailyCacheTtlSec,
  dailyLockKey,
  dailySourceFor,
} from '../src/models.ts';
import type { DailyRound, DailySet } from '../src/schema.ts';
import { filterAiRounds } from '../src/validators.ts';

function userText(input: Record<string, unknown>): string {
  const messages = input.messages as Array<{ role?: string; content?: string }> | undefined;
  return messages?.find((row) => row.role === 'user')?.content ?? '';
}

function harvestRounds(valid: DailySet): DailySet['rounds'] {
  const need = DAILY_TASK_BATCHES * DAILY_TASKS_PER_BATCH;
  const passing = filterAiRounds(valid.rounds);
  if (passing.length >= need) return passing.slice(0, need);
  const extra = Array.from({ length: need }, (_, index) => ({
    ...valid.rounds[index % valid.rounds.length],
    id: `ok${index + 1}`,
    kind: 'typed' as const,
    text: `what do honeybees make for us number ${index + 1} now`,
    answer: `honey${index + 1}`,
    aliases: [],
    options: [],
    category: 'animals',
  }));
  return filterAiRounds([...passing, ...extra]).slice(0, need);
}

function roundsForBatch(valid: DailySet, input: Record<string, unknown>) {
  const hit = userText(input).match(/batch (\d+)/i);
  const batch = hit ? Number(hit[1]) - 1 : 0;
  return harvestRounds(valid).slice(batch * DAILY_TASKS_PER_BATCH, batch * DAILY_TASKS_PER_BATCH + DAILY_TASKS_PER_BATCH);
}

function aiThatReturns(valid: ReturnType<typeof fallbackDailySet>) {
  return {
    async run(_name: string, input: Record<string, unknown>) {
      const max = Number(input.max_tokens);
      if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
      if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
      return { response: { rounds: roundsForBatch(valid, input) } };
    },
  };
}

function goodAiRounds(n: number): DailyRound[] {
  return Array.from({ length: n }, (_, index) => ({
    id: `ai${index + 1}`,
    kind: 'typed' as const,
    text: `what do honeybees make for us number ${index + 1} now`,
    persona: 'Dana',
    vibe: 'late',
    category: 'animals',
    difficulty: 1 as const,
    answer: `honey${index + 1}`,
    aliases: [],
    options: [],
    nudges: ['hello??'],
    good: 'ok',
    bad: `that's a hallucination, buddy. it's honey${index + 1}.`,
  }));
}

function aiThatEmits(rounds: DailyRound[]) {
  return {
    async run(_name: string, input: Record<string, unknown>) {
      const max = Number(input.max_tokens);
      if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: [{ id: 'dana', name: 'Dana', vibe: 'late' }] } };
      if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: rounds.map((row) => row.id), drop: [] } };
      const hit = userText(input).match(/batch (\d+)/i);
      const batch = hit ? Number(hit[1]) - 1 : 0;
      return { response: { rounds: batch === 0 ? rounds : [] } };
    },
  };
}

function memoryKv(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  const puts: Array<{ key: string; ttl: number; source?: string; aiCount?: number }> = [];
  return {
    store,
    puts,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      store.set(key, value);
      const parsed = JSON.parse(value) as { source?: string; aiCount?: number };
      puts.push({ key, ttl: options?.expirationTtl ?? 0, source: parsed.source, aiCount: parsed.aiCount });
    },
  };
}

function budgetUsed(kv: ReturnType<typeof memoryKv>, date: string): number {
  const raw = kv.store.get(`budget:${date}`);
  if (!raw) return 0;
  return (JSON.parse(raw) as { used?: number }).used ?? 0;
}

test('dailyCacheTtlSec keeps AI sets for a day and fallbacks for a few minutes', () => {
  assert.equal(dailyCacheTtlSec('ai'), AI_DAILY_CACHE_TTL_SEC);
  assert.equal(dailyCacheTtlSec('fallback'), FALLBACK_DAILY_CACHE_TTL_SEC);
  assert.equal(dailyCacheTtlSec('fallback', 8), AI_DAILY_CACHE_TTL_SEC);
  assert.ok(FALLBACK_DAILY_CACHE_TTL_SEC <= 5 * 60);
  assert.ok(FALLBACK_DAILY_CACHE_TTL_SEC < AI_DAILY_CACHE_TTL_SEC);
  assert.equal(dailyCacheKey('2026-10-21'), `${DAILY_CACHE_KEY_PREFIX}2026-10-21`);
  assert.match(DAILY_CACHE_KEY_PREFIX, /daily:v8:/);
  assert.equal(dailyAttemptKey('2026-10-21'), 'lastAttempt:2026-10-21');
  assert.equal(dailyLockKey('2026-10-21'), 'genLock:2026-10-21');
});

test('dailySet caches an AI set for the full day', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const kv = memoryKv();
  const env: Env = {
    FAKEGPT: kv,
    AI: aiThatReturns(valid),
  };
  const set = await dailySet(env, '2026-10-21');
  assert.equal(set.source, 'ai');
  const dailyPut = kv.puts.find((row) => row.key === dailyCacheKey('2026-10-21'));
  assert.ok(dailyPut);
  assert.equal(dailyPut.ttl, AI_DAILY_CACHE_TTL_SEC);
  assert.equal(dailyPut.source, 'ai');
});

test('dailySet caches a fallback set only briefly so generation can retry', async () => {
  const kv = memoryKv();
  const env: Env = {
    FAKEGPT: kv,
    AI: {
      async run() {
        throw new Error('timeout');
      },
    },
  };
  const set = await dailySet(env, '2026-10-21');
  assert.equal(set.source, 'fallback');
  const dailyPut = kv.puts.find((row) => row.key === dailyCacheKey('2026-10-21'));
  assert.ok(dailyPut);
  assert.equal(dailyPut.ttl, FALLBACK_DAILY_CACHE_TTL_SEC);
  assert.equal(dailyPut.source, 'fallback');
});

test('dailySet retries generation after a short-lived fallback cache expires', async () => {
  const date = '2026-10-21';
  const key = dailyCacheKey(date);
  const fallback = fallbackDailySet(date);
  const kv = memoryKv({ [key]: JSON.stringify(fallback) });
  const now = 1_700_000_000_000;
  const cached = await dailySet({ FAKEGPT: kv }, date, { now });
  assert.equal(cached.source, 'fallback');

  kv.store.delete(key);
  let calls = 0;
  const generated = await dailySet(
    {
      FAKEGPT: kv,
      AI: {
        async run(_name, input) {
          calls += 1;
          const max = Number(input.max_tokens);
          if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: fallback.personas } };
          if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
          return { response: { rounds: roundsForBatch(fallback, input) } };
        },
      },
    },
    date,
    { now: now + DAILY_GENERATE_BACKOFF_MS },
  );
  assert.ok(calls >= 1);
  assert.equal(generated.source, 'ai');
  const dailyPut = kv.puts.find((row) => row.key === key && row.source === 'ai');
  assert.equal(dailyPut?.ttl, AI_DAILY_CACHE_TTL_SEC);
});

test('player /daily serves fallback immediately while generation runs in waitUntil', async () => {
  const date = '2026-10-21';
  const valid = fallbackDailySet(date);
  let release!: () => void;
  const hang = new Promise<void>((resolve) => {
    release = resolve;
  });
  const kv = memoryKv();
  const pending: Promise<unknown>[] = [];
  const set = await dailySet(
    {
      FAKEGPT: kv,
      AI: {
        async run(_name, input) {
          await hang;
          const max = Number(input.max_tokens);
          if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
          if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
          return { response: { rounds: roundsForBatch(valid, input) } };
        },
      },
    },
    date,
    { waitUntil: (promise) => pending.push(promise) },
  );
  assert.equal(set.source, 'fallback');
  assert.equal(pending.length, 1);
  const fallbackPut = kv.puts.find((row) => row.key === dailyCacheKey(date));
  assert.equal(fallbackPut?.source, 'fallback');
  release();
  await pending[0];
  const aiPut = kv.puts.find((row) => row.key === dailyCacheKey(date) && row.source === 'ai');
  assert.ok(aiPut);
  assert.equal(aiPut.ttl, AI_DAILY_CACHE_TTL_SEC);
});

test('a below-threshold harvest is still cached for the day when it has AI rounds', async () => {
  const date = '2026-10-21';
  const valid = fallbackDailySet(date);
  const kv = memoryKv();
  const set = await dailySet(
    {
      FAKEGPT: kv,
      AI: {
        async run(_name, input) {
          const max = Number(input.max_tokens);
          if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
          if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
          return { response: { rounds: roundsForBatch(valid, input).slice(0, 1) } };
        },
      },
    },
    date,
  );
  assert.equal(set.source, 'fallback');
  assert.ok((set.aiCount ?? 0) > 0);
  assert.equal(dailySourceFor(4), 'fallback');
  const dailyPut = kv.puts.find((row) => row.key === dailyCacheKey(date) && row.aiCount);
  assert.equal(dailyPut?.source, 'fallback');
  assert.equal(dailyPut?.ttl, AI_DAILY_CACHE_TTL_SEC);
});

test('cron regenerates even when a short-lived fallback is already cached', async () => {
  const date = '2026-10-21';
  const key = dailyCacheKey(date);
  const fallback = fallbackDailySet(date);
  const kv = memoryKv({ [key]: JSON.stringify(fallback) });
  const generated = await dailySet({ FAKEGPT: kv, AI: aiThatReturns(fallback) }, date);
  assert.equal(generated.source, 'ai');
  const dailyPut = kv.puts.find((row) => row.key === key && row.source === 'ai');
  assert.equal(dailyPut?.ttl, AI_DAILY_CACHE_TTL_SEC);
});

test('claimGeneration enforces lock, 3-minute backoff, and a 5-attempt cap', async () => {
  const date = '2026-10-21';
  const kv = memoryKv();
  const env: Env = { FAKEGPT: kv };
  const t0 = 1_700_000_000_000;

  const first = await claimGeneration(env, date, { now: t0 });
  assert.equal(first.claimed, true);
  assert.equal(first.attempts, 1);

  const locked = await claimGeneration(env, date, { now: t0 + 10_000 });
  assert.equal(locked.claimed, false);
  assert.equal(locked.reason, 'locked');

  kv.store.set(dailyLockKey(date), JSON.stringify({ at: 0 }));
  const backoff = await claimGeneration(env, date, { now: t0 + DAILY_GENERATE_LOCK_MS + 1 });
  assert.equal(backoff.claimed, false);
  assert.equal(backoff.reason, 'backoff');

  let now = t0 + DAILY_GENERATE_BACKOFF_MS;
  for (let attempt = 2; attempt <= DAILY_GENERATE_ATTEMPTS_MAX; attempt += 1) {
    const claimed = await claimGeneration(env, date, { now });
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.attempts, attempt);
    kv.store.set(dailyLockKey(date), JSON.stringify({ at: 0 }));
    now += DAILY_GENERATE_BACKOFF_MS;
  }

  const capped = await claimGeneration(env, date, { now });
  assert.equal(capped.claimed, false);
  assert.equal(capped.reason, 'capped');
  assert.equal(capped.attempts, DAILY_GENERATE_ATTEMPTS_MAX);
});

test('a second /daily does not start another generation while one is locked', async () => {
  const date = '2026-10-21';
  const valid = fallbackDailySet(date);
  let release!: () => void;
  const hang = new Promise<void>((resolve) => {
    release = resolve;
  });
  const kv = memoryKv();
  const pending: Promise<unknown>[] = [];
  const env: Env = {
    FAKEGPT: kv,
    AI: {
      async run(_name, input) {
        await hang;
        const max = Number(input.max_tokens);
        if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
        if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
        return { response: { rounds: roundsForBatch(valid, input) } };
      },
    },
  };
  const first = await dailySet(env, date, { waitUntil: (promise) => pending.push(promise) });
  const second = await dailySet(env, date, { waitUntil: (promise) => pending.push(promise) });
  assert.equal(first.source, 'fallback');
  assert.equal(second.source, 'fallback');
  assert.equal(pending.length, 1);
  release();
  await pending[0];
});

test('dailySet waits 3 minutes after an attempt before generating again', async () => {
  const date = '2026-10-21';
  const valid = fallbackDailySet(date);
  const kv = memoryKv();
  const now = 1_700_000_000_000;
  const env: Env = {
    FAKEGPT: kv,
    AI: {
      async run(_name, input) {
        const max = Number(input.max_tokens);
        if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
        if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
        return { response: { rounds: roundsForBatch(valid, input).slice(0, 1) } };
      },
    },
  };
  const first = await dailySet(env, date, { now });
  assert.equal(first.source, 'fallback');
  const pending: Promise<unknown>[] = [];
  await dailySet(env, date, { now: now + 60_000, waitUntil: (promise) => pending.push(promise) });
  assert.equal(pending.length, 0);
  await dailySet(env, date, {
    now: now + DAILY_GENERATE_BACKOFF_MS,
    waitUntil: (promise) => pending.push(promise),
  });
  assert.equal(pending.length, 1);
  await pending[0];
});

test('a capped day does not spend more daily-generate budget', async () => {
  const date = '2026-10-21';
  const kv = memoryKv();
  const env: Env = {
    FAKEGPT: kv,
    AI: {
      async run() {
        throw new Error('timeout');
      },
    },
  };
  let now = 1_700_000_000_000;
  for (let i = 0; i < DAILY_GENERATE_ATTEMPTS_MAX; i += 1) {
    await dailySet(env, date, { now });
    now += DAILY_GENERATE_BACKOFF_MS;
  }
  const used = budgetUsed(kv, date);
  assert.equal(used, DAILY_GENERATE_ATTEMPTS_MAX * DAILY_GENERATE_SPEND);

  const pending: Promise<unknown>[] = [];
  await dailySet(env, date, { now, waitUntil: (promise) => pending.push(promise) });
  assert.equal(pending.length, 0);
  assert.equal(budgetUsed(kv, date), used);
});

test('pickBetterDailySet keeps the harvest with more AI rounds', () => {
  const weak = fillDailySet('2026-10-21', goodAiRounds(4), 'fallback');
  const better = fillDailySet('2026-10-21', goodAiRounds(8), 'fallback');
  const full = fillDailySet('2026-10-21', goodAiRounds(12), 'ai');
  assert.equal(dailyAiCount(weak), 4);
  assert.equal(pickBetterDailySet(weak, better).aiCount, 8);
  assert.equal(pickBetterDailySet(better, weak).aiCount, 8);
  assert.equal(pickBetterDailySet(better, full).source, 'ai');
});

test('generateAndCache replaces the cached set only when the new harvest is better', async () => {
  const date = '2026-10-21';
  const key = dailyCacheKey(date);
  const kv = memoryKv({ [key]: JSON.stringify(fillDailySet(date, goodAiRounds(4), 'fallback')) });

  const eight = await generateAndCache({ FAKEGPT: kv, AI: aiThatEmits(goodAiRounds(8)) }, date, 1000, {
    claimed: true,
  });
  assert.equal(eight.aiCount, 8);
  assert.equal(eight.source, 'fallback');
  const afterEight = kv.puts.filter((row) => row.key === key).at(-1);
  assert.equal(afterEight?.ttl, AI_DAILY_CACHE_TTL_SEC);
  assert.equal(afterEight?.aiCount, 8);

  const worse = await generateAndCache({ FAKEGPT: kv, AI: aiThatEmits(goodAiRounds(2)) }, date, 1000, {
    claimed: true,
  });
  assert.equal(worse.aiCount, 8);
  const stored = JSON.parse(kv.store.get(key) ?? '{}') as DailySet;
  assert.equal(stored.aiCount, 8);
});

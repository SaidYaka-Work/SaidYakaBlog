import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailySet, type Env } from '../src/index.ts';
import { fallbackDailySet } from '../src/fallback.ts';
import {
  AI_DAILY_CACHE_TTL_SEC,
  DAILY_CACHE_KEY_PREFIX,
  FALLBACK_DAILY_CACHE_TTL_SEC,
  dailyCacheKey,
  dailyCacheTtlSec,
} from '../src/models.ts';

function memoryKv(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  const puts: Array<{ key: string; ttl: number; source?: string }> = [];
  return {
    store,
    puts,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      store.set(key, value);
      const parsed = JSON.parse(value) as { source?: string };
      puts.push({ key, ttl: options?.expirationTtl ?? 0, source: parsed.source });
    },
  };
}

test('dailyCacheTtlSec keeps AI sets for a day and fallbacks for a few minutes', () => {
  assert.equal(dailyCacheTtlSec('ai'), AI_DAILY_CACHE_TTL_SEC);
  assert.equal(dailyCacheTtlSec('fallback'), FALLBACK_DAILY_CACHE_TTL_SEC);
  assert.ok(FALLBACK_DAILY_CACHE_TTL_SEC <= 5 * 60);
  assert.ok(FALLBACK_DAILY_CACHE_TTL_SEC < AI_DAILY_CACHE_TTL_SEC);
  assert.equal(dailyCacheKey('2026-10-21'), `${DAILY_CACHE_KEY_PREFIX}2026-10-21`);
});

test('dailySet caches an AI set for the full day', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const kv = memoryKv();
  const env: Env = {
    FAKEGPT: kv,
    AI: {
      async run() {
        return { response: { rounds: valid.rounds } };
      },
    },
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
  const cached = await dailySet({ FAKEGPT: kv }, date);
  assert.equal(cached.source, 'fallback');

  kv.store.delete(key);
  let calls = 0;
  const generated = await dailySet(
    {
      FAKEGPT: kv,
      AI: {
        async run() {
          calls += 1;
          return { response: { rounds: fallback.rounds } };
        },
      },
    },
    date,
  );
  assert.ok(calls >= 1);
  assert.equal(generated.source, 'ai');
  const dailyPut = kv.puts.find((row) => row.key === key && row.source === 'ai');
  assert.equal(dailyPut?.ttl, AI_DAILY_CACHE_TTL_SEC);
});

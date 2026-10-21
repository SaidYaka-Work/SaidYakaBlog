import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DAILY_FLUSH_MS,
  DailyStore,
  MemoryDailyStorage,
  dayAllowed,
  emptyCounts,
  flushDirty,
  loadDay,
  parseDay,
  parseResult,
  puzzleNumberAt,
  scheduleIfDirty,
  takeDailyRate,
} from '../src/dailyStats.ts';

const T0 = Date.parse('2026-10-21T16:00:00-04:00');

test('result and day parsing reject extras and non-integers', () => {
  assert.equal(parseResult(3), '3');
  assert.equal(parseResult('X'), 'X');
  assert.equal(parseResult('7'), null);
  assert.equal(parseResult('win'), null);
  assert.equal(parseDay(12), 12);
  assert.equal(parseDay('12'), 12);
  assert.equal(parseDay(1.5), null);
  assert.equal(parseDay(0), null);
  assert.equal(parseDay('nope'), null);
});

test('only the current ET puzzle day and its neighbors are accepted', () => {
  const today = puzzleNumberAt(T0);
  assert.equal(today, 1);
  assert.equal(dayAllowed(today, T0), true);
  assert.equal(dayAllowed(today + 1, T0), true);
  assert.equal(dayAllowed(today - 1 < 1 ? today : today - 1, T0), true);
  assert.equal(dayAllowed(today + 2, T0), false);
  assert.equal(dayAllowed(99, T0), false);
});

test('in-memory rate limit is per IP and never stored on the day row', () => {
  const first = takeDailyRate(undefined, T0);
  assert.equal(first.ok, true);
  let bucket = first.ok ? first.bucket : { count: 0, windowStart: T0 };
  for (let i = 1; i < 8; i += 1) {
    const next = takeDailyRate(bucket, T0 + i);
    assert.equal(next.ok, true);
    if (!next.ok) throw new Error('expected room');
    bucket = next.bucket;
  }
  const capped = takeDailyRate(bucket, T0 + 20);
  assert.equal(capped.ok, false);
  const other = takeDailyRate(undefined, T0 + 20);
  assert.equal(other.ok, true);
});

test('10k results stay in memory and flush to one row per day', async () => {
  const store = new DailyStore();
  const storage = new MemoryDailyStorage();
  await loadDay(store, storage, 1);
  assert.equal(storage.writes, 0);

  for (let i = 0; i < 10_000; i += 1) {
    const result = i % 17 === 0 ? 'X' : (`${(i % 6) + 1}` as '1' | '2' | '3' | '4' | '5' | '6');
    store.record(1, result);
    await scheduleIfDirty(store, storage, T0);
    const early = await flushDirty(store, storage, T0 + 1_000);
    assert.equal(early, 0);
  }

  assert.equal(storage.writes, 0);
  assert.equal(store.stats(1).played, 10_000);
  assert.ok(store.stats(1).solved < 10_000);
  assert.equal(storage.alarms, 1, 'one alarm scheduled when first dirty');

  const wrote = await flushDirty(store, storage, T0 + DAILY_FLUSH_MS, true);
  assert.equal(wrote, 1);
  assert.equal(storage.writes, 1);
  assert.deepEqual(await storage.get('day:1'), store.stats(1));

  for (let i = 0; i < 500; i += 1) store.record(1, '3');
  assert.equal(await flushDirty(store, storage, T0 + DAILY_FLUSH_MS + 1_000), 0);
  const second = await flushDirty(store, storage, T0 + DAILY_FLUSH_MS * 2, true);
  assert.equal(second, 1);
  assert.equal(storage.writes, 2);
  assert.ok(storage.writes < 10, `writes stayed tiny, got ${storage.writes}`);
});

test('two puzzle days persist as two rows, never per result', async () => {
  const store = new DailyStore();
  const storage = new MemoryDailyStorage();
  store.record(4, '2');
  store.record(5, 'X');
  store.record(4, '3');
  assert.equal(storage.writes, 0);
  assert.equal(await flushDirty(store, storage, T0 + DAILY_FLUSH_MS, true), 2);
  assert.equal(storage.writes, 2);
  assert.equal((await storage.get<ReturnType<typeof emptyCounts>>('day:4'))?.played, 2);
  assert.equal((await storage.get<ReturnType<typeof emptyCounts>>('day:5'))?.distribution.X, 1);
});

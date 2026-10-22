import assert from 'node:assert/strict';
import { test } from 'node:test';
import { takeBudget, takeWindow } from '../src/budget.ts';

test('takeWindow rate-limits inside the window and resets after', () => {
  let state = takeWindow(undefined, 1000, 2, 10_000);
  assert.equal(state.ok, true);
  state = takeWindow(state.next, 2000, 2, 10_000);
  assert.equal(state.ok, true);
  state = takeWindow(state.next, 3000, 2, 10_000);
  assert.equal(state.ok, false);
  state = takeWindow(state.next, 12_000, 2, 10_000);
  assert.equal(state.ok, true);
  assert.equal(state.next.count, 1);
});

test('takeBudget rejects when the daily cap is hit', () => {
  assert.deepEqual(takeBudget(0, 2, 10), { ok: true, used: 2 });
  assert.deepEqual(takeBudget(9, 2, 10), { ok: false, used: 11 });
  assert.deepEqual(takeBudget(8, 2, 10), { ok: true, used: 10 });
});

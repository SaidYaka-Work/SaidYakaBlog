import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fallbackDailySet } from '../src/fallback.ts';
import { dateSeed, validateDailySet } from '../src/schema.ts';

test('date seeding is stable', () => {
  assert.equal(dateSeed('2026-10-21'), dateSeed('2026-10-21'));
  assert.notEqual(dateSeed('2026-10-21'), dateSeed('2026-10-22'));
});

test('fallback daily set is deterministic and valid', () => {
  const a = fallbackDailySet('2026-10-21');
  const b = fallbackDailySet('2026-10-21');
  const c = fallbackDailySet('2026-10-22');
  assert.deepEqual(
    a.rounds.map((round) => round.id),
    b.rounds.map((round) => round.id),
  );
  assert.notEqual(
    a.rounds.map((round) => round.id).join(','),
    c.rounds.map((round) => round.id).join(','),
  );
  const valid = validateDailySet({ ...a, source: 'fallback' }, '2026-10-21');
  assert.ok(valid);
  assert.equal(valid.source, 'fallback');
  assert.ok(valid.rounds.filter((round) => round.kind === 'mc').length >= 2);
  assert.ok(valid.rounds.filter((round) => round.kind === 'typed').length >= 2);
  assert.ok(valid.rounds.filter((round) => round.kind === 'draw' || round.kind === 'sound').length <= 1);
});

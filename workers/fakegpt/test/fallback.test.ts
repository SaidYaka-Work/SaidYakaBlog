import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fallbackDailySet, fillDailySet } from '../src/fallback.ts';
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
  assert.ok(valid.rounds.length >= 20);
  assert.equal(valid.personas.length, 5);
  assert.ok(valid.rounds.filter((round) => round.kind === 'mc' || round.kind === 'tone' || round.kind === 'order').length >= 2);
  assert.ok(valid.rounds.filter((round) => round.kind !== 'draw' && round.kind !== 'sound').length >= 2);
  assert.ok(valid.rounds.filter((round) => round.kind === 'draw' || round.kind === 'sound').length <= 1);
});

test('bank fills use the day personas, not leftover costume names', () => {
  const personas = [
    { id: 'dana', name: 'Dana', vibe: 'calm until the spinner spins' },
    { id: 'lily', name: 'Lily', vibe: 'already late' },
    { id: 'jamie', name: 'Jamie', vibe: 'three tabs of panic' },
    { id: 'ethan', name: 'Ethan', vibe: 'mute button philosopher' },
    { id: 'ava', name: 'Ava', vibe: 'inbox on fire' },
  ];
  const set = fillDailySet('2026-10-21', [], 'ai', personas);
  const names = new Set(set.personas.map((row) => row.name));
  assert.deepEqual([...names].sort(), personas.map((row) => row.name).sort());
  assert.ok(set.rounds.every((round) => names.has(round.persona)));
  assert.equal(set.rounds.some((round) => round.persona === 'Uncle Modem'), false);
});

test('fillDailySet records how many incoming AI rounds survived', () => {
  const incoming = fallbackDailySet('2026-10-21').rounds.slice(0, 4);
  const set = fillDailySet('2026-10-21', incoming, 'fallback');
  assert.equal(set.aiCount, 4);
  assert.equal(set.source, 'fallback');
  assert.ok(set.rounds.length >= 20);
});

test('daily persona fallback uses human names, not costume bank names', () => {
  const set = fillDailySet('2026-10-21', [], 'fallback');
  assert.equal(set.personas.some((row) => /uncle modem|last cookie/i.test(row.name)), false);
  assert.ok(set.personas.every((row) => /^[A-Z][a-z]+$/.test(row.name)));
});

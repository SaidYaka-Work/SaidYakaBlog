import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BANK } from '../../../components/games/fakegpt/bank/index.ts';
import { generateDailyPuzzles, generatePuzzle, GEN_KINDS } from '../../../components/games/fakegpt/bank/puzzles.ts';
import { pickBankForDate, pickDailyQuestions, usedBankIdsInWindow, addUtcDays } from '../../../components/games/fakegpt/bank/select.ts';
import { DAILY_BANK_COUNT, DAILY_ROUND_COUNT, WINDOW_DAYS } from '../../../components/games/fakegpt/bank/types.ts';
import { validateBank, validateQuestion } from '../../../components/games/fakegpt/bank/validate.ts';
import { buildDailySet } from '../../../components/games/fakegpt/daily.ts';

test('static bank is large, unique, and locally checkable', () => {
  assert.ok(BANK.length >= 1500, `need 1500+ questions, got ${BANK.length}`);
  const { issues, byKind } = validateBank(BANK);
  assert.equal(issues.length, 0, issues.slice(0, 8).map((row) => `${row.id}: ${row.reason}`).join('\n'));
  assert.ok((byKind.trivia ?? 0) >= 400);
  assert.ok((byKind.translate ?? 0) >= 100);
  assert.ok((byKind.math ?? 0) >= 100);
  assert.equal(new Set(BANK.map((row) => row.id)).size, BANK.length);
});

test('code puzzles stay valid across thousands of seeds', () => {
  const issues: string[] = [];
  for (const kind of GEN_KINDS) {
    for (let seed = 0; seed < 400; seed += 1) {
      const row = generatePuzzle(kind, seed);
      const found = validateQuestion(row);
      if (found.length) issues.push(`${row.id}: ${found.map((item) => item.reason).join(', ')}`);
    }
  }
  assert.equal(issues.length, 0, issues.slice(0, 12).join('\n'));
  assert.equal(generateDailyPuzzles(99, 16).length, 16);
});

test('daily picks are deterministic and skip bank ids for 60 days', () => {
  const date = '2026-10-22';
  const first = pickDailyQuestions(BANK, date).map((row) => row.id);
  const again = pickDailyQuestions(BANK, date).map((row) => row.id);
  assert.deepEqual(first, again);
  assert.equal(first.length, DAILY_ROUND_COUNT);
  assert.equal(pickBankForDate(BANK, date).length, DAILY_BANK_COUNT);

  const used = usedBankIdsInWindow(BANK, date);
  for (const id of pickBankForDate(BANK, date).map((row) => row.id)) {
    assert.equal(used.has(id), false, `${id} repeated inside the window`);
  }

  const later = addUtcDays(date, 10);
  const todayIds = new Set(pickBankForDate(BANK, date).map((row) => row.id));
  const laterIds = pickBankForDate(BANK, later).map((row) => row.id);
  assert.ok(laterIds.every((id) => !todayIds.has(id)));

  const reuseDay = addUtcDays(date, WINDOW_DAYS);
  assert.ok(pickBankForDate(BANK, reuseDay).length === DAILY_BANK_COUNT);

  const pack = buildDailySet(date);
  assert.deepEqual(pack.rounds.map((row) => row.id), buildDailySet(date).rounds.map((row) => row.id));
  assert.equal(pack.source, 'fallback');
  assert.ok(pack.rounds.every((row) => row.options.length === 4));
  assert.ok(pack.rounds.every((row) => row.kind !== 'draw' && row.kind !== 'sound'));
  assert.match(pack.rounds[0]?.good ?? '', /\S/);
});

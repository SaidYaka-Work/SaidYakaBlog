import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  JOBS,
  asTriviaItems,
  checkJob,
  isChoiceKind,
  localJobPool,
  matchNumeric,
  matchOrder,
  parseFlexibleNumber,
} from '../../../components/games/fakegpt/jobs.ts';
import { matchChoice, normalizeAnswer } from '../../../components/games/fakegpt/match.ts';
import { filterAliases } from '../src/schema.ts';
import { pickJobs } from '../../../components/games/fakegpt/logic.ts';

test('job bank covers the desk-job mix and is locally checkable', () => {
  assert.ok(JOBS.length >= 60, `need a fat job bank, got ${JOBS.length}`);
  const kinds = new Set(JOBS.map((item) => item.kind));
  for (const kind of ['translate', 'math', 'unit', 'weekday', 'spell', 'unscramble', 'order', 'tone', 'fill']) {
    assert.ok(kinds.has(kind as (typeof JOBS)[number]['kind']), `missing ${kind}`);
  }
  const ids = new Set<string>();
  for (const item of JOBS) {
    assert.ok(item.id && !ids.has(item.id), item.id);
    ids.add(item.id);
    assert.ok(item.text.length >= 8, item.id);
    assert.ok(item.answer.length >= 1, item.id);
    if (isChoiceKind(item.kind, item.options ?? [])) {
      assert.equal(item.options?.length, 4, item.id);
      assert.equal(item.options?.filter((option) => matchChoice(option, item.answer)).length, 1, item.id);
    }
    assert.equal(checkJob(item.kind, item.answer, item.answer, item.aliases ?? [], item.options ?? []), 'correct', item.id);
  }
});

test('each checker accepts the right shape of answer', () => {
  assert.equal(checkJob('translate', 'Thanks', 'thank you', ['thanks']), 'correct');
  assert.equal(checkJob('translate', 'bye', 'goodbye', ['bye']), 'correct');
  assert.equal(checkJob('math', '25', '25'), 'correct');
  assert.equal(checkJob('math', '25.0', '25'), 'correct');
  assert.equal(checkJob('math', '24', '25'), 'wrong');
  assert.equal(checkJob('unit', '1 m', '1'), 'correct');
  assert.equal(checkJob('unit', '60', '60'), 'correct');
  assert.equal(checkJob('weekday', 'Monday', 'Monday'), 'correct');
  assert.equal(checkJob('spell', 'receive', 'receive'), 'correct');
  assert.equal(checkJob('unscramble', 'apple', 'apple'), 'correct');
  assert.equal(checkJob('order', '1 2 3 4', '1, 2, 3, 4'), 'correct');
  assert.equal(checkJob('order', '1, 2, 3, 4', '1, 2, 3, 4', [], ['1, 2, 3, 4', '4, 3, 2, 1', '2, 1, 4, 3', '3, 1, 4, 2']), 'correct');
  assert.equal(checkJob('tone', 'Sorry, the report is running late.', 'Sorry, the report is running late.', [], [
    'Sorry, the report is running late.',
    'REPORT LATE. FIX.',
    'lol report goes brrr',
    'I ate the report.',
  ]), 'correct');
  assert.equal(checkJob('fill', 'Paris', 'Paris'), 'correct');
  assert.equal(checkJob('mc', '', 'Paris', [], ['Paris', 'Lyon', 'Nice', 'Lille']), 'empty');
  assert.equal(parseFlexibleNumber('1,024 km'), 1024);
  assert.equal(matchNumeric('1.61', '1.6', 0.05), 'correct');
  assert.equal(matchOrder('mercury venus earth', 'Mercury, Venus, Earth'), 'correct');
});

test('local bank answers match their options and listed order items', () => {
  const rgb = JOBS.find((item) => item.id === 'or-rgb');
  assert.ok(rgb);
  assert.match(rgb.text, /yellow,\s*red,\s*orange/i);
  assert.equal(normalizeAnswer(rgb.answer), normalizeAnswer('red, orange, yellow'));

  const listedItems = (text: string): string[] | null => {
    const afterColon = text.split(':')[1];
    if (!afterColon) return null;
    const list = afterColon.split(/[—–-]/)[0];
    const items = list
      .split(',')
      .map((item) => normalizeAnswer(item))
      .filter(Boolean);
    return items.length >= 3 ? items : null;
  };

  for (const item of JOBS) {
    if (isChoiceKind(item.kind, item.options ?? [])) {
      assert.equal(item.options?.length, 4, item.id);
      assert.equal(
        item.options?.filter((option) => matchChoice(option, item.answer)).length,
        1,
        `${item.id} answer must be among its options`,
      );
    }
    if (item.kind === 'order') {
      const listed = listedItems(item.text);
      if (listed) {
        const answer = normalizeAnswer(item.answer).split(' ').filter(Boolean);
        assert.deepEqual([...answer].sort(), [...listed].sort(), `${item.id} prompt list must match the answer set`);
      }
    }
    if (item.kind === 'translate') {
      const aliases = filterAliases(item.kind, item.text, item.answer, item.aliases ?? []);
      assert.deepEqual(aliases, item.aliases ?? [], `${item.id} bank aliases must pass the source-word rule`);
    }
  }
});

test('pickJobs fills a max-customer daily set from the bank', () => {
  const picked = pickJobs(asTriviaItems(localJobPool()), 20, () => 0.3, 21);
  assert.equal(picked.length, 20);
  assert.ok(picked.filter((row) => row.kind === 'draw' || row.kind === 'sound').length <= 1);
  assert.ok(new Set(picked.map((row) => row.id)).size === 20);
  assert.ok(picked.filter((row) => isChoiceKind(row.kind, row.options)).length >= 2);
  assert.ok(picked.filter((row) => row.kind !== 'draw' && row.kind !== 'sound' && !isChoiceKind(row.kind, row.options)).length >= 2);
});

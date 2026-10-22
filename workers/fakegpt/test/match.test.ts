import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bonusCountFor, localTriviaPool, pickPrompts, scoreTrivia, shouldIncludeBonus } from '../../../components/games/fakegpt/logic.ts';
import { matchChoice, matchTypedAnswer, normalizeAnswer } from '../../../components/games/fakegpt/match.ts';
import { BONUS, TRIVIA } from '../../../components/games/fakegpt/trivia.ts';
import { fallbackDailySet } from '../src/fallback.ts';
import { dateSeed } from '../src/schema.ts';

test('normalizeAnswer strips case, punctuation, and accents', () => {
  assert.equal(normalizeAnswer('São Paulo'), normalizeAnswer('sao paulo'));
  assert.equal(normalizeAnswer('the  Sun.'), 'sun');
  assert.equal(normalizeAnswer("J.K. Rowling"), normalizeAnswer('jk rowling'));
});

test('matchTypedAnswer accepts aliases and small typos', () => {
  assert.equal(matchTypedAnswer('Tokio', 'Tokyo', ['Tokio']), 'correct');
  assert.equal(matchTypedAnswer('Neil Armstrong', 'Neil Armstrong', []), 'correct');
  assert.equal(matchTypedAnswer('Amstrong', 'Armstrong', ['Neil Armstrong']), 'correct');
  assert.equal(matchTypedAnswer('Parris', 'Paris', []), 'correct');
  assert.equal(matchTypedAnswer('york', 'New York City', ['NYC']), 'ambiguous');
  assert.equal(matchTypedAnswer('Lyon', 'Paris', []), 'wrong');
  assert.equal(matchTypedAnswer('   ', 'Paris', []), 'empty');
  assert.equal(matchTypedAnswer('cat', 'Paris', []), 'wrong');
});

test('matchChoice is exact after normalize and never needs fuzzy help', () => {
  assert.equal(matchChoice('paris', 'Paris'), true);
  assert.equal(matchChoice('Lyon', 'Paris'), false);
});

test('trivia bank is hand-checked and large enough', () => {
  assert.ok(TRIVIA.length >= 80, `need 80+ trivia, got ${TRIVIA.length}`);
  const ids = new Set<string>();
  for (const item of TRIVIA) {
    assert.ok(item.id && !ids.has(item.id), item.id);
    ids.add(item.id);
    assert.ok(item.kind === 'mc' || item.kind === 'typed', item.id);
    assert.ok(item.text.length >= 12, item.id);
    assert.ok(item.answer.length >= 1, item.id);
    if (item.kind === 'mc') {
      assert.equal(item.options?.length, 4, item.id);
      assert.equal(item.options?.filter((option) => matchChoice(option, item.answer)).length, 1, item.id);
    }
  }
  assert.ok(BONUS.length >= 8);
  assert.ok(BONUS.every((item) => item.kind === 'draw' || item.kind === 'sound'));
});

test('pickPrompts keeps bonus rounds rare', () => {
  for (const seed of [1, 2, 3, 4, 20, 21, 99]) {
    const picked = pickPrompts(localTriviaPool(), 8, () => 0.3, seed);
    assert.equal(picked.length, 8);
    assert.ok(bonusCountFor(picked) <= 1, `seed ${seed} had too many bonus rounds`);
    assert.ok(picked.filter((row) => row.kind === 'mc').length >= 2);
    assert.ok(picked.filter((row) => row.kind === 'typed').length >= 2);
    if (!shouldIncludeBonus(seed)) {
      assert.equal(bonusCountFor(picked), 0);
    }
  }
});

test('fallback daily set is deterministic and valid', () => {
  const a = fallbackDailySet('2026-10-21');
  const b = fallbackDailySet('2026-10-21');
  const c = fallbackDailySet('2026-10-22');
  assert.deepEqual(
    a.rounds.map((round) => round.id),
    b.rounds.map((round) => round.id),
  );
  assert.notEqual(a.rounds[0].text + a.rounds[0].id, c.rounds[0].text + c.rounds[0].id);
  assert.ok(a.rounds.filter((round) => round.kind === 'draw' || round.kind === 'sound').length <= 1);
  assert.notEqual(dateSeed('2026-10-21'), dateSeed('2026-10-22'));
});

test('scoreTrivia rewards a fast correct answer and roasts a miss', () => {
  const hit = scoreTrivia({ submittedInTime: true, remainingMs: 12000, totalMs: 16000, correct: true, empty: false }, () => 0);
  const miss = scoreTrivia({ submittedInTime: true, remainingMs: 12000, totalMs: 16000, correct: false, empty: false }, () => 0);
  assert.ok(hit.points >= 100);
  assert.equal(hit.thumbs, 'up');
  assert.equal(miss.thumbs, 'down');
  assert.ok(miss.points < hit.points);
});

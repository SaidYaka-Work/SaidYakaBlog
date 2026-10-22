import assert from 'node:assert/strict';
import {
  BASE_SECONDS,
  MAX_BONUS_PER_RUN,
  MIN_SECONDS,
  NUDGE_MARKS,
  ROUNDS_PER_RUN,
  bonusCountFor,
  formatTimer,
  isEmptyDraw,
  isEmptySound,
  localTriviaPool,
  mulberry32,
  nextNudge,
  pickJobs,
  pickPrompts,
  roundSeconds,
  scoreJob,
  scoreRound,
  scoreTrivia,
  scoreWithJudge,
  shuffle,
  totalScore,
} from '../components/games/fakegpt/logic.ts';
import { JOBS, asTriviaItems, checkJob, localJobPool } from '../components/games/fakegpt/jobs.ts';
import {
  customersForLevel,
  isLevelComplete,
  joinNotice,
  planRun,
  startCustomerCount,
} from '../components/games/fakegpt/lanes.ts';
import { matchChoice, matchTypedAnswer } from '../components/games/fakegpt/match.ts';
import { BONUS, TRIVIA } from '../components/games/fakegpt/trivia.ts';
import { fallbackDailySet } from '../workers/fakegpt/src/fallback';
import { takeBudget } from '../workers/fakegpt/src/budget';
import { dateSeed, parseJudgeRequest, utcDate, validateDailySet } from '../workers/fakegpt/src/schema';

const pool = localTriviaPool();
assert.ok(TRIVIA.length >= 80, `need at least 80 trivia questions, got ${TRIVIA.length}`);
assert.ok(BONUS.length >= 8, `need bonus draw/sound prompts, got ${BONUS.length}`);

const ids = new Set<string>();
for (const item of pool) {
  assert.ok(item.id && !ids.has(item.id), `duplicate or empty id ${item.id}`);
  ids.add(item.id);
  assert.ok(item.text.trim().length >= 12, `${item.id} text is too short`);
  assert.ok(item.answer.trim().length >= 1, `${item.id} needs an answer`);
  if (item.kind === 'mc') {
    assert.equal(item.options?.length, 4, `${item.id} needs 4 options`);
    assert.equal(
      item.options?.filter((option) => matchChoice(option, item.answer)).length,
      1,
      `${item.id} must have exactly one correct option`,
    );
  }
}

const original = TRIVIA.map((item) => item.id);
shuffle(TRIVIA, mulberry32(7));
assert.deepEqual(
  TRIVIA.map((item) => item.id),
  original,
  'shuffle must not mutate the trivia pool',
);

const picked = pickPrompts(pool, ROUNDS_PER_RUN, mulberry32(21), 21);
assert.equal(picked.length, ROUNDS_PER_RUN);
assert.ok(bonusCountFor(picked) <= MAX_BONUS_PER_RUN);
assert.ok(picked.filter((row) => row.kind === 'mc').length >= 2);
assert.ok(picked.filter((row) => row.kind === 'typed').length >= 2);
assert.equal(new Set(picked.map((row) => row.id)).size, picked.length);

const again = pickPrompts(pool, ROUNDS_PER_RUN, mulberry32(21), 21);
assert.deepEqual(
  again.map((row) => row.id),
  picked.map((row) => row.id),
);

assert.equal(roundSeconds(0), BASE_SECONDS);
assert.equal(roundSeconds(0, 'mc') <= 16, true);
assert.equal(roundSeconds(99), MIN_SECONDS);
assert.ok(roundSeconds(3) < roundSeconds(0), 'later rounds should be shorter');

assert.equal(formatTimer(24500), '0:25');
assert.equal(nextNudge(0.1, 0), null);
assert.equal(nextNudge(NUDGE_MARKS[0].at, 0), NUDGE_MARKS[0].text);

assert.equal(isEmptyDraw({ strokeCount: 0, coverage: 0 }), true);
assert.equal(isEmptySound({ audioMs: 0, peakLevel: 0, padHits: 0 }), true);
assert.equal(matchTypedAnswer('Tokio', 'Tokyo', ['Tokio']), 'correct');
assert.equal(matchTypedAnswer('Lyon', 'Paris'), 'wrong');
assert.equal(matchTypedAnswer('michaelangelo', 'Michelangelo'), 'correct');
const rainbow = JOBS.find((item) => item.id === 'or-rgb');
assert.ok(rainbow && /yellow,\s*red,\s*orange/i.test(rainbow.text));
assert.equal(checkJob('order', 'red, orange, yellow', rainbow?.answer ?? '', [], rainbow?.options ?? []), 'correct');

const emptyDraw = scoreRound(
  {
    kind: 'draw',
    submittedInTime: true,
    remainingMs: 8000,
    totalMs: 24000,
    strokeCount: 0,
    uniqueColors: 0,
    coverage: 0,
    audioMs: 0,
    peakLevel: 0,
    padHits: 0,
  },
  () => 0,
);
assert.equal(emptyDraw.empty, true);
assert.equal(emptyDraw.points, 0);

const fastTrivia = scoreTrivia({ submittedInTime: true, remainingMs: 12000, totalMs: 16000, correct: true, empty: false }, () => 0);
const wrongTrivia = scoreTrivia({ submittedInTime: true, remainingMs: 12000, totalMs: 16000, correct: false, empty: false }, () => 0);
assert.ok(fastTrivia.points >= 100);
assert.equal(wrongTrivia.thumbs, 'down');

assert.equal(totalScore([{ points: 10 }, { points: 15 }]), 25);

const judged = scoreWithJudge(
  {
    kind: 'draw',
    submittedInTime: true,
    remainingMs: 12000,
    totalMs: 24000,
    strokeCount: 4,
    uniqueColors: 2,
    coverage: 0.1,
    audioMs: 0,
    peakLevel: 0,
    padHits: 0,
  },
  8,
  () => 0,
);
assert.equal(judged.thumbs, 'up');

const seeded = fallbackDailySet('2026-10-21');
assert.deepEqual(
  seeded.rounds.map((round) => round.id),
  fallbackDailySet('2026-10-21').rounds.map((round) => round.id),
);
assert.ok(validateDailySet(seeded, '2026-10-21'));
assert.ok(seeded.rounds.filter((round) => round.kind === 'draw' || round.kind === 'sound').length <= 1);
assert.notEqual(dateSeed('2026-10-21'), dateSeed('2026-10-22'));
assert.match(utcDate(Date.parse('2026-10-21T12:00:00Z')), /^2026-10-21$/);
assert.equal(takeBudget(279, 2, 280).ok, false);
assert.equal(parseJudgeRequest({ date: '2026-10-21', kind: 'draw', request: 'no' }).ok, false);

assert.ok(JOBS.length >= 60, `need job bank, got ${JOBS.length}`);
assert.equal(checkJob('math', '25', '25'), 'correct');
assert.equal(checkJob('order', '1 2 3 4', '1, 2, 3, 4'), 'correct');
assert.equal(startCustomerCount(2), 2);
assert.deepEqual(
  [1, 2, 3, 4, 5].map((level) => customersForLevel(level, 3)),
  [1, 2, 3, 4, 5],
);
assert.equal(isLevelComplete(5, 0, 1), true);
assert.equal(joinNotice('Dana'), '🟢 Dana joined the chat');
const jobs = pickJobs(asTriviaItems(localJobPool()), 20, mulberry32(9), 9);
assert.equal(jobs.length, 20);
assert.equal(planRun([], jobs, 3).length, 5);
assert.ok(scoreJob({ submittedInTime: true, remainingMs: 8000, totalMs: 16000, correct: true, empty: false }, 3, () => 0).points > 100);

console.log(
  `fakegpt dataset ok: ${TRIVIA.length} trivia, ${JOBS.length} jobs, ${BONUS.length} bonus, run ${picked.length}, daily ${seeded.rounds.length}, customers ${seeded.personas.length}`,
);

import assert from 'node:assert/strict';
import {
  BASE_SECONDS,
  MIN_SECONDS,
  NUDGE_MARKS,
  ROUNDS_PER_RUN,
  formatTimer,
  isEmptyDraw,
  isEmptySound,
  mulberry32,
  nextNudge,
  pickPrompts,
  roundSeconds,
  scoreRound,
  shuffle,
  totalScore,
} from '../components/games/fakegpt/logic.ts';
import { PROMPTS } from '../components/games/fakegpt/prompts.ts';

assert.ok(PROMPTS.length >= 40, `need at least 40 prompts, got ${PROMPTS.length}`);

const ids = new Set<string>();
for (const prompt of PROMPTS) {
  assert.ok(prompt.id && !ids.has(prompt.id), `duplicate or empty prompt id ${prompt.id}`);
  ids.add(prompt.id);
  assert.ok(prompt.kind === 'draw' || prompt.kind === 'sound', `${prompt.id} needs a kind`);
  assert.ok(prompt.text.trim().length >= 12, `${prompt.id} text is too short`);
}

const draws = PROMPTS.filter((prompt) => prompt.kind === 'draw');
const sounds = PROMPTS.filter((prompt) => prompt.kind === 'sound');
assert.ok(draws.length >= 16, `need a draw pool, got ${draws.length}`);
assert.ok(sounds.length >= 16, `need a sound pool, got ${sounds.length}`);

const original = PROMPTS.map((prompt) => prompt.id);
shuffle(PROMPTS, mulberry32(7));
assert.deepEqual(
  PROMPTS.map((prompt) => prompt.id),
  original,
  'shuffle must not mutate the prompt pool',
);

const picked = pickPrompts(PROMPTS, ROUNDS_PER_RUN, mulberry32(21));
assert.equal(picked.length, ROUNDS_PER_RUN);
assert.ok(picked.some((prompt) => prompt.kind === 'draw'), 'a run must include a draw round');
assert.ok(picked.some((prompt) => prompt.kind === 'sound'), 'a run must include a sound round');
assert.equal(new Set(picked.map((prompt) => prompt.id)).size, picked.length, 'round prompts must be unique');

const again = pickPrompts(PROMPTS, ROUNDS_PER_RUN, mulberry32(21));
assert.deepEqual(
  again.map((prompt) => prompt.id),
  picked.map((prompt) => prompt.id),
  'pickPrompts must be deterministic for a seeded rng',
);

assert.equal(roundSeconds(0), BASE_SECONDS);
assert.equal(roundSeconds(BASE_SECONDS - MIN_SECONDS), MIN_SECONDS);
assert.equal(roundSeconds(99), MIN_SECONDS);
assert.ok(roundSeconds(3) < roundSeconds(0), 'later rounds should be shorter');

assert.equal(formatTimer(24500), '0:25');
assert.equal(formatTimer(0), '0:00');
assert.equal(formatTimer(-20), '0:00');
assert.equal(formatTimer(65000), '1:05');

assert.equal(nextNudge(0.1, 0), null);
assert.equal(nextNudge(NUDGE_MARKS[0].at, 0), NUDGE_MARKS[0].text);
assert.equal(nextNudge(0.99, NUDGE_MARKS.length), null);

assert.equal(isEmptyDraw({ strokeCount: 0, coverage: 0 }), true);
assert.equal(isEmptyDraw({ strokeCount: 3, coverage: 0.04 }), false);
assert.equal(isEmptySound({ audioMs: 0, peakLevel: 0, padHits: 0 }), true);
assert.equal(isEmptySound({ audioMs: 900, peakLevel: 0.2, padHits: 2 }), false);

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
assert.equal(emptyDraw.points, 0);
assert.equal(emptyDraw.thumbs, 'down');
assert.equal(emptyDraw.empty, true);

const lateDraw = scoreRound(
  {
    kind: 'draw',
    submittedInTime: false,
    remainingMs: 0,
    totalMs: 20000,
    strokeCount: 6,
    uniqueColors: 3,
    coverage: 0.2,
    audioMs: 0,
    peakLevel: 0,
    padHits: 0,
  },
  () => 0,
);
assert.equal(lateDraw.late, true);
assert.ok(lateDraw.points < 100, 'a late drawing should not earn the on-time bonus');

const fastDraw = scoreRound(
  {
    kind: 'draw',
    submittedInTime: true,
    remainingMs: 18000,
    totalMs: 24000,
    strokeCount: 8,
    uniqueColors: 4,
    coverage: 0.25,
    audioMs: 0,
    peakLevel: 0,
    padHits: 0,
  },
  () => 0,
);
const slowDraw = scoreRound(
  {
    kind: 'draw',
    submittedInTime: true,
    remainingMs: 2000,
    totalMs: 24000,
    strokeCount: 8,
    uniqueColors: 4,
    coverage: 0.25,
    audioMs: 0,
    peakLevel: 0,
    padHits: 0,
  },
  () => 0,
);
assert.ok(fastDraw.points > slowDraw.points, 'faster submissions should score higher');
assert.equal(fastDraw.thumbs, 'up');
assert.ok(fastDraw.points >= 100);

const silent = scoreRound(
  {
    kind: 'sound',
    submittedInTime: true,
    remainingMs: 10000,
    totalMs: 20000,
    strokeCount: 0,
    uniqueColors: 0,
    coverage: 0,
    audioMs: 40,
    peakLevel: 0,
    padHits: 0,
  },
  () => 0,
);
assert.equal(silent.empty, true);
assert.equal(silent.points, 0);

const noisy = scoreRound(
  {
    kind: 'sound',
    submittedInTime: true,
    remainingMs: 9000,
    totalMs: 18000,
    strokeCount: 0,
    uniqueColors: 0,
    coverage: 0,
    audioMs: 2400,
    peakLevel: 0.4,
    padHits: 3,
  },
  () => 0,
);
assert.equal(noisy.empty, false);
assert.ok(noisy.points > 100);

assert.equal(totalScore([{ points: 10 }, { points: 15 }]), 25);

console.log(`fakegpt dataset ok: ${PROMPTS.length} prompts, ${draws.length} draw, ${sounds.length} sound`);

import assert from 'node:assert/strict';
import {
  ALL_CARDS,
  FALLBACK_CARDS,
  FALLBACK_PUZZLE,
  HOWTO_CARDS,
  HOWTO_TRIAD,
  LAUNCH_DATE,
  MAX_HINTS,
  MAX_SCORE,
  MAX_TRIADS,
  MIN_SOLVED_SCORE,
  MIN_TRIADS,
  addUtcDays,
  asTriad,
  cardFrom,
  cardFromId,
  cardsById,
  completeCard,
  dailyPuzzle,
  describeCard,
  findTriads,
  fingerprint,
  generatePuzzle,
  gradeFor,
  hintCardId,
  isTriad,
  makeResult,
  practicePuzzle,
  puzzleNumberForDate,
  remainingTriads,
  scoreRun,
  selectionOutcome,
  shareLines,
  triadKey,
  utcDate,
} from '../components/games/triad/logic.ts';

assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);
assert.equal(ALL_CARDS.length, 81);
assert.equal(new Set(ALL_CARDS.map((card) => card.id)).size, 81);
assert.deepEqual(cardFromId(0), cardFrom(0, 0, 0, 0));
assert.equal(cardFrom(2, 2, 2, 2).id, 80);

assert.equal(HOWTO_CARDS.length, 3);
assert.ok(isTriad(HOWTO_CARDS[0]!, HOWTO_CARDS[1]!, HOWTO_CARDS[2]!));
assert.deepEqual(asTriad(HOWTO_CARDS.map((card) => card.id)), HOWTO_TRIAD);
assert.ok(HOWTO_CARDS.every((card) => card.color === 0 && card.count === 0));
assert.deepEqual(
  HOWTO_CARDS.map((card) => card.shape),
  [0, 1, 2],
);
assert.deepEqual(
  HOWTO_CARDS.map((card) => card.fill),
  [0, 1, 2],
);

const sameTwo = completeCard(HOWTO_CARDS[0]!, HOWTO_CARDS[0]!);
assert.equal(sameTwo.id, HOWTO_CARDS[0]!.id);
assert.equal(completeCard(HOWTO_CARDS[0]!, HOWTO_CARDS[1]!).id, HOWTO_CARDS[2]!.id);

const invalid = [cardFrom(0, 0, 0, 0), cardFrom(0, 0, 0, 1), cardFrom(0, 0, 0, 1)];
assert.equal(isTriad(invalid[0]!, invalid[1]!, invalid[2]!), false, 'two-and-one fill is not a triad');

assert.equal(FALLBACK_CARDS.length, 12);
assert.equal(new Set(FALLBACK_CARDS.map((card) => card.id)).size, 12);
assert.ok(FALLBACK_PUZZLE.triads.length >= MIN_TRIADS);
assert.ok(FALLBACK_PUZZLE.triads.length <= MAX_TRIADS);
assert.deepEqual(FALLBACK_PUZZLE.triads, findTriads(FALLBACK_CARDS));

const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.deepEqual(first.cards.map((card) => card.id), again.cards.map((card) => card.id));
assert.deepEqual(first.triads, again.triads);
assert.equal(first.id, `triad-${LAUNCH_DATE}`);
assert.ok(first.triads.length >= MIN_TRIADS, `launch board too thin: ${first.triads.length}`);
assert.ok(first.triads.length <= MAX_TRIADS, `launch board too dense: ${first.triads.length}`);
assert.equal(first.cards.length, 12);

for (const triad of first.triads) {
  const cards = cardsById(first.cards, triad);
  assert.equal(cards.length, 3);
  assert.ok(isTriad(cards[0]!, cards[1]!, cards[2]!), `listed triad ${triadKey(triad)} is not valid`);
}

assert.equal(scoreRun(0, 0), MAX_SCORE);
assert.equal(scoreRun(1, 0), MAX_SCORE - 10);
assert.equal(scoreRun(0, 1), MAX_SCORE - 15);
assert.equal(scoreRun(20, 3), MIN_SOLVED_SCORE);
assert.equal(gradeFor(0, 0), 'clean');
assert.equal(gradeFor(2, 0), 'sharp');
assert.equal(gradeFor(1, 1), 'guided');
assert.equal(gradeFor(4, 0), 'steady');
assert.equal(gradeFor(8, 0), 'messy');

const firstTriad = first.triads[0]!;
assert.equal(selectionOutcome(first, firstTriad, []), 'valid');
assert.equal(selectionOutcome(first, firstTriad, [triadKey(firstTriad)]), 'repeat');
assert.equal(selectionOutcome(first, first.cards.slice(0, 2).map((card) => card.id), []), 'short');
assert.equal(selectionOutcome(first, [first.cards[0]!.id, first.cards[1]!.id, 99], []), 'invalid');

const leftover = remainingTriads(first, [triadKey(firstTriad)]);
assert.equal(leftover.length, first.triads.length - 1);
const hinted = hintCardId(first, [triadKey(firstTriad)], []);
assert.ok(hinted !== null);
assert.ok(leftover.some((triad) => triad.includes(hinted!)));

assert.equal(MAX_HINTS, 3);
assert.ok(describeCard(HOWTO_CARDS[0]!).includes('diamond'));

const seen = new Set<string>();
const started = Date.now();
let usedFallback = 0;

for (let offset = 0; offset < 400; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  const twice = dailyPuzzle(date);
  assert.equal(puzzle.id, twice.id, `${date} is not deterministic`);
  assert.deepEqual(
    puzzle.cards.map((card) => card.id),
    twice.cards.map((card) => card.id),
  );
  assert.equal(puzzle.id, `triad-${date}`);
  assert.equal(puzzle.cards.length, 12, `${date} board size`);
  assert.equal(new Set(puzzle.cards.map((card) => card.id)).size, 12, `${date} duplicate cards`);
  assert.ok(puzzle.triads.length >= MIN_TRIADS, `${date} too few triads (${puzzle.triads.length})`);
  assert.ok(puzzle.triads.length <= MAX_TRIADS, `${date} too many triads (${puzzle.triads.length})`);
  assert.deepEqual(puzzle.triads, findTriads(puzzle.cards), `${date} triad list drifted`);
  if (fingerprint(puzzle) === fingerprint(FALLBACK_PUZZLE) && puzzle.id !== FALLBACK_PUZZLE.id) {
    usedFallback += 1;
  }
  seen.add(fingerprint(puzzle));
}

assert.ok(seen.size >= 300, `daily boards should vary, got ${seen.size} unique in 400 days`);
assert.ok(usedFallback <= 4, `too many days fell back to the canned board: ${usedFallback}`);

const practice = practicePuzzle(42, LAUNCH_DATE);
const practiceAgain = practicePuzzle(42, LAUNCH_DATE);
assert.equal(practice.id, practiceAgain.id, 'practice seed must be deterministic');
assert.deepEqual(
  practice.cards.map((card) => card.id),
  practiceAgain.cards.map((card) => card.id),
);
assert.notEqual(fingerprint(practice), fingerprint(first), 'practice should avoid today’s board when it can');
assert.ok(practice.triads.length >= MIN_TRIADS);
assert.ok(practice.triads.length <= MAX_TRIADS);

const handmade = generatePuzzle(99, 'triad-hand');
assert.ok(handmade.triads.length >= MIN_TRIADS);
assert.ok(handmade.triads.length <= MAX_TRIADS);

const scored = makeResult(first, first.triads, 0, 0);
assert.equal(scored.points, MAX_SCORE);
assert.equal(scored.solved, true);
assert.equal(scored.grade, 'clean');
const unfinished = makeResult(first, first.triads.slice(0, 1), 2, 0);
assert.equal(unfinished.solved, false);
assert.equal(unfinished.points, 0);

const lines = shareLines(scored, 'daily', LAUNCH_DATE);
assert.equal(lines[0], 'Triad #1');
assert.ok(lines[1].includes('🎴'));
assert.ok(lines[2].includes(`${MAX_SCORE}`));

const elapsed = Date.now() - started;
const today = utcDate();
console.log(
  `triad-ok launch=${first.id} triads=${first.triads.length} today=${dailyPuzzle(today).id} days=400 unique=${seen.size} fallbacks=${usedFallback} ms=${elapsed}`,
);

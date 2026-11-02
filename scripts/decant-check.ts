import assert from 'node:assert/strict';
import {
  FALLBACK_THREE,
  FALLBACK_TWO,
  HOWTO_PUZZLE,
  LAUNCH_DATE,
  MAX_SCORE,
  MIN_SOLVED_SCORE,
  addUtcDays,
  applyMove,
  applyMoves,
  blockedReason,
  bezoutFor,
  dailyPuzzle,
  euclidSteps,
  fingerprint,
  gcd,
  gcdAll,
  generatePuzzle,
  gradeFor,
  isWeekend,
  makeResult,
  meetsGoal,
  practicePuzzle,
  puzzleNumberForDate,
  scorePours,
  shareLines,
  solve,
  utcDate,
} from '../components/games/decant/logic.ts';

assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);

assert.deepEqual(HOWTO_PUZZLE.capacities, [5, 3]);
assert.equal(HOWTO_PUZZLE.goal.kind, 'any');
if (HOWTO_PUZZLE.goal.kind === 'any') assert.equal(HOWTO_PUZZLE.goal.amount, 4);
assert.equal(HOWTO_PUZZLE.optimal, 6, '5 and 3 measure 4 in six pours');
assert.ok(meetsGoal(HOWTO_PUZZLE.solution.reduce(
  (state, move) => applyMove(HOWTO_PUZZLE.capacities, state, move) ?? state,
  [0, 0],
), HOWTO_PUZZLE.goal));

const howToSolved = applyMoves(HOWTO_PUZZLE.capacities, HOWTO_PUZZLE.start, HOWTO_PUZZLE.solution);
assert.ok(howToSolved);
assert.ok(meetsGoal(howToSolved, HOWTO_PUZZLE.goal));

const emptySolve = solve(HOWTO_PUZZLE.capacities, HOWTO_PUZZLE.start, HOWTO_PUZZLE.goal);
assert.ok(emptySolve);
assert.equal(emptySolve.moves.length, HOWTO_PUZZLE.optimal);

assert.equal(blockedReason([5, 3], [5, 0], { kind: 'fill', jug: 0 }), 'That jug is already full.');
assert.equal(blockedReason([5, 3], [0, 0], { kind: 'empty', jug: 0 }), 'That jug is already empty.');
assert.equal(blockedReason([5, 3], [0, 3], { kind: 'pour', from: 0, to: 1 }), 'Nothing left to pour.');
assert.equal(blockedReason([5, 3], [2, 3], { kind: 'pour', from: 0, to: 1 }), 'That jug is already full.');
assert.equal(blockedReason([5, 3], [0, 0], { kind: 'fill', jug: 0 }), null);

assert.equal(gcd(5, 3), 1);
assert.equal(gcdAll([8, 5, 3]), 1);
assert.equal(gcdAll([12, 8, 4]), 4);
assert.ok(euclidSteps(5, 3).length >= 2);
const bezout = bezoutFor(5, 3, 4);
assert.ok(bezout);
assert.equal(5 * bezout.x + 3 * bezout.y, 4);

assert.deepEqual(FALLBACK_THREE.capacities, [8, 5, 3]);
const threeEnd = applyMoves(FALLBACK_THREE.capacities, FALLBACK_THREE.start, FALLBACK_THREE.solution);
assert.ok(threeEnd);
assert.ok(meetsGoal(threeEnd, FALLBACK_THREE.goal));
assert.ok(FALLBACK_THREE.optimal >= 6);

const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.deepEqual(first.capacities, again.capacities);
assert.deepEqual(first.goal, again.goal);
assert.deepEqual(first.solution, again.solution);
assert.equal(first.id, `decant-${LAUNCH_DATE}`);
assert.ok(!isWeekend(LAUNCH_DATE), 'launch day is a Monday');
assert.equal(first.capacities.length, 2, 'weekdays are two-jug pours');
assert.ok(first.lesson.length >= 3, 'daily needs a lesson');
assert.ok(first.blurb.length > 40, 'daily needs a blurb');

const launchEnd = applyMoves(first.capacities, first.start, first.solution);
assert.ok(launchEnd);
assert.ok(meetsGoal(launchEnd, first.goal), 'stored solution must solve the daily');
const launchSolved = solve(first.capacities, first.start, first.goal);
assert.ok(launchSolved);
assert.equal(launchSolved.moves.length, first.optimal, 'optimal must match BFS');

assert.equal(scorePours(first.optimal, first.optimal), MAX_SCORE);
assert.equal(scorePours(first.optimal + 1, first.optimal), MAX_SCORE - 12);
assert.equal(scorePours(first.optimal + 20, first.optimal), MIN_SOLVED_SCORE);
assert.equal(gradeFor(first.optimal, first.optimal), 'par');
assert.equal(gradeFor(first.optimal + 1, first.optimal), 'close');
assert.equal(gradeFor(first.optimal + 3, first.optimal), 'steady');
assert.equal(gradeFor(first.optimal + 5, first.optimal), 'patient');

const seen = new Set<string>();
let weekendDays = 0;
let weekdayDays = 0;
const started = Date.now();

for (let offset = 0; offset < 180; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  const twice = dailyPuzzle(date);
  assert.equal(puzzle.id, twice.id, `${date} is not deterministic`);
  assert.deepEqual(puzzle.solution, twice.solution);
  assert.equal(puzzle.id, `decant-${date}`);
  assert.notEqual(puzzle.id, 'decant-how-to', `${date} fell back to the how-to id`);

  const g = gcdAll(puzzle.capacities);
  assert.ok(g >= 1);
  if (puzzle.goal.kind === 'any') {
    assert.equal(puzzle.goal.amount % g, 0, `${date} target not a gcd multiple`);
    assert.ok(puzzle.goal.amount > 0);
    assert.ok(puzzle.goal.amount < Math.max(...puzzle.capacities));
  } else {
    for (const amount of puzzle.goal.amounts) {
      if (amount === null) continue;
      assert.equal(amount % g, 0, `${date} match not a gcd multiple`);
    }
  }

  if (isWeekend(date)) {
    weekendDays += 1;
    assert.equal(puzzle.capacities.length, 3, `${date} weekend should be three jugs`);
  } else {
    weekdayDays += 1;
    assert.equal(puzzle.capacities.length, 2, `${date} weekday should be two jugs`);
  }

  assert.ok(puzzle.optimal >= 4, `${date} too easy (${puzzle.optimal})`);
  assert.ok(puzzle.optimal <= 14, `${date} too long (${puzzle.optimal})`);
  const end = applyMoves(puzzle.capacities, puzzle.start, puzzle.solution);
  assert.ok(end, `${date} stored solution applies`);
  assert.ok(meetsGoal(end, puzzle.goal), `${date} stored solution fails`);
  const found = solve(puzzle.capacities, puzzle.start, puzzle.goal);
  assert.ok(found, `${date} is unsolvable`);
  assert.equal(found.moves.length, puzzle.optimal, `${date} optimal drifted`);
  assert.ok(puzzle.lesson.length >= 3, `${date} missing lesson`);
  assert.ok(puzzle.prompt.length > 8, `${date} missing prompt`);
  seen.add(fingerprint(puzzle));
}

assert.ok(weekdayDays >= 120, `expected many weekdays, got ${weekdayDays}`);
assert.ok(weekendDays >= 48, `expected many weekends, got ${weekendDays}`);
assert.ok(seen.size >= 80, `daily layouts should vary, got ${seen.size} unique in 180 days`);

const practice = practicePuzzle(42, LAUNCH_DATE);
const practiceAgain = practicePuzzle(42, LAUNCH_DATE);
assert.equal(practice.id, practiceAgain.id, 'practice seed must be deterministic');
assert.deepEqual(practice.capacities, practiceAgain.capacities);
assert.notEqual(fingerprint(practice), fingerprint(first), 'practice should avoid today’s jugs when it can');
const practiceEnd = applyMoves(practice.capacities, practice.start, practice.solution);
assert.ok(practiceEnd);
assert.ok(meetsGoal(practiceEnd, practice.goal));

const handmade = generatePuzzle(99, false, 'decant-hand');
assert.notEqual(handmade.id, 'decant-how-to');
assert.ok(handmade.optimal >= 4);
const handEnd = applyMoves(handmade.capacities, handmade.start, handmade.solution);
assert.ok(handEnd);
assert.ok(meetsGoal(handEnd, handmade.goal));

const scored = makeResult(first, first.optimal, launchEnd ?? first.start);
assert.equal(scored.points, MAX_SCORE);
assert.equal(scored.grade, 'par');
const lines = shareLines(scored, 'daily', LAUNCH_DATE);
assert.equal(lines[0], 'Decant #1');
assert.ok(lines[2].includes('💧'));
assert.ok(lines[3].includes(`${MAX_SCORE}`));

assert.ok(FALLBACK_TWO.optimal >= 4);

const elapsed = Date.now() - started;
const today = utcDate();
console.log(
  `decant-ok launch=${first.id} caps=${first.capacities.join('x')} today=${dailyPuzzle(today).id} days=180 unique=${seen.size} weekends=${weekendDays} ms=${elapsed}`,
);

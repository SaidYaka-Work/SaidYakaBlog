import assert from 'node:assert/strict';
import {
  HOWTO_PUZZLE,
  LAUNCH_DATE,
  MAX_SCORE,
  addUtcDays,
  countSolutions,
  cycleBridge,
  dailyPuzzle,
  dateSeed,
  emptyBridges,
  generatePuzzle,
  isSolved,
  isWeekend,
  makeResult,
  nextLegalCount,
  practicePuzzle,
  puzzleNumberForDate,
  setBridge,
  shareLines,
  solutionBridges,
  solve,
  utcDate,
} from '../components/games/span/logic.ts';

assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);

assert.ok(isSolved(HOWTO_PUZZLE, solutionBridges(HOWTO_PUZZLE)), 'how-to must be solved by its solution');
assert.equal(countSolutions(HOWTO_PUZZLE, 3).count, 1, 'how-to must be unique');

const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.deepEqual(first.islands, again.islands);
assert.deepEqual(first.solution, again.solution);
assert.equal(first.size, 7, 'launch day is a Friday 7×7');
assert.ok(!isWeekend(LAUNCH_DATE));
assert.ok(first.islands.length >= 8 && first.islands.length <= 10, `weekday island count ${first.islands.length}`);
assert.ok(isSolved(first, solutionBridges(first)), 'stored solution must solve the daily');
assert.equal(countSolutions(first, 3).count, 1, 'daily must be unique');
assert.deepEqual(solve(first), solutionBridges(first));

const seen = new Set<string>();
let weekendDays = 0;
let weekdayDays = 0;
const started = Date.now();

for (let offset = 0; offset < 90; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  const fingerprint = `${puzzle.size}:${puzzle.islands.map((island) => `${island.row},${island.col}:${island.need}`).join('|')}`;
  assert.ok(puzzle.islands.length >= 6, `${date} too few islands`);
  assert.ok(
    puzzle.islands.every((island) => island.need >= 1 && island.need <= 8),
    `${date} has an illegal number`,
  );
  const cells = new Set(puzzle.islands.map((island) => `${island.row},${island.col}`));
  assert.equal(cells.size, puzzle.islands.length, `${date} stacked islands`);
  assert.ok(isSolved(puzzle, solutionBridges(puzzle)), `${date} stored solution fails`);
  const found = countSolutions(puzzle, 3);
  assert.equal(found.count, 1, `${date} is not unique (${found.count})`);
  assert.ok(found.first, `${date} solver returned no solution`);
  assert.deepEqual(found.first, solutionBridges(puzzle), `${date} solver recovered a different layout`);
  if (isWeekend(date)) {
    weekendDays += 1;
    assert.equal(puzzle.size, 8, `${date} weekend should be 8×8`);
    assert.ok(puzzle.islands.length >= 11, `${date} weekend too small`);
  } else {
    weekdayDays += 1;
    assert.equal(puzzle.size, 7, `${date} weekday should be 7×7`);
  }
  seen.add(fingerprint);
}

assert.ok(weekdayDays >= 60, `expected many weekdays, got ${weekdayDays}`);
assert.ok(weekendDays >= 24, `expected many weekends, got ${weekendDays}`);
assert.ok(seen.size >= 80, `daily layouts should vary, got ${seen.size} unique in 90 days`);

const practice = practicePuzzle(42);
const practiceAgain = practicePuzzle(42);
assert.equal(practice.id, practiceAgain.id);
assert.deepEqual(practice.solution, practiceAgain.solution);
assert.ok(isSolved(practice, solutionBridges(practice)));
assert.equal(countSolutions(practice, 3).count, 1);

const handmade = generatePuzzle(dateSeed('2026-11-02'), { size: 7, islands: 9, id: 'span-hand' });
assert.equal(countSolutions(handmade, 3).count, 1);

let draft = emptyBridges();
assert.ok(!isSolved(first, draft));
for (const [key, count] of Object.entries(first.solution)) {
  const [a, b] = key.split('-').map(Number);
  const once = nextLegalCount(first, draft, a, b);
  assert.equal(once, 1);
  draft = setBridge(draft, a, b, 1);
  if (count === 2) {
    const twice = nextLegalCount(first, draft, a, b);
    assert.equal(twice, 2);
    draft = cycleBridge(draft, a, b);
  }
}
assert.ok(isSolved(first, draft), 'cycling the solution must win');

const result = makeResult(first, 80, 12);
assert.ok(result.points <= MAX_SCORE && result.points >= 20);
assert.match(shareLines(result, 'daily', LAUNCH_DATE).join('\n'), /Span #1/);
assert.match(shareLines(result, 'practice', LAUNCH_DATE).join('\n'), /practice/);

const elapsed = Date.now() - started;
assert.ok(elapsed < 15_000, `generation took too long: ${elapsed}ms`);

const today = utcDate();
console.log(
  `span-ok launch=${first.id} islands=${first.islands.length} today=${dailyPuzzle(today).id} days=90 unique=${seen.size} ms=${elapsed}`,
);

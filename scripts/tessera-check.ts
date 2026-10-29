import assert from 'node:assert/strict';
import {
  LAUNCH_DATE,
  MAX_SCORE,
  PUZZLES,
  SPECS,
  addUtcDays,
  cluesFromGrid,
  cluesFromLine,
  dailyPuzzle,
  dailySpec,
  emptyGrid,
  gradeFor,
  isLineSolvable,
  isSolved,
  isWeekend,
  lineSolve,
  parseRows,
  placementsFor,
  practicePuzzle,
  puzzleNumberForDate,
  scoreRun,
  setCell,
  shareLines,
  utcDate,
  weekendSpecs,
  weekdaySpecs,
  wrongCells,
} from '../components/games/tessera/logic.ts';

assert.ok(SPECS.length >= 40, `need at least 40 pictures, got ${SPECS.length}`);
assert.equal(PUZZLES.length, SPECS.length);
assert.ok(weekdaySpecs().length >= 30, `need a weekday bank, got ${weekdaySpecs().length}`);
assert.ok(weekendSpecs().length >= 6, `need a weekend bank, got ${weekendSpecs().length}`);

for (const spec of SPECS) {
  const picture = parseRows(spec.rows, spec.size);
  assert.equal(picture.length, spec.size, `${spec.id} height`);
  assert.ok(
    picture.every((row) => row.length === spec.size),
    `${spec.id} is not square`,
  );
  assert.ok(isLineSolvable(picture), `${spec.id} must be uniquely line-solvable`);
  const { rowClues, colClues } = cluesFromGrid(picture);
  const solved = lineSolve(rowClues, colClues);
  assert.ok(solved.solved, `${spec.id} solver stalled with ${solved.unknown} unknowns`);
  assert.ok(
    solved.grid.every((row, r) => row.every((cell, c) => (cell === 1) === picture[r][c])),
    `${spec.id} solver recovered a different picture`,
  );
  assert.deepEqual(
    picture.map(cluesFromLine),
    rowClues,
    `${spec.id} row clues drifted`,
  );
}

const today = utcDate();
const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.deepEqual(first.picture, again.picture);
assert.equal(first.size, 10, 'launch day should be a weekday 10×10');
assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);
assert.ok(!isWeekend(LAUNCH_DATE));

const weekdaySeen = new Set<string>();
for (let offset = 0; offset < weekdaySpecs().length; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  if (isWeekend(date)) continue;
  const puzzle = dailyPuzzle(date);
  assert.equal(puzzle.size, 10, `${date} weekday should be 10×10`);
  assert.ok(!weekdaySeen.has(puzzle.id), `${date} repeats ${puzzle.id} in the weekday rotation`);
  weekdaySeen.add(puzzle.id);
}

const weekendSeen = new Set<string>();
let weekendDays = 0;
for (let offset = 0; offset < 80; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  if (!isWeekend(date)) continue;
  const puzzle = dailyPuzzle(date);
  assert.ok(puzzle.size >= 12, `${date} weekend should be 12×12 or 15×15`);
  if (weekendDays < weekendSpecs().length) {
    assert.ok(!weekendSeen.has(puzzle.id), `${date} repeats ${puzzle.id} in the weekend rotation`);
    weekendSeen.add(puzzle.id);
  }
  weekendDays += 1;
}
assert.equal(weekendSeen.size, weekendSpecs().length, 'weekend rotation should visit every large picture once');

assert.equal(dailyPuzzle(addUtcDays(LAUNCH_DATE, 0)).id, first.id);

const practice = practicePuzzle(42, LAUNCH_DATE);
assert.notEqual(practice.id, first.id, 'practice should avoid today’s picture when it can');
assert.equal(practicePuzzle(42, LAUNCH_DATE).id, practice.id, 'practice seed must be deterministic');

const empty = emptyGrid(first.size);
assert.equal(isSolved(first, empty), false);
const filled = first.picture.map((row) => row.map((cell) => (cell ? 'fill' : 'empty')));
assert.ok(isSolved(first, filled));
const marked = first.picture.map((row) => row.map((cell) => (cell ? 'fill' : 'mark')));
assert.ok(isSolved(first, marked), 'marks on empty cells should not block a win');
assert.equal(wrongCells(first, setCell(empty, 0, 0, first.picture[0][0] ? 'mark' : 'fill')).length, 1);

assert.equal(scoreRun(10, 0, 0, 10), MAX_SCORE);
assert.ok(scoreRun(10_000, 9, 40, 10) >= 20);
assert.equal(gradeFor(10, 0, 10), 'swift');
assert.equal(gradeFor(10, 3, 10), 'guided');

const lines = shareLines(
  {
    puzzle: first,
    seconds: 94,
    checks: 1,
    mistakes: 2,
    points: 88,
    grade: 'checked',
  },
  'daily',
  LAUNCH_DATE,
);
assert.equal(lines[0], 'Tessera #1');
assert.match(lines[1], /10×10/);
assert.equal(lines[2], '88/100');

const plus = placementsFor(10, [10]);
assert.equal(plus.length, 1);
assert.ok(plus[0].every(Boolean));
assert.equal(placementsFor(5, []).length, 1);

assert.equal(dailySpec(today).id, dailyPuzzle(today).id);

console.log(
  `tessera-ok bank=${SPECS.length} weekday=${weekdaySpecs().length} weekend=${weekendSpecs().length} launch=${first.id} today=${dailyPuzzle(today).id}`,
);

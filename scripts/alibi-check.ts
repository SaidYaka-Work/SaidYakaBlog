import assert from 'node:assert/strict';
import {
  LAUNCH_DATE,
  WORLDS,
  addUtcDays,
  assignmentsEqual,
  buildPuzzle,
  cluesAreNecessary,
  cycleMark,
  dailyPuzzle,
  emptyGrid,
  inferredAssignment,
  isSolved,
  practicePuzzle,
  scoreRun,
  setMark,
  solutionCount,
  solutionsFor,
  truthMark,
  utcDate,
  wrongCells,
} from '../components/games/alibi/logic.ts';

assert.ok(WORLDS.length >= 8, `need a bank of worlds, got ${WORLDS.length}`);

const today = utcDate();
const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.world.id, again.world.id, 'daily puzzles must be deterministic');
assert.deepEqual(first.solution, again.solution);
assert.deepEqual(
  first.clues.map((clue) => clue.text),
  again.clues.map((clue) => clue.text),
);

assert.equal(first.size, 4);
assert.equal(first.categories, 3);
assert.equal(solutionCount(first.size, first.categories, first.clues), 1);
assert.ok(assignmentsEqual(solutionsFor(first.size, first.categories, first.clues)[0], first.solution));
assert.ok(cluesAreNecessary(first.size, first.categories, first.clues), 'launch-day clues must each be needed');

const practice = practicePuzzle(42);
assert.equal(practice.size, 3);
assert.equal(practice.categories, 2);
assert.equal(solutionCount(practice.size, practice.categories, practice.clues), 1);
assert.ok(cluesAreNecessary(practice.size, practice.categories, practice.clues));

let fallbacks = 0;
const days = 400;
for (let offset = 0; offset < days; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  const count = solutionCount(puzzle.size, puzzle.categories, puzzle.clues);
  assert.equal(count, 1, `${date} should have a unique solution, got ${count}`);
  assert.ok(
    assignmentsEqual(solutionsFor(puzzle.size, puzzle.categories, puzzle.clues)[0], puzzle.solution),
    `${date} solver must recover the intended assignment`,
  );
  assert.ok(puzzle.clues.length >= 5 && puzzle.clues.length <= 11, `${date} clue count ${puzzle.clues.length}`);
  assert.ok(
    cluesAreNecessary(puzzle.size, puzzle.categories, puzzle.clues),
    `${date} has a redundant clue`,
  );
  assert.ok(puzzle.clues.every((clue) => clue.text.trim().length > 12), `${date} has a thin clue`);
  assert.ok(
    puzzle.clues.every((clue) => /^[A-Z]/.test(clue.text)),
    `${date} has a clue that does not start as a sentence`,
  );
  const hay = puzzle.clues.map((clue) => clue.text).join(' ').toLowerCase();
  assert.ok(
    puzzle.world.people.some((person) => hay.includes(person.name.toLowerCase()) || hay.includes(person.role)),
    `${date} clues never name a guest`,
  );
  if (puzzle.generated === 'fallback') fallbacks += 1;
}

assert.equal(fallbacks, 0, `daily generation used ${fallbacks} fallbacks in ${days} days`);

for (let seed = 0; seed < 80; seed += 1) {
  const puzzle = practicePuzzle(seed * 997 + 13);
  assert.equal(puzzle.size, 3);
  assert.equal(solutionCount(puzzle.size, puzzle.categories, puzzle.clues), 1, `practice ${seed} is not unique`);
  assert.ok(cluesAreNecessary(puzzle.size, puzzle.categories, puzzle.clues), `practice ${seed} has a spare clue`);
  assert.equal(puzzle.generated, 'search', `practice ${seed} fell back`);
}

const sample = dailyPuzzle(today);
const grid = emptyGrid(sample.size);
assert.equal(isSolved(sample, grid), false);
assert.equal(wrongCells(sample, grid).length, 0);

let filled = grid;
for (let person = 0; person < sample.size; person += 1) {
  filled = setMark(filled, { grid: 'personRoom', row: person, col: sample.solution.personRoom[person] }, 'yes', 3);
  filled = setMark(filled, { grid: 'personTime', row: person, col: sample.solution.personTime[person] }, 'yes', 3);
}
assert.ok(isSolved(sample, filled), 'placing the true checks should solve the case');
assert.ok(inferredAssignment(filled, 3));

const wrong = setMark(emptyGrid(sample.size), { grid: 'personRoom', row: 0, col: (sample.solution.personRoom[0] + 1) % sample.size }, 'yes', 3);
assert.ok(wrongCells(sample, wrong).length > 0);

const cycled = cycleMark(emptyGrid(sample.size), { grid: 'personRoom', row: 0, col: 0 }, 3);
assert.equal(cycled.personRoom[0][0], 'no');
const cycledYes = cycleMark(cycled, { grid: 'personRoom', row: 0, col: 0 }, 3);
assert.equal(cycledYes.personRoom[0][0], 'yes');
assert.ok(cycledYes.personRoom[0].slice(1).every((mark) => mark === 'no'));

assert.equal(truthMark(sample, { grid: 'personRoom', row: 0, col: sample.solution.personRoom[0] }), 'yes');
assert.equal(scoreRun(60, 0, 0), 100);
assert.ok(scoreRun(600, 3, 4) < 100);
assert.ok(scoreRun(600, 8, 20) >= 20);

const rebuilt = buildPuzzle(((2026 * 10000 + 10 * 100 + 26) ^ 0xa11b1e) >>> 0, 'daily');
assert.equal(rebuilt.world.id, dailyPuzzle('2026-10-26').world.id);

console.log(
  `alibi-ok days=${days} worlds=${WORLDS.length} launch=${first.world.place} clues=${first.clues.length} today=${sample.world.place}`,
);

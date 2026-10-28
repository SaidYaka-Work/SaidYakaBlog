import assert from 'node:assert/strict';
import {
  LAUNCH_DATE,
  MAX_SCORE,
  MAX_TRIES,
  addUtcDays,
  dailyPuzzle,
  dateSeed,
  findSolutions,
  generatePuzzle,
  gradeFor,
  guessTone,
  parseGuess,
  practicePuzzle,
  puzzleIdentity,
  puzzleNumberForDate,
  scoreAttempt,
  shareLines,
  sideWeight,
  utcDate,
} from '../components/games/counterweight/logic.ts';

const today = utcDate();
const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);

assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.equal(puzzleIdentity(first), puzzleIdentity(again));
assert.equal(first.answer, again.answer);
assert.deepEqual(
  first.shapes.map((shape) => shape.weight),
  again.shapes.map((shape) => shape.weight),
);
assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);
assert.equal(first.shapes.length, 3, 'launch day should be a three-shape pair puzzle');

const seen = new Set<string>();
const counts = { 3: 0, 4: 0, 5: 0 };

for (let offset = 0; offset < 400; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  const twice = dailyPuzzle(date);
  assert.equal(puzzle.id, twice.id, `${date} is not deterministic`);
  assert.equal(puzzle.answer, twice.answer);

  assert.ok(puzzle.shapes.length >= 3 && puzzle.shapes.length <= 5, `${date} has ${puzzle.shapes.length} shapes`);
  counts[puzzle.shapes.length as 3 | 4 | 5] += 1;

  const ids = puzzle.shapes.map((shape) => shape.id);
  assert.equal(new Set(ids).size, ids.length, `${date} repeats a shape`);
  const weights = Object.fromEntries(puzzle.shapes.map((shape) => [shape.id, shape.weight]));
  const used = new Set(puzzle.shapes.map((shape) => shape.weight));
  assert.equal(used.size, puzzle.shapes.length, `${date} has repeated weights`);
  for (const shape of puzzle.shapes) {
    assert.ok(shape.weight >= 1 && shape.weight <= 9, `${date} weight ${shape.weight} out of range`);
  }

  assert.ok(puzzle.scales.length >= 2 && puzzle.scales.length <= 5, `${date} has ${puzzle.scales.length} scales`);
  for (const scale of puzzle.scales) {
    assert.equal(sideWeight(scale.left, weights), sideWeight(scale.right, weights), `${date} has an unbalanced scale`);
  }
  assert.equal(sideWeight(puzzle.question, weights), puzzle.answer, `${date} question does not match weights`);

  const solutions = findSolutions(ids, puzzle.scales);
  assert.equal(solutions.length, 1, `${date} has ${solutions.length} solutions`);
  assert.ok(
    puzzle.shapes.every((shape) => solutions[0][shape.id] === shape.weight),
    `${date} solver disagrees with stored weights`,
  );

  assert.ok(puzzle.steps.length >= 2, `${date} is missing reasoning`);
  assert.ok(puzzle.steps.every((step) => step.title && step.text.length > 20), `${date} has a thin step`);
  assert.equal(puzzle.hints.length, 3);
  assert.ok(puzzle.hints.every((hint) => hint.length > 12), `${date} has a thin hint`);
  assert.ok(puzzle.blurb.length > 40, `${date} is missing a blurb`);

  seen.add(puzzleIdentity(puzzle));
}

assert.ok(seen.size >= 360, `expected mostly unique dailies, got ${seen.size}`);
assert.ok(counts[3] > 0 && counts[4] > 0 && counts[5] > 0, `need all sizes, got ${JSON.stringify(counts)}`);

const practice = practicePuzzle(42, LAUNCH_DATE);
assert.notEqual(practice.id, first.id, 'practice should avoid today’s puzzle when it can');
assert.equal(practicePuzzle(42, LAUNCH_DATE).id, practice.id, 'practice seed must be deterministic');
assert.equal(findSolutions(practice.shapes.map((shape) => shape.id), practice.scales).length, 1);

for (let seed = 0; seed < 80; seed += 1) {
  const puzzle = generatePuzzle(dateSeed(addUtcDays(LAUNCH_DATE, seed)) ^ ((seed + 1) * 0x45d9f3b));
  const solutions = findSolutions(
    puzzle.shapes.map((shape) => shape.id),
    puzzle.scales,
  );
  assert.equal(solutions.length, 1, `seed ${seed} has ${solutions.length} solutions`);
}

assert.equal(parseGuess('13'), 13);
assert.equal(parseGuess('  9 '), 9);
assert.equal(parseGuess(''), null);
assert.equal(parseGuess('3.5'), null);
assert.equal(parseGuess('0'), null);
assert.equal(guessTone(13, 13), 'hit');
assert.equal(guessTone(12, 13), 'close');
assert.equal(guessTone(100, 13), 'miss');
assert.equal(scoreAttempt(1, true), MAX_SCORE);
assert.equal(scoreAttempt(4, true), 40);
assert.equal(scoreAttempt(4, false), 0);
assert.equal(gradeFor(1, true), 'first');
assert.equal(gradeFor(4, false), 'miss');

const lines = shareLines(
  {
    puzzle: first,
    attempts: [
      { guess: first.answer + 2, tone: 'close' },
      { guess: first.answer, tone: 'hit' },
    ],
    solved: true,
    tries: 2,
    points: 80,
    grade: 'second',
  },
  'daily',
  LAUNCH_DATE,
);
assert.equal(lines[0], 'Counterweight #1');
assert.equal(lines[1], '🟨🟩');
assert.equal(lines[2], `2/${MAX_TRIES} · 80/${MAX_SCORE}`);

assert.equal(dailyPuzzle(today).id, dailyPuzzle(today).id);

console.log(
  `counterweight-ok launch=${first.shapes.map((shape) => `${shape.id[0]}${shape.weight}`).join('')} today=${dailyPuzzle(today).id.slice(0, 24)} days=400 unique=${seen.size} mix=${JSON.stringify(counts)}`,
);

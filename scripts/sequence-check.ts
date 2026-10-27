import assert from 'node:assert/strict';
import {
  LAUNCH_DATE,
  MAX_SCORE,
  MAX_TRIES,
  PUZZLES,
  SPECS,
  addUtcDays,
  dailyPuzzle,
  dailySpec,
  gradeFor,
  guessTone,
  parseGuess,
  practicePuzzle,
  puzzleNumberForDate,
  rotationOrder,
  scoreAttempt,
  shareLines,
  utcDate,
} from '../components/games/sequence/logic.ts';

assert.ok(SPECS.length >= 40, `need at least 40 sequences, got ${SPECS.length}`);
assert.equal(PUZZLES.length, SPECS.length);

const known: Record<string, number[]> = {
  fibonacci: [1, 1, 2, 3, 5, 8, 13, 21, 34],
  lucas: [2, 1, 3, 4, 7, 11, 18, 29],
  pell: [1, 2, 5, 12, 29, 70, 169, 408],
  primes: [2, 3, 5, 7, 11, 13, 17, 19],
  catalan: [1, 2, 5, 14, 42, 132, 429],
  bell: [1, 2, 5, 15, 52, 203, 877],
  motzkin: [1, 2, 4, 9, 21, 51, 127, 323],
  factorials: [1, 2, 6, 24, 120, 720, 5040],
  triangular: [1, 3, 6, 10, 15, 21, 28, 36],
  pentagonal: [1, 5, 12, 22, 35, 51, 70],
  'look-and-say': [1, 11, 21, 1211, 111221, 312211],
  recaman: [0, 1, 3, 6, 2, 7, 13, 20, 12],
  lucky: [1, 3, 7, 9, 13, 15, 21, 25, 31],
  happy: [1, 7, 10, 13, 19, 23, 28, 31],
  perfect: [6, 28, 496, 8128],
  fermat: [3, 5, 17, 257, 65537],
  partition: [1, 2, 3, 5, 7, 11, 15, 22],
  derangements: [1, 2, 9, 44, 265, 1854],
  'highly-composite': [1, 2, 4, 6, 12, 24, 36, 48, 60, 120],
  golomb: [1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5],
  kolakoski: [1, 2, 2, 1, 1, 2, 1, 2, 2, 1, 2, 2],
  hamming: [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16],
  cake: [1, 2, 4, 8, 15, 26, 42, 64],
  'lazy-caterer': [1, 2, 4, 7, 11, 16, 22, 29],
  'sophie-germain': [2, 3, 5, 11, 23, 29, 41, 53],
  'twin-primes': [3, 5, 11, 17, 29, 41, 59, 71],
  sylvester: [2, 3, 7, 43, 1807],
  'collatz-seven': [7, 22, 11, 34, 17, 52, 26],
  'beatty-pi': [3, 6, 9, 12, 15, 18, 21, 25, 28],
  automorphic: [1, 5, 6, 25, 76, 376, 625],
};

for (const spec of SPECS) {
  const extra = known[spec.id];
  if (!extra) continue;
  const generated = spec.generate(extra.length);
  assert.deepEqual(generated, extra, `${spec.id} disagrees with the known prefix`);
}

const today = utcDate();
const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.deepEqual(first.shown, again.shown);
assert.equal(first.answer, again.answer);
assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);

const seen = new Set<string>();
for (let offset = 0; offset < SPECS.length; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  assert.ok(!seen.has(puzzle.id), `${date} repeats ${puzzle.id} inside one rotation`);
  seen.add(puzzle.id);
  const spec = SPECS.find((row) => row.id === puzzle.id);
  assert.ok(spec, `${date} produced unknown ${puzzle.id}`);
  assert.equal(puzzle.shown.length, spec.shownCount);
  assert.ok(Number.isSafeInteger(puzzle.answer));
  assert.equal(puzzle.hints.length, 4);
  assert.ok(puzzle.hints.every((hint) => hint.length > 12));
}

assert.equal(seen.size, SPECS.length, 'rotation should visit every sequence once');
assert.equal(dailyPuzzle(addUtcDays(LAUNCH_DATE, SPECS.length)).id, first.id, 'rotation should cycle');

const practice = practicePuzzle(42, LAUNCH_DATE);
assert.notEqual(practice.id, first.id, 'practice should avoid today’s sequence when it can');
assert.equal(practicePuzzle(42, LAUNCH_DATE).id, practice.id, 'practice seed must be deterministic');

assert.equal(parseGuess('13'), 13);
assert.equal(parseGuess('1,221'), 1221);
assert.equal(parseGuess('  64 '), 64);
assert.equal(parseGuess(''), null);
assert.equal(parseGuess('3.5'), null);
assert.equal(guessTone(13, 13), 'hit');
assert.equal(guessTone(12, 13), 'close');
assert.equal(guessTone(100, 13), 'miss');
assert.equal(scoreAttempt(1, true), MAX_SCORE);
assert.equal(scoreAttempt(5, true), 20);
assert.equal(scoreAttempt(5, false), 0);
assert.equal(gradeFor(1, true), 'first');
assert.equal(gradeFor(5, false), 'miss');

const lines = shareLines(
  {
    puzzle: first,
    attempts: [
      { guess: 12, tone: 'close' },
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
assert.equal(lines[0], 'Sequence #1');
assert.equal(lines[1], '🟨🟩');

assert.ok(rotationOrder()[0].id !== rotationOrder()[1].id);
assert.equal(dailySpec(today).id, dailyPuzzle(today).id);

console.log(
  `sequence-ok bank=${SPECS.length} launch=${first.id} today=${dailyPuzzle(today).id} cycle=${SPECS.length}d`,
);

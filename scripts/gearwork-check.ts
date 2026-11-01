import assert from 'node:assert/strict';
import {
  HOWTO_PUZZLE,
  JAM_PLACEMENT,
  JAM_PUZZLE,
  LAUNCH_DATE,
  MAX_SCORE,
  addUtcDays,
  dailyPuzzle,
  dateSeed,
  describeTarget,
  emptyPlacement,
  generatePuzzle,
  isSolved,
  isWeekend,
  makeResult,
  meshFaces,
  outputPeg,
  placePiece,
  practicePuzzle,
  puzzleNumberForDate,
  radius,
  shareLines,
  shortTarget,
  simulate,
  solutionPlacement,
  utcDate,
} from '../components/games/gearwork/logic.ts';

assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);

assert.ok(isSolved(HOWTO_PUZZLE, solutionPlacement(HOWTO_PUZZLE)), 'how-to must be solved by its solution');
assert.ok(!isSolved(HOWTO_PUZZLE, emptyPlacement()), 'empty how-to is not solved');

const howToMotion = simulate(HOWTO_PUZZLE, solutionPlacement(HOWTO_PUZZLE));
assert.equal(howToMotion.jammed, false);
assert.ok(Math.abs((howToMotion.omega[1] ?? 0) + 0.5) < 1e-6, '8T into 16T is half speed reverse');

const jam = simulate(JAM_PUZZLE, JAM_PLACEMENT);
assert.equal(jam.jammed, true, 'odd three-gear loop must lock');
assert.ok(!isSolved(JAM_PUZZLE, JAM_PLACEMENT));

const mesh = meshFaces(radius(8) + radius(16), [8], [16]);
assert.ok(mesh);
assert.equal(mesh.teethA, 8);
assert.equal(mesh.teethB, 16);
assert.equal(meshFaces(2.2, [8], [16]), null);

const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.deepEqual(first.pegs, again.pegs);
assert.deepEqual(first.pieces, again.pieces);
assert.deepEqual(first.solution, again.solution);
assert.deepEqual(first.target, again.target);
assert.equal(first.id, `gearwork-${LAUNCH_DATE}`);
assert.ok(isWeekend(LAUNCH_DATE), 'launch day is a Saturday');
assert.ok(isSolved(first, solutionPlacement(first)), 'stored solution must solve the daily');
assert.ok(first.lesson.length >= 2, 'daily needs a lesson');
assert.ok(first.blurb.length > 40, 'daily needs a blurb');
assert.match(describeTarget(first.target), /output must turn/);
assert.match(shortTarget(first.target), /CW|CCW/);

const seen = new Set<string>();
let weekendDays = 0;
let weekdayDays = 0;
let compoundDays = 0;
const started = Date.now();

for (let offset = 0; offset < 120; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  const twice = dailyPuzzle(date);
  assert.equal(puzzle.id, twice.id, `${date} is not deterministic`);
  assert.deepEqual(puzzle.solution, twice.solution);
  assert.notEqual(puzzle.id, 'gearwork-how-to', `${date} fell back to the how-to`);
  assert.equal(puzzle.id, `gearwork-${date}`);

  const motor = puzzle.pegs.find((peg) => peg.role === 'motor');
  const output = outputPeg(puzzle);
  assert.ok(motor, `${date} missing motor`);
  assert.ok(output && output.role === 'output', `${date} missing output`);
  assert.equal(puzzle.motor.peg, motor!.id);

  const pegIds = new Set(puzzle.pegs.map((peg) => peg.id));
  assert.equal(pegIds.size, puzzle.pegs.length, `${date} duplicate pegs`);

  const pieceIds = new Set(puzzle.pieces.map((piece) => piece.id));
  assert.equal(pieceIds.size, puzzle.pieces.length, `${date} duplicate pieces`);
  for (const pieceId of Object.values(puzzle.solution)) {
    assert.ok(pieceIds.has(pieceId), `${date} solution piece ${pieceId} is not in the tray`);
  }

  assert.ok(isSolved(puzzle, solutionPlacement(puzzle)), `${date} stored solution fails`);
  const motion = simulate(puzzle, solutionPlacement(puzzle));
  assert.equal(motion.jammed, false, `${date} official train jams`);
  const speed = motion.omega[output.id];
  assert.ok(speed !== undefined, `${date} output not driven`);
  const want = puzzle.target.direction === 'cw' ? puzzle.target.ratio.num / puzzle.target.ratio.den : -puzzle.target.ratio.num / puzzle.target.ratio.den;
  assert.ok(Math.abs(speed - want) < 1e-5, `${date} target ${want} != ${speed}`);

  const needed = Object.keys(puzzle.solution).length;
  assert.ok(needed >= 2 && needed <= 6, `${date} has ${needed} placed gears`);
  assert.ok(puzzle.pieces.length >= needed, `${date} tray smaller than solution`);
  assert.ok(puzzle.lesson.every((step) => step.title && step.text.length > 20), `${date} has a thin lesson`);

  if (puzzle.pieces.some((piece) => piece.teeth.length > 1)) compoundDays += 1;
  if (isWeekend(date)) weekendDays += 1;
  else weekdayDays += 1;

  const fingerprint = [
    puzzle.motor.teeth,
    puzzle.target.direction,
    `${puzzle.target.ratio.num}/${puzzle.target.ratio.den}`,
    puzzle.pegs.map((peg) => `${peg.role}:${peg.x.toFixed(2)},${peg.y.toFixed(2)}`).join('|'),
    puzzle.pieces.map((piece) => piece.teeth.join('/')).sort().join(','),
  ].join('::');
  seen.add(fingerprint);
}

assert.ok(weekdayDays >= 80, `expected many weekdays, got ${weekdayDays}`);
assert.ok(weekendDays >= 30, `expected many weekends, got ${weekendDays}`);
assert.ok(compoundDays >= 40, `expected compound days, got ${compoundDays}`);
assert.ok(seen.size >= 100, `daily layouts should vary, got ${seen.size} unique in 120 days`);

const practice = practicePuzzle(42);
const practiceAgain = practicePuzzle(42);
assert.equal(practice.id, practiceAgain.id);
assert.deepEqual(practice.solution, practiceAgain.solution);
assert.ok(isSolved(practice, solutionPlacement(practice)));
assert.notEqual(practice.id, first.id);

const handmade = generatePuzzle(dateSeed('2026-11-03'), {
  gears: 3,
  compounds: 1,
  decoys: 1,
  decoyPegs: 1,
  rich: false,
  id: 'gearwork-hand',
});
assert.ok(isSolved(handmade, solutionPlacement(handmade)));
assert.notEqual(handmade.id, 'gearwork-how-to');

let draft = emptyPlacement();
assert.ok(!isSolved(first, draft));
for (const [peg, piece] of Object.entries(first.solution)) {
  draft = placePiece(draft, Number(peg), piece);
}
assert.ok(isSolved(first, draft), 'placing the solution one gear at a time must win');

const result = makeResult(first, 80, Object.keys(first.solution).length, solutionPlacement(first));
assert.ok(result.points <= MAX_SCORE && result.points >= 20);
assert.ok(result.stars >= 1 && result.stars <= 3);
assert.ok(result.lesson.length >= 2);
assert.match(shareLines(result, 'daily', LAUNCH_DATE).join('\n'), /Gearwork #1/);
assert.match(shareLines(result, 'practice', LAUNCH_DATE).join('\n'), /practice/);

const elapsed = Date.now() - started;
assert.ok(elapsed < 15_000, `generation took too long: ${elapsed}ms`);

const today = utcDate();
console.log(
  `gearwork-ok launch=${first.id} gears=${Object.keys(first.solution).length} today=${dailyPuzzle(today).id} days=120 unique=${seen.size} compounds=${compoundDays} ms=${elapsed}`,
);

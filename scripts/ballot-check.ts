import assert from 'node:assert/strict';
import {
  FALLBACK_PUZZLE,
  HOWTO_BALLOTS,
  HOWTO_PUZZLE,
  LAUNCH_DATE,
  MAX_SCORE,
  MAX_TRIES,
  RACES,
  addUtcDays,
  candidateName,
  classifyPattern,
  completeRankings,
  condorcetWinner,
  dailyPuzzle,
  evaluateElection,
  fingerprint,
  firstPlaceCounts,
  generatePuzzle,
  gradeFor,
  isWeekend,
  parseGuess,
  pluralityWinner,
  practicePuzzle,
  puzzleNumberForDate,
  runInstantRunoff,
  scoreAttempt,
  shareLines,
  utcDate,
} from '../components/games/ballot/logic.ts';

assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);

assert.deepEqual(
  HOWTO_PUZZLE.candidates.map((candidate) => candidate.id),
  ['oak', 'ivy', 'ash'],
);
assert.equal(HOWTO_PUZZLE.voters, 9);
assert.equal(HOWTO_PUZZLE.irvWinner, 'ivy', 'Ash transfers to Ivy; Ivy 5, Oak 4');
assert.equal(HOWTO_PUZZLE.pluralityWinner, 'oak');
assert.notEqual(HOWTO_PUZZLE.irvWinner, HOWTO_PUZZLE.pluralityWinner);
assert.ok(HOWTO_PUZZLE.rounds.length >= 2);
assert.equal(HOWTO_PUZZLE.rounds[0]?.eliminated, 'ash');
assert.equal(HOWTO_PUZZLE.rounds[HOWTO_PUZZLE.rounds.length - 1]?.winner, 'ivy');
assert.ok(HOWTO_PUZZLE.lesson.length >= 3);
assert.ok(HOWTO_PUZZLE.blurb.length > 40);

const howToRunoff = runInstantRunoff(
  HOWTO_PUZZLE.candidates.map((candidate) => candidate.id),
  HOWTO_BALLOTS,
);
assert.equal(howToRunoff.clean, true);
assert.equal(howToRunoff.winner, 'ivy');
assert.equal(howToRunoff.rounds[0]?.counts.oak, 4);
assert.equal(howToRunoff.rounds[0]?.counts.ivy, 3);
assert.equal(howToRunoff.rounds[0]?.counts.ash, 2);
assert.equal(howToRunoff.rounds[1]?.counts.ivy, 5);
assert.equal(howToRunoff.rounds[1]?.counts.oak, 4);

const firstCounts = firstPlaceCounts(
  ['oak', 'ivy', 'ash'],
  HOWTO_BALLOTS,
);
assert.deepEqual(firstCounts, { oak: 4, ivy: 3, ash: 2 });
assert.equal(pluralityWinner(['oak', 'ivy', 'ash'], HOWTO_BALLOTS), 'oak');
assert.equal(condorcetWinner(['oak', 'ivy', 'ash'], HOWTO_BALLOTS), 'ash');
assert.equal(HOWTO_PUZZLE.pattern, 'center-squeeze');
assert.equal(classifyPattern('ivy', 'oak', 'ivy'), 'spoiler');

const squeezeBallots = [
  { ranking: ['left', 'center', 'right'], count: 4 },
  { ranking: ['right', 'center', 'left'], count: 3 },
  { ranking: ['center', 'left', 'right'], count: 2 },
];
const squeezeIds = ['left', 'center', 'right'];
const squeezeRunoff = runInstantRunoff(squeezeIds, squeezeBallots);
assert.equal(squeezeRunoff.winner, 'left');
assert.equal(pluralityWinner(squeezeIds, squeezeBallots), 'left');
assert.equal(condorcetWinner(squeezeIds, squeezeBallots), 'center');
assert.equal(classifyPattern('left', 'left', 'center'), 'center-squeeze');

const tiedLast = runInstantRunoff(
  ['a', 'b', 'c'],
  [
    { ranking: ['a', 'b', 'c'], count: 3 },
    { ranking: ['b', 'a', 'c'], count: 3 },
    { ranking: ['c', 'a', 'b'], count: 3 },
  ],
);
assert.equal(tiedLast.clean, false);

assert.ok(FALLBACK_PUZZLE.candidates.length === 4);
assert.ok(evaluateElection(FALLBACK_PUZZLE.candidates, FALLBACK_PUZZLE.ballots));
assert.equal(FALLBACK_PUZZLE.irvWinner, 'maple');
assert.equal(FALLBACK_PUZZLE.pluralityWinner, 'wren');

const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.equal(fingerprint(first), fingerprint(again));
assert.deepEqual(first.ballots, again.ballots);
assert.equal(first.irvWinner, again.irvWinner);
assert.equal(first.id, `ballot-${LAUNCH_DATE}`);
assert.ok(!isWeekend(LAUNCH_DATE), 'launch day is a Tuesday');
assert.equal(first.candidates.length, 3, 'weekdays are three-candidate races');
assert.ok(first.lesson.length >= 3, 'daily needs a lesson');
assert.ok(first.hints.length === 3, 'daily needs three hints');
assert.ok(completeRankings(first.ballots, first.candidates.map((candidate) => candidate.id)));

assert.equal(scoreAttempt(1, true), MAX_SCORE);
assert.equal(scoreAttempt(2, true), 80);
assert.equal(scoreAttempt(3, true), 55);
assert.equal(scoreAttempt(4, true), 30);
assert.equal(scoreAttempt(4, false), 0);
assert.equal(gradeFor(1, true), 'first');
assert.equal(gradeFor(4, false), 'miss');

assert.equal(parseGuess('ivy', HOWTO_PUZZLE.candidates)?.id, 'ivy');
assert.equal(parseGuess('IV', HOWTO_PUZZLE.candidates)?.id, 'ivy');
assert.equal(parseGuess('oak', HOWTO_PUZZLE.candidates)?.id, 'oak');
assert.equal(parseGuess('nope', HOWTO_PUZZLE.candidates), null);

const ids = new Set(RACES.map((race) => race.id));
assert.equal(ids.size, RACES.length, 'race ids must be unique');
assert.ok(RACES.length >= 16, `need a varied race bank, got ${RACES.length}`);
for (const race of RACES) {
  assert.equal(race.candidates.length, 4, `${race.id} should offer four names`);
  const candIds = new Set(race.candidates.map((candidate) => candidate.id));
  assert.equal(candIds.size, 4, `${race.id} has duplicate candidate ids`);
  assert.ok(race.title.length > 12, `${race.id} missing title`);
  assert.ok(race.setting.length > 20, `${race.id} missing setting`);
}

const seen = new Set<string>();
let weekendDays = 0;
let weekdayDays = 0;
let spoilers = 0;
let squeezes = 0;
let agrees = 0;
let fallbackDays = 0;
const started = Date.now();

for (let offset = 0; offset < 180; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  const twice = dailyPuzzle(date);
  assert.equal(puzzle.id, twice.id, `${date} is not deterministic`);
  assert.equal(fingerprint(puzzle), fingerprint(twice));
  assert.equal(puzzle.id, `ballot-${date}`);
  assert.notEqual(puzzle.id, 'ballot-how-to', `${date} fell back to the how-to id`);
  if (puzzle.id === 'ballot-fallback' || fingerprint(puzzle) === fingerprint(FALLBACK_PUZZLE)) {
    fallbackDays += 1;
  }

  const candidateIds = puzzle.candidates.map((candidate) => candidate.id);
  assert.ok(puzzle.voters >= 8 && puzzle.voters <= 12, `${date} has ${puzzle.voters} voters`);
  assert.ok(completeRankings(puzzle.ballots, candidateIds), `${date} has incomplete rankings`);
  assert.ok(puzzle.ballots.length >= 3, `${date} has too few ballot groups`);
  assert.ok(puzzle.ballots.length <= 10, `${date} has too many ballot groups`);

  const runoff = runInstantRunoff(candidateIds, puzzle.ballots);
  assert.equal(runoff.clean, true, `${date} IRV is not clean`);
  assert.equal(runoff.winner, puzzle.irvWinner, `${date} stored IRV winner drifted`);
  assert.ok(runoff.rounds.length >= 2, `${date} ended on the first count`);
  assert.equal(pluralityWinner(candidateIds, puzzle.ballots), puzzle.pluralityWinner, `${date} plurality drifted`);
  assert.equal(condorcetWinner(candidateIds, puzzle.ballots), puzzle.condorcetWinner, `${date} Condorcet drifted`);
  assert.equal(
    classifyPattern(puzzle.irvWinner, puzzle.pluralityWinner, puzzle.condorcetWinner),
    puzzle.pattern,
    `${date} pattern drifted`,
  );

  if (isWeekend(date)) {
    weekendDays += 1;
    assert.equal(puzzle.candidates.length, 4, `${date} weekend should have four candidates`);
  } else {
    weekdayDays += 1;
    assert.equal(puzzle.candidates.length, 3, `${date} weekday should have three candidates`);
  }

  assert.ok(puzzle.lesson.length >= 3, `${date} missing lesson`);
  assert.ok(puzzle.hints.length === 3, `${date} missing hints`);
  assert.ok(puzzle.blurb.length > 30, `${date} missing blurb`);
  assert.ok(puzzle.title.length > 8, `${date} missing title`);
  assert.ok(candidateName(puzzle.candidates, puzzle.irvWinner).length > 1, `${date} unnamed winner`);

  if (puzzle.pattern === 'spoiler') spoilers += 1;
  else if (puzzle.pattern === 'center-squeeze') squeezes += 1;
  else agrees += 1;

  seen.add(fingerprint(puzzle));
}

assert.ok(weekdayDays >= 120, `expected many weekdays, got ${weekdayDays}`);
assert.ok(weekendDays >= 48, `expected many weekends, got ${weekendDays}`);
assert.ok(seen.size >= 80, `daily elections should vary, got ${seen.size} unique in 180 days`);
assert.ok(spoilers >= 20, `expected spoiler days, got ${spoilers}`);
assert.ok(squeezes + spoilers >= 40, `expected many IRV lessons, spoilers=${spoilers} squeezes=${squeezes}`);
assert.ok(fallbackDays <= 8, `too many days reused the fallback election (${fallbackDays})`);

const practice = practicePuzzle(42, LAUNCH_DATE);
const practiceAgain = practicePuzzle(42, LAUNCH_DATE);
assert.equal(practice.id, practiceAgain.id, 'practice seed must be deterministic');
assert.equal(fingerprint(practice), fingerprint(practiceAgain));
assert.notEqual(fingerprint(practice), fingerprint(first), 'practice should avoid today’s race when it can');
const practiceRunoff = runInstantRunoff(
  practice.candidates.map((candidate) => candidate.id),
  practice.ballots,
);
assert.equal(practiceRunoff.winner, practice.irvWinner);

const handmade = generatePuzzle(99, false, 'ballot-hand');
assert.notEqual(handmade.id, 'ballot-how-to');
assert.ok(handmade.rounds.length >= 2);
const handRunoff = runInstantRunoff(
  handmade.candidates.map((candidate) => candidate.id),
  handmade.ballots,
);
assert.equal(handRunoff.winner, handmade.irvWinner);

const scored = {
  puzzle: first,
  attempts: [{ guess: first.irvWinner, hit: true }],
  solved: true,
  tries: 1,
  points: MAX_SCORE,
  grade: gradeFor(1, true),
};
const lines = shareLines(scored, 'daily', LAUNCH_DATE);
assert.equal(lines[0], 'Ballot #1');
assert.ok(lines[1].includes(candidateName(first.candidates, first.irvWinner)));
assert.ok(lines[3].includes(`${MAX_SCORE}`));
assert.equal(MAX_TRIES, 4);

const elapsed = Date.now() - started;
const today = utcDate();
console.log(
  `ballot-ok launch=${first.id} winner=${first.irvWinner} plurality=${first.pluralityWinner} pattern=${first.pattern} today=${dailyPuzzle(today).id} days=180 unique=${seen.size} spoilers=${spoilers} squeezes=${squeezes} agrees=${agrees} weekends=${weekendDays} fallbacks=${fallbackDays} ms=${elapsed}`,
);

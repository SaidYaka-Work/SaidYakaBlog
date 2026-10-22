import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAnswer } from '../../../components/games/fakegpt/match.ts';
import { applyPuzzleFlavor } from '../src/ai.ts';
import { isSpacingAlias } from '../src/schema.ts';
import {
  assembleQuestion,
  buildDayPuzzles,
  leadInLeaks,
  pickPuzzleLead,
  scrambleWord,
  spacingAliases,
  textLeaksKey,
  weekdayUtc,
} from '../src/puzzles.ts';
import { computeMathAnswer, optionsArePermutations } from '../src/validators.ts';

const UNIT_FACTORS: Record<string, Record<string, number>> = {
  meters: { millimeters: 1000, centimeters: 100 },
  millimeters: { meters: 0.001 },
  centimeters: { meters: 0.01 },
  kilometers: { meters: 1000 },
  grams: { kilograms: 0.001 },
  kilograms: { grams: 1000 },
  hours: { minutes: 60, days: 1 / 24 },
  minutes: { seconds: 60, hours: 1 / 60 },
  days: { hours: 24 },
};

function expectedUnit(prompt: string): number | null {
  const hit = prompt.match(/^Convert (-?\d+(?:\.\d+)?) ([a-z]+) to ([a-z]+)$/i);
  if (!hit) return null;
  const factor = UNIT_FACTORS[hit[2]]?.[hit[3]];
  return factor == null ? null : Number(hit[1]) * factor;
}

const DATES = [
  '2026-01-01',
  '2026-03-15',
  '2026-06-30',
  '2026-10-21',
  '2026-12-31',
  '2025-02-28',
  '2024-02-29',
  '2023-07-04',
  '2022-11-11',
  '2021-05-05',
  '2020-01-15',
  '2019-09-09',
  '2018-04-12',
  '2017-08-20',
  '2016-10-01',
  '2015-03-03',
  '2014-06-06',
  '2013-12-12',
  '2012-02-29',
  '2011-01-31',
];

function letters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
}

test('code-generated keys are correct across many day seeds', () => {
  for (const date of DATES) {
    const puzzles = buildDayPuzzles(date);
    assert.equal(puzzles.length, 12, date);
    const kinds = new Set(puzzles.map((row) => row.kind));
    assert.ok(kinds.size >= 5, `${date} kinds ${[...kinds].join(',')}`);
    for (const puzzle of puzzles) {
      if (puzzle.kind === 'math') {
        assert.equal(computeMathAnswer(puzzle.prompt), Number(puzzle.answer), puzzle.prompt);
      } else if (puzzle.kind === 'unit') {
        const computed = expectedUnit(puzzle.prompt);
        assert.ok(computed != null, puzzle.prompt);
        assert.ok(Math.abs((computed ?? 0) - Number(puzzle.answer)) <= 0.051, `${puzzle.prompt} ${computed} ${puzzle.answer}`);
      } else if (puzzle.kind === 'weekday') {
        const relative = puzzle.prompt.match(/if yesterday was (\w+), today is/i);
        if (relative) {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const yesterday = days.indexOf(relative[1]);
          assert.equal(puzzle.answer, days[(yesterday + 1) % 7], puzzle.prompt);
        } else {
          const stamp = puzzle.prompt.match(/was (.+)$/i);
          assert.ok(stamp, puzzle.prompt);
          const parsed = new Date(`${stamp[1]} UTC`);
          assert.equal(weekdayUtc(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate()), puzzle.answer);
        }
      } else if (puzzle.kind === 'unscramble') {
        const scrambled = puzzle.prompt.replace(/^unscramble:\s*/i, '').trim();
        assert.notEqual(scrambled, puzzle.answer);
        assert.equal(letters(scrambled), letters(puzzle.answer));
      } else if (puzzle.kind === 'spell') {
        assert.ok(/^[A-Za-z]+$/.test(puzzle.answer));
        assert.match(puzzle.prompt, /fix:/i);
      } else if (puzzle.kind === 'order') {
        assert.equal(optionsArePermutations(puzzle.options), true, puzzle.prompt);
        assert.ok(puzzle.options.includes(puzzle.answer));
        assert.ok(puzzle.aliases.every((alias) => normalizeAnswer(alias) !== normalizeAnswer(puzzle.answer)));
      }
    }
  }
});

test('ordering aliases are only case and spacing variants', () => {
  assert.deepEqual(spacingAliases('red, orange, yellow'), ['red orange yellow']);
  assert.equal(isSpacingAlias('red orange yellow', 'red, orange, yellow'), true);
  assert.equal(isSpacingAlias('yellow, orange, red', 'red, orange, yellow'), false);
  assert.equal(isSpacingAlias('Red, Orange, Yellow', 'red, orange, yellow'), true);
});

test('scrambleWord never returns the original word', () => {
  const rng = () => 0.2;
  assert.notEqual(scrambleWord('apple', rng), 'apple');
});

const LEAK_SEEDS = [
  ...DATES,
  '2026-02-02',
  '2026-04-04',
  '2026-05-05',
  '2026-07-07',
  '2026-08-08',
  '2026-09-09',
  '2026-11-11',
  '2027-01-01',
  '2027-03-03',
  '2027-06-06',
  '2028-02-29',
  '2029-10-10',
  '2030-12-25',
  '2010-01-01',
  '2001-09-11',
  '1998-06-15',
];

test('assembled question text never leaks its key across many seeds', () => {
  let count = 0;
  for (const date of LEAK_SEEDS) {
    for (const puzzle of buildDayPuzzles(date)) {
      count += 1;
      const assembled = assembleQuestion(puzzle.lead, puzzle.question);
      assert.ok(puzzle.question.trim().length >= 8, `${date} ${puzzle.id} missing question`);
      assert.equal(textLeaksKey(puzzle.kind, assembled, puzzle.answer, puzzle.aliases), false, `${date} ${puzzle.id} ${assembled} => ${puzzle.answer}`);
      assert.equal(textLeaksKey(puzzle.kind, puzzle.question, puzzle.answer, puzzle.aliases), false, `${date} ${puzzle.id} question ${puzzle.question}`);
      const round = applyPuzzleFlavor(puzzle, { lead: 'ugh hurry up' }, [{ id: 'dana', name: 'Dana', vibe: 'late' }]);
      assert.match(round.round.text, new RegExp(puzzle.question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(textLeaksKey(puzzle.kind, round.round.text, puzzle.answer, puzzle.aliases), false, round.round.text);
    }
  }
  assert.ok(count >= 12 * LEAK_SEEDS.length);
});

test('leaky AI lead-ins fall back to a code-written lead-in', () => {
  const math = buildDayPuzzles('2026-10-21').find((row) => row.kind === 'math');
  const unit = buildDayPuzzles('2026-10-21').find((row) => row.kind === 'unit');
  const spell = buildDayPuzzles('2026-10-21').find((row) => row.kind === 'spell');
  const unscramble = buildDayPuzzles('2026-10-21').find((row) => row.kind === 'unscramble');
  const order = buildDayPuzzles('2026-10-21').find((row) => row.kind === 'order');
  const weekday = buildDayPuzzles('2026-10-21').find((row) => row.kind === 'weekday');
  assert.ok(math && unit && spell && unscramble && order && weekday);

  assert.equal(leadInLeaks(math, `${math.question} is... ${math.answer}!`), true);
  assert.equal(leadInLeaks(unit, `${unit.question}? It's ${unit.answer}`), true);
  assert.equal(leadInLeaks(spell, `${spell.answer}. not ${spell.question.replace(/^fix:\s*/i, '')}.`), true);
  assert.equal(leadInLeaks(unscramble, `unscramble '${unscramble.question.replace(/^unscramble:\s*/i, '')}'? It's '${unscramble.answer}'`), true);
  assert.equal(leadInLeaks(order, `${order.answer}. That's the order.`), true);
  assert.equal(leadInLeaks(order, `the rainbow order is: ${order.question.split(':')[1] || order.answer}`), true);

  const personas = [{ id: 'dana', name: 'Dana', vibe: 'late' }];
  const leaked = applyPuzzleFlavor(math, { text: `${math.question} is... ${math.answer}!` }, personas);
  assert.equal(leaked.flavored, false);
  assert.equal(leaked.round.text, assembleQuestion(math.lead, math.question));
  assert.ok(leaked.round.text.includes(math.question));
  assert.equal(textLeaksKey(math.kind, leaked.round.text, math.answer), false);

  const weekdayLeak = applyPuzzleFlavor(weekday, { lead: 'Sunday, of course. Now what?' }, personas);
  assert.ok(weekdayLeak.round.text.includes(weekday.question));
  assert.match(weekdayLeak.round.text, /if yesterday|what day of the week/i);

  const safe = pickPuzzleLead(math, 'ugh math again');
  assert.equal(safe.flavored, true);
  assert.equal(safe.lead, 'ugh math again');
});

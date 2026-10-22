import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeMathAnswer,
  computeOrderAnswer,
  computeUnitAnswer,
  filterAiRounds,
  hasMoreSpecificDistractor,
  isAmbiguousUnitPrompt,
  isNonsensicalPrompt,
  isTimeSensitivePrompt,
  mentionsOtherPersona,
  namesTargetLanguage,
  optionsArePermutations,
  sanitizeReplies,
  validateAiRound,
} from '../src/validators.ts';
import type { DailyRound } from '../src/schema.ts';

function round(over: Partial<DailyRound> & Pick<DailyRound, 'kind' | 'text' | 'answer'>): DailyRound {
  return {
    id: 'r1',
    persona: 'Dana',
    vibe: 'late',
    category: 'general',
    difficulty: 1,
    aliases: [],
    options: [],
    nudges: ['hello??'],
    good: 'ok',
    bad: `that's a hallucination, buddy. it's ${over.answer}.`,
    ...over,
  };
}

test('translation prompts strip non-format aliases instead of dropping the round', () => {
  assert.equal(namesTargetLanguage('translate I love my dog to French'), true);
  assert.equal(namesTargetLanguage('I love my dog, go'), false);
  const unnamed = validateAiRound(
    round({
      kind: 'translate',
      text: 'I love my dog, go',
      answer: "je t'aime mon chien",
      aliases: ['mon chien, il est adorable'],
    }),
  );
  assert.equal(unnamed.ok, true);
  if (unnamed.ok) assert.deepEqual(unnamed.round.aliases, []);
  const stripped = validateAiRound(
    round({
      kind: 'translate',
      text: 'translate the cat is black to French',
      answer: 'le chat est noir',
      aliases: ['le chat est sombre', 'le chat est noir'],
    }),
  );
  assert.equal(stripped.ok, true);
  if (stripped.ok) {
    assert.equal(stripped.round.aliases.includes('le chat est sombre'), false);
    assert.ok(stripped.round.aliases.includes('le chat est noir'));
  }
  assert.equal(
    validateAiRound(
      round({
        kind: 'translate',
        text: 'what does hola mean in English please',
        answer: 'hello',
        aliases: ['hello'],
      }),
    ).ok,
    true,
  );
});

test('order rounds need a rule, permutations, and a computed key when possible', () => {
  const options = ['zero, one, two, three', 'one, two, three, zero', 'one, three, two, zero', 'three, two, one, zero'];
  assert.equal(optionsArePermutations(options), true);
  assert.equal(optionsArePermutations(['red, green, blue', 'blue, red', 'green, blue, red', 'blue, green, red']), false);
  const computed = computeOrderAnswer('alphabetical order of numbers', options);
  assert.equal(normalize(computed), normalize('one, three, two, zero'));
  const fixed = validateAiRound(
    round({
      kind: 'order',
      text: 'alphabetical order of numbers please now',
      answer: 'zero, one, two, three',
      options,
    }),
  );
  assert.equal(fixed.ok, true);
  if (fixed.ok) assert.equal(normalize(fixed.round.answer), normalize('one, three, two, zero'));
  const noRule = validateAiRound(
    round({
      kind: 'order',
      text: 'list of colors for me now',
      answer: 'red, green, blue',
      options: ['red, green, blue', 'blue, red, green', 'green, blue, red', 'blue, green, red'],
    }),
  );
  assert.equal(noRule.ok, true);
  if (noRule.ok) assert.equal(normalize(noRule.round.answer), normalize('red, green, blue'));
  assert.equal(
    validateAiRound(
      round({
        kind: 'order',
        text: 'alphabetical order of these words please',
        answer: 'apple banana',
        options: ['apple banana', 'banana apple', 'pear apple', 'apple pear banana'],
      }),
    ).ok,
    false,
  );
});

test('math and unit keys are recomputed and ambiguous ounces are dropped', () => {
  assert.equal(computeMathAnswer('17 + 8, I dropped my calculator'), 25);
  assert.equal(computeMathAnswer('8 × 7 − 3'), 53);
  assert.equal(computeMathAnswer('20% of 80, tax brain please'), 16);
  assert.equal(computeMathAnswer('2 to the power of 10'), 1024);
  assert.equal(computeUnitAnswer('100 centimeters is how many meters'), 1);
  assert.equal(computeUnitAnswer('32 Fahrenheit is what Celsius'), 0);
  assert.equal(isAmbiguousUnitPrompt('2 cups flour in ounces please'), true);
  assert.equal(isAmbiguousUnitPrompt('100 centimeters is how many meters'), false);
  const math = validateAiRound(round({ kind: 'math', text: '17 + 8, I dropped my calculator', answer: '99' }));
  assert.equal(math.ok, true);
  if (math.ok) assert.equal(math.round.answer, '25');
  assert.equal(
    validateAiRound(round({ kind: 'unit', text: '2 cups flour in ounces please', answer: '16' })).ok,
    false,
  );
  const unparsed = validateAiRound(
    round({ kind: 'math', text: 'what is the 12th fibonacci number please', answer: '144' }),
  );
  assert.equal(unparsed.ok, true);
  if (unparsed.ok) assert.equal(unparsed.round.answer, '144');
});

test('instruction echoes are dropped with a reason', () => {
  const checked = validateAiRound(
    round({
      kind: 'translate',
      text: 'name the target language: french',
      answer: 'bonjour',
    }),
  );
  assert.equal(checked.ok, false);
  if (!checked.ok) assert.equal(checked.reason, 'instruction-echo');
});

test('time-sensitive, nonsense, and more-specific distractors are dropped', () => {
  assert.equal(isTimeSensitivePrompt('which planet has the most moons today'), true);
  assert.equal(isNonsensicalPrompt('mammal with a built-in umbrella called a dorsal fin'), true);
  assert.equal(hasMoreSpecificDistractor('Spiral', ['Spiral', 'Barred Spiral', 'Elliptical', 'Irregular']), true);
  assert.equal(
    validateAiRound(
      round({
        kind: 'mc',
        text: 'which planet has the most moons today',
        answer: 'Jupiter',
        options: ['Jupiter', 'Saturn', 'Earth', 'Mars'],
      }),
    ).ok,
    false,
  );
  assert.equal(
    validateAiRound(
      round({
        kind: 'typed',
        text: 'mammal with a built-in umbrella called a dorsal fin',
        answer: 'Dolphin',
      }),
    ).ok,
    false,
  );
  assert.equal(
    validateAiRound(
      round({
        kind: 'mc',
        text: 'what shape is the milky way galaxy now',
        answer: 'Spiral',
        options: ['Spiral', 'Barred Spiral', 'Elliptical', 'Irregular'],
      }),
    ).ok,
    false,
  );
});

test('reply text cannot name another day persona', () => {
  const personas = [
    { id: 'dana', name: 'Dana', vibe: 'calm' },
    { id: 'lily', name: 'Lily', vibe: 'late' },
  ];
  assert.equal(mentionsOtherPersona("that's on Dana, buddy. it's noir.", 'Lily', personas), true);
  assert.equal(mentionsOtherPersona("that's a hallucination, buddy. it's noir.", 'Lily', personas), false);
  const cleaned = sanitizeReplies(
    round({
      kind: 'translate',
      text: 'translate black to French for me',
      answer: 'noir',
      persona: 'Lily',
      bad: "Dana said marron. that's wrong.",
    }),
    personas,
  );
  assert.equal(cleaned.bad.includes('Dana'), false);
  assert.match(cleaned.bad, /noir/i);
});

test('filterAiRounds keeps fixable jobs and logs a drop reason', () => {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    const kept = filterAiRounds([
      round({ kind: 'math', text: '9 times 6, pub quiz sudden death', answer: '54' }),
      round({ id: 'flour', kind: 'unit', text: '2 cups flour in ounces please', answer: '16' }),
      round({ kind: 'translate', text: 'the cat is black', answer: 'le chat est noir' }),
    ]);
    assert.equal(kept.length, 2);
    assert.ok(kept.some((row) => row.kind === 'math'));
    assert.ok(kept.some((row) => row.kind === 'translate'));
  } finally {
    console.log = orig;
  }
  assert.ok(lines.some((line) => /fakegpt daily drop id=flour reason=unit-ambiguous/.test(line)));
});

function normalize(value: string | null): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

import { matchChoice, matchTypedAnswer, normalizeAnswer, type MatchVerdict } from './match';
import type { PromptKind } from './types';
import { BONUS, TRIVIA, type TriviaItem } from './trivia';

export type JobItem = {
  id: string;
  kind: PromptKind;
  text: string;
  category: string;
  difficulty: 1 | 2 | 3;
  answer: string;
  aliases?: string[];
  options?: string[];
};

export const CHOICE_KINDS = new Set<PromptKind>(['mc', 'tone', 'order']);
export const BONUS_KINDS = new Set<PromptKind>(['draw', 'sound']);
export const TYPED_JOB_KINDS = new Set<PromptKind>([
  'typed',
  'translate',
  'math',
  'unit',
  'weekday',
  'spell',
  'unscramble',
  'fill',
]);

export function isChoiceKind(kind: PromptKind, options: readonly string[] = []): boolean {
  if (CHOICE_KINDS.has(kind)) return true;
  return kind === 'fill' && options.length === 4;
}

export function isBonusKind(kind: PromptKind): boolean {
  return BONUS_KINDS.has(kind);
}

export function isTypedKind(kind: PromptKind, options: readonly string[] = []): boolean {
  return !isChoiceKind(kind, options) && !isBonusKind(kind);
}

export function parseFlexibleNumber(value: string): number | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/,/g, '')
    .trim();
  if (!cleaned) return null;
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

export function matchNumeric(player: string, answer: string, tolerance = 0.051): MatchVerdict {
  if (!normalizeAnswer(player)) return 'empty';
  const got = parseFlexibleNumber(player);
  const want = parseFlexibleNumber(answer);
  if (got == null || want == null) return matchTypedAnswer(player, answer);
  return Math.abs(got - want) <= tolerance ? 'correct' : 'wrong';
}

export function matchOrder(player: string, answer: string, aliases: readonly string[] = []): MatchVerdict {
  const tokens = (value: string) =>
    normalizeAnswer(value)
      .replace(/[>/|]+/g, ' ')
      .split(' ')
      .filter(Boolean);
  const got = tokens(player);
  if (!got.length) return 'empty';
  const targets = [answer, ...aliases].map(tokens).filter((row) => row.length);
  for (const want of targets) {
    if (got.length === want.length && got.every((token, index) => token === want[index])) return 'correct';
  }
  return matchTypedAnswer(player, answer, aliases);
}

/** Local checker for every job kind. AI grade is only for leftover ambiguous typed trivia. */
export function checkJob(
  kind: PromptKind,
  player: string,
  answer: string,
  aliases: readonly string[] = [],
  options: readonly string[] = [],
): MatchVerdict {
  if (isChoiceKind(kind, options)) {
    if (!normalizeAnswer(player)) return 'empty';
    return matchChoice(player, answer) ? 'correct' : 'wrong';
  }
  if (kind === 'math' || kind === 'unit') return matchNumeric(player, answer);
  if (kind === 'order') return matchOrder(player, answer, aliases);
  return matchTypedAnswer(player, answer, aliases);
}

/** Desk-job prompts that are locally verifiable. Trivia stays in `trivia.ts`. */
export const JOBS: JobItem[] = [
  { id: 'tr-hola', kind: 'translate', category: 'translate', difficulty: 1, text: 'quick, what does "hola" mean', answer: 'hello', aliases: ['hi', 'hey'] },
  { id: 'tr-merci', kind: 'translate', category: 'translate', difficulty: 1, text: 'merci means what in English, go', answer: 'thank you', aliases: ['thanks', 'thank you very much'] },
  { id: 'tr-adios', kind: 'translate', category: 'translate', difficulty: 1, text: 'adios. English. now.', answer: 'goodbye', aliases: ['bye', 'good bye'] },
  { id: 'tr-bonjour', kind: 'translate', category: 'translate', difficulty: 1, text: 'bonjour is English…', answer: 'hello', aliases: ['good morning', 'hi', 'good day'] },
  { id: 'tr-gracias', kind: 'translate', category: 'translate', difficulty: 1, text: 'gracias. I am late. translate.', answer: 'thank you', aliases: ['thanks'] },
  { id: 'tr-danke', kind: 'translate', category: 'translate', difficulty: 1, text: 'German "danke" in English', answer: 'thank you', aliases: ['thanks'] },
  { id: 'tr-oui', kind: 'translate', category: 'translate', difficulty: 1, text: 'oui means', answer: 'yes' },
  { id: 'tr-si', kind: 'translate', category: 'translate', difficulty: 1, text: 'Spanish sí, English please', answer: 'yes' },
  { id: 'tr-eau', kind: 'translate', category: 'translate', difficulty: 2, text: 'French for water is… wait no, what is "eau"', answer: 'water' },
  { id: 'tr-perro', kind: 'translate', category: 'translate', difficulty: 2, text: 'perro in English, I am at a vet', answer: 'dog' },
  { id: 'tr-gato', kind: 'translate', category: 'translate', difficulty: 1, text: 'gato. English. fast.', answer: 'cat' },
  { id: 'tr-au-revoir', kind: 'translate', category: 'translate', difficulty: 2, text: 'au revoir means', answer: 'goodbye', aliases: ['bye', 'see you', 'farewell'] },
  { id: 'tr-bitte', kind: 'translate', category: 'translate', difficulty: 2, text: 'German bitte, polite English', answer: 'please', aliases: ['you are welcome', "you're welcome", 'pardon'] },
  { id: 'tr-amigo', kind: 'translate', category: 'translate', difficulty: 1, text: 'amigo means', answer: 'friend' },
  { id: 'tr-maison', kind: 'translate', category: 'translate', difficulty: 2, text: 'maison in English', answer: 'house', aliases: ['home'] },
  { id: 'tr-libro', kind: 'translate', category: 'translate', difficulty: 2, text: 'libro, English, I have a library card', answer: 'book' },

  { id: 'math-17-8', kind: 'math', category: 'math', difficulty: 1, text: '17 + 8, I dropped my calculator', answer: '25' },
  { id: 'math-9-6', kind: 'math', category: 'math', difficulty: 1, text: '9 times 6, pub quiz sudden death', answer: '54' },
  { id: 'math-100-37', kind: 'math', category: 'math', difficulty: 1, text: '100 minus 37. do not hallucinate.', answer: '63' },
  { id: 'math-12-12', kind: 'math', category: 'math', difficulty: 1, text: '12 + 12, I know, just type it', answer: '24' },
  { id: 'math-7-8', kind: 'math', category: 'math', difficulty: 1, text: '7 × 8, the classic', answer: '56' },
  { id: 'math-81-9', kind: 'math', category: 'math', difficulty: 1, text: '81 divided by 9', answer: '9' },
  { id: 'math-15-4', kind: 'math', category: 'math', difficulty: 1, text: '15 − 4, before my coffee', answer: '11' },
  { id: 'math-11-11', kind: 'math', category: 'math', difficulty: 1, text: '11 × 11. I can wait 0.2 seconds.', answer: '121' },
  { id: 'math-50-25', kind: 'math', category: 'math', difficulty: 1, text: 'half of 50', answer: '25' },
  { id: 'math-3-squared', kind: 'math', category: 'math', difficulty: 1, text: '3 squared, not cubed, squared', answer: '9' },
  { id: 'math-5-cubed', kind: 'math', category: 'math', difficulty: 2, text: '5 cubed. yes I said cubed.', answer: '125' },
  { id: 'math-144-12', kind: 'math', category: 'math', difficulty: 2, text: 'square root of 144', answer: '12' },
  { id: 'math-19-6', kind: 'math', category: 'math', difficulty: 2, text: '19 + 6, then I need the rest of my life', answer: '25' },
  { id: 'math-8-7-3', kind: 'math', category: 'math', difficulty: 2, text: '8 × 7 − 3', answer: '53' },
  { id: 'math-2-10', kind: 'math', category: 'math', difficulty: 1, text: '2 to the power of 10', answer: '1024', aliases: ['1,024'] },
  { id: 'math-percent', kind: 'math', category: 'math', difficulty: 2, text: '20% of 80, tax brain please', answer: '16' },

  { id: 'unit-cm-m', kind: 'unit', category: 'units', difficulty: 1, text: '100 centimeters is how many meters', answer: '1', aliases: ['1 m', '1 meter'] },
  { id: 'unit-g-kg', kind: 'unit', category: 'units', difficulty: 1, text: '1000 grams in kilograms', answer: '1', aliases: ['1 kg'] },
  { id: 'unit-min-hr', kind: 'unit', category: 'units', difficulty: 1, text: 'how many minutes in an hour', answer: '60' },
  { id: 'unit-sec-min', kind: 'unit', category: 'units', difficulty: 1, text: 'seconds in a minute, come on', answer: '60' },
  { id: 'unit-hr-day', kind: 'unit', category: 'units', difficulty: 1, text: 'hours in a day', answer: '24' },
  { id: 'unit-in-ft', kind: 'unit', category: 'units', difficulty: 1, text: 'inches in a foot', answer: '12' },
  { id: 'unit-ft-yd', kind: 'unit', category: 'units', difficulty: 1, text: 'feet in a yard', answer: '3' },
  { id: 'unit-f-c', kind: 'unit', category: 'units', difficulty: 2, text: '32 Fahrenheit is what Celsius', answer: '0', aliases: ['0 C', 'zero'] },
  { id: 'unit-boil-f', kind: 'unit', category: 'units', difficulty: 2, text: 'water boils at sea level, Fahrenheit', answer: '212' },
  { id: 'unit-km-m', kind: 'unit', category: 'units', difficulty: 1, text: '1 kilometer is how many meters', answer: '1000', aliases: ['1,000'] },
  { id: 'unit-week-days', kind: 'unit', category: 'units', difficulty: 1, text: 'days in a week. I am not kidding.', answer: '7' },
  { id: 'unit-year-days', kind: 'unit', category: 'units', difficulty: 1, text: 'days in a common (not leap) year', answer: '365' },

  { id: 'wd-2024-new', kind: 'weekday', category: 'calendar', difficulty: 2, text: 'what day of the week was 1 January 2024', answer: 'Monday' },
  { id: 'wd-2000-new', kind: 'weekday', category: 'calendar', difficulty: 2, text: '1 January 2000, which weekday', answer: 'Saturday' },
  { id: 'wd-2026-1021', kind: 'weekday', category: 'calendar', difficulty: 2, text: '21 October 2026 is a…', answer: 'Wednesday' },
  { id: 'wd-1776', kind: 'weekday', category: 'calendar', difficulty: 3, text: 'weekday of 4 July 1776, if you please', answer: 'Thursday' },
  { id: 'wd-xmas-25', kind: 'weekday', category: 'calendar', difficulty: 2, text: '25 December 2025 falls on', answer: 'Thursday' },
  { id: 'wd-2023-new', kind: 'weekday', category: 'calendar', difficulty: 2, text: '1 January 2023 weekday', answer: 'Sunday' },
  { id: 'wd-leap-day', kind: 'weekday', category: 'calendar', difficulty: 3, text: '29 February 2024 was a', answer: 'Thursday' },
  { id: 'wd-today-known', kind: 'weekday', category: 'calendar', difficulty: 1, text: 'if yesterday was Monday, today is', answer: 'Tuesday' },

  { id: 'sp-receive', kind: 'spell', category: 'spelling', difficulty: 1, text: 'fix: recieve', answer: 'receive' },
  { id: 'sp-separate', kind: 'spell', category: 'spelling', difficulty: 1, text: 'seperate is wrong. the real word.', answer: 'separate' },
  { id: 'sp-definitely', kind: 'spell', category: 'spelling', difficulty: 1, text: 'definately. no. spell it.', answer: 'definitely' },
  { id: 'sp-occurred', kind: 'spell', category: 'spelling', difficulty: 2, text: 'occured needs more letters', answer: 'occurred' },
  { id: 'sp-tomorrow', kind: 'spell', category: 'spelling', difficulty: 1, text: 'tommorrow, one m too many', answer: 'tomorrow' },
  { id: 'sp-accommodate', kind: 'spell', category: 'spelling', difficulty: 2, text: 'accomodate, I can never, you can', answer: 'accommodate' },
  { id: 'sp-weird', kind: 'spell', category: 'spelling', difficulty: 1, text: 'wierd. i before e except… just spell it', answer: 'weird' },
  { id: 'sp-government', kind: 'spell', category: 'spelling', difficulty: 2, text: 'goverment is missing a letter', answer: 'government' },
  { id: 'sp-environment', kind: 'spell', category: 'spelling', difficulty: 2, text: 'enviroment. the planet version.', answer: 'environment' },
  { id: 'sp-february', kind: 'spell', category: 'spelling', difficulty: 2, text: 'Febuary. the month with the quiet r', answer: 'February' },
  { id: 'sp-necessary', kind: 'spell', category: 'spelling', difficulty: 2, text: 'neccessary. one c? two s? you tell me', answer: 'necessary' },
  { id: 'sp-their', kind: 'spell', category: 'spelling', difficulty: 1, text: 'possessive they: thier or…', answer: 'their' },

  { id: 'un-apple', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: pplea', answer: 'apple' },
  { id: 'un-orange', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: oraneg', answer: 'orange' },
  { id: 'un-house', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: esuoh', answer: 'house' },
  { id: 'un-water', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: wtare', answer: 'water' },
  { id: 'un-chair', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: rahic', answer: 'chair' },
  { id: 'un-table', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: bleat', answer: 'table' },
  { id: 'un-earth', kind: 'unscramble', category: 'words', difficulty: 2, text: 'unscramble: htrae (planet)', answer: 'earth' },
  { id: 'un-train', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: nirat', answer: 'train' },
  { id: 'un-bread', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: derab', answer: 'bread' },
  { id: 'un-night', kind: 'unscramble', category: 'words', difficulty: 1, text: 'unscramble: thgin', answer: 'night' },
  { id: 'un-model', kind: 'unscramble', category: 'words', difficulty: 2, text: 'unscramble: ledom (the thing you are faking)', answer: 'model' },
  { id: 'un-token', kind: 'unscramble', category: 'words', difficulty: 2, text: 'unscramble: nekto', answer: 'token' },

  {
    id: 'or-1234',
    kind: 'order',
    category: 'order',
    difficulty: 1,
    text: 'smallest to largest: 3, 1, 4, 2',
    answer: '1, 2, 3, 4',
    aliases: ['1 2 3 4'],
    options: ['1, 2, 3, 4', '3, 1, 4, 2', '4, 3, 2, 1', '2, 1, 4, 3'],
  },
  {
    id: 'or-planets',
    kind: 'order',
    category: 'order',
    difficulty: 2,
    text: 'from the Sun outward, first three planets',
    answer: 'Mercury, Venus, Earth',
    aliases: ['mercury venus earth'],
    options: ['Mercury, Venus, Earth', 'Venus, Earth, Mars', 'Earth, Venus, Mercury', 'Mercury, Earth, Venus'],
  },
  {
    id: 'or-alpha',
    kind: 'order',
    category: 'order',
    difficulty: 1,
    text: 'alphabetize: eel, cat, dog',
    answer: 'cat, dog, eel',
    options: ['cat, dog, eel', 'dog, cat, eel', 'eel, dog, cat', 'cat, eel, dog'],
  },
  {
    id: 'or-sizes',
    kind: 'order',
    category: 'order',
    difficulty: 2,
    text: 'smallest scoop first: cup, teaspoon, tablespoon',
    answer: 'teaspoon, tablespoon, cup',
    options: ['teaspoon, tablespoon, cup', 'cup, tablespoon, teaspoon', 'tablespoon, teaspoon, cup', 'teaspoon, cup, tablespoon'],
  },
  {
    id: 'or-week',
    kind: 'order',
    category: 'order',
    difficulty: 1,
    text: 'Mon then the next two weekdays',
    answer: 'Monday, Tuesday, Wednesday',
    options: ['Monday, Tuesday, Wednesday', 'Sunday, Monday, Tuesday', 'Monday, Wednesday, Friday', 'Friday, Saturday, Sunday'],
  },
  {
    id: 'or-meals',
    kind: 'order',
    category: 'order',
    difficulty: 1,
    text: 'in a day: dinner, breakfast, lunch — chronological',
    answer: 'breakfast, lunch, dinner',
    options: ['breakfast, lunch, dinner', 'lunch, dinner, breakfast', 'dinner, lunch, breakfast', 'breakfast, dinner, lunch'],
  },
  {
    id: 'or-numbers',
    kind: 'order',
    category: 'order',
    difficulty: 1,
    text: 'count up: eight, six, seven',
    answer: 'six, seven, eight',
    options: ['six, seven, eight', 'eight, seven, six', 'seven, six, eight', 'six, eight, seven'],
  },
  {
    id: 'or-rgb',
    kind: 'order',
    category: 'order',
    difficulty: 2,
    text: 'rainbow start: indigo, red, orange — first three classic colors',
    answer: 'red, orange, yellow',
    options: ['red, orange, yellow', 'red, yellow, orange', 'orange, red, yellow', 'yellow, orange, red'],
  },

  {
    id: 'tone-late',
    kind: 'tone',
    category: 'tone',
    difficulty: 1,
    text: 'rewrite polite: "the report is late"',
    answer: "Sorry, the report is running late.",
    options: [
      "Sorry, the report is running late.",
      'REPORT LATE. FIX.',
      'lol report goes brrr',
      'I ate the report.',
    ],
  },
  {
    id: 'tone-no',
    kind: 'tone',
    category: 'tone',
    difficulty: 1,
    text: 'make this a soft no: "no I will not do that"',
    answer: "I can't take that on right now.",
    options: [
      "I can't take that on right now.",
      'NOPE.',
      'you are wrong and also loud',
      'sure, midnight, easy',
    ],
  },
  {
    id: 'tone-thanks',
    kind: 'tone',
    category: 'tone',
    difficulty: 1,
    text: 'warmer: "thanks for the file"',
    answer: 'Thanks so much for sending the file!',
    options: [
      'Thanks so much for sending the file!',
      'file received. end.',
      'why did you wait',
      'attachment looks cursed',
    ],
  },
  {
    id: 'tone-formal',
    kind: 'tone',
    category: 'tone',
    difficulty: 2,
    text: 'more formal: "hey can you send that"',
    answer: 'Could you please send that over?',
    options: [
      'Could you please send that over?',
      'SEND IT.',
      'hey. file. now.',
      'idk you do it',
    ],
  },
  {
    id: 'tone-short',
    kind: 'tone',
    category: 'tone',
    difficulty: 2,
    text: 'shorter: "I just wanted to quickly let you know that I arrived"',
    answer: 'I arrived.',
    options: ['I arrived.', 'I have undertaken an arrival.', 'why am I writing a novel', 'the train is a metaphor'],
  },
  {
    id: 'tone-calm',
    kind: 'tone',
    category: 'tone',
    difficulty: 2,
    text: 'calm down: "THIS IS A DISASTER AND EVERYTHING IS ON FIRE"',
    answer: 'This is serious. We should handle it step by step.',
    options: [
      'This is serious. We should handle it step by step.',
      'YES BURN IT ALL',
      'disaster confirmed, adding glitter',
      'I am the fire.',
    ],
  },

  { id: 'fill-paris', kind: 'fill', category: 'fill', difficulty: 1, text: 'The capital of France is ____.', answer: 'Paris' },
  { id: 'fill-h2o', kind: 'fill', category: 'fill', difficulty: 1, text: 'H2O is commonly called ____.', answer: 'water' },
  { id: 'fill-seven', kind: 'fill', category: 'fill', difficulty: 1, text: 'A week has ____ days.', answer: '7', aliases: ['seven'] },
  { id: 'fill-oxygen', kind: 'fill', category: 'fill', difficulty: 2, text: 'The chemical symbol for oxygen is ____.', answer: 'O' },
  { id: 'fill-tokyo', kind: 'fill', category: 'fill', difficulty: 1, text: 'Japan\'s capital is ____.', answer: 'Tokyo', aliases: ['Tokio'] },
  {
    id: 'fill-freeze',
    kind: 'fill',
    category: 'fill',
    difficulty: 1,
    text: 'Water freezes at ____ °C.',
    answer: '0',
    aliases: ['zero', '0 C'],
    options: ['0', '32', '100', '−1'],
  },
  { id: 'fill-sun', kind: 'fill', category: 'fill', difficulty: 1, text: 'Earth orbits the ____.', answer: 'Sun', aliases: ['the Sun', 'Sol'] },
  { id: 'fill-hex', kind: 'fill', category: 'fill', difficulty: 1, text: 'A hexagon has ____ sides.', answer: '6', aliases: ['six'] },
];

export function localJobPool(): JobItem[] {
  return [...TRIVIA, ...JOBS, ...BONUS] as JobItem[];
}

export function jobKindLabel(kind: PromptKind): string {
  switch (kind) {
    case 'mc':
      return 'Trivia';
    case 'typed':
      return 'Short answer';
    case 'translate':
      return 'Translate';
    case 'math':
      return 'Math';
    case 'unit':
      return 'Units';
    case 'weekday':
      return 'Calendar';
    case 'spell':
      return 'Spelling';
    case 'unscramble':
      return 'Unscramble';
    case 'order':
      return 'Order';
    case 'tone':
      return 'Tone';
    case 'fill':
      return 'Fill-in';
    case 'draw':
      return 'Bonus draw';
    case 'sound':
      return 'Bonus sound';
    default:
      return kind;
  }
}

export function asTriviaItems(items: readonly JobItem[]): TriviaItem[] {
  return items as TriviaItem[];
}

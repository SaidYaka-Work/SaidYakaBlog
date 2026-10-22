import { mulberry32, shuffle } from '../logic';
import { optionKey, validateQuestion } from './validate';
import type { BankKind, BankQuestion } from './types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const UNIT_ROWS = [
  { from: 'minutes', to: 'seconds', factor: 60, extra: 0 },
  { from: 'hours', to: 'minutes', factor: 60, extra: 0 },
  { from: 'hours', to: 'seconds', factor: 3600, extra: 0 },
  { from: 'days', to: 'hours', factor: 24, extra: 0 },
  { from: 'weeks', to: 'days', factor: 7, extra: 0 },
  { from: 'kilometres', to: 'metres', factor: 1000, extra: 0 },
  { from: 'metres', to: 'centimetres', factor: 100, extra: 0 },
  { from: 'kilograms', to: 'grams', factor: 1000, extra: 0 },
  { from: 'litres', to: 'millilitres', factor: 1000, extra: 0 },
] as const;

const SPELL_WORDS = [
  ['separate', 'seperate', 'separete', 'separrate'],
  ['definitely', 'definately', 'definatly', 'definetly'],
  ['necessary', 'neccessary', 'necesary', 'nessessary'],
  ['accommodate', 'accomodate', 'acommodate', 'accomadate'],
  ['rhythm', 'rythm', 'rhythym', 'rythem'],
  ['occurrence', 'occurence', 'occurrance', 'ocurrance'],
  ['privilege', 'priviledge', 'privilage', 'privelege'],
  ['maintenance', 'maintainance', 'maintanance', 'maintenence'],
  ['conscience', 'concience', 'consciense', 'consience'],
  ['embarrass', 'embarass', 'embarras', 'emberrass'],
  ['recommend', 'reccomend', 'recomend', 'reccommend'],
  ['questionnaire', 'questionaire', 'questionnare', 'questionnair'],
  ['liaison', 'liason', 'liaision', 'laison'],
  ['millennium', 'milennium', 'millenium', 'milenium'],
  ['pharaoh', 'pharoah', 'pharoh', 'pharao'],
  ['weird', 'wierd', 'weerd', 'weiird'],
  ['vacuum', 'vaccuum', 'vacume', 'vaccum'],
  ['misspell', 'mispell', 'misspel', 'mispel'],
  ['acknowledge', 'acknowlege', 'aknowledge', 'acknowldege'],
  ['calendar', 'calender', 'calander', 'calandar'],
] as const;

const UNSCRAMBLE_WORDS = [
  'house',
  'train',
  'apple',
  'bread',
  'chair',
  'plant',
  'river',
  'cloud',
  'stone',
  'light',
  'paper',
  'music',
  'table',
  'green',
  'water',
  'smile',
  'clock',
  'brush',
  'grape',
  'lemon',
  'shirt',
  'piano',
  'honey',
  'tiger',
  'ocean',
  'flame',
  'sugar',
  'pepper',
  'window',
  'garden',
  'button',
  'pencil',
  'orange',
  'planet',
  'bridge',
  'castle',
  'forest',
  'market',
  'silver',
  'yellow',
];

const ORDER_ROWS = [
  { id: 'meals', label: 'daily meals, morning to night', items: ['breakfast', 'lunch', 'dinner'] },
  { id: 'seasons', label: 'seasons of the year, starting at spring', items: ['spring', 'summer', 'autumn', 'winter'] },
  { id: 'week', label: 'weekdays starting Monday', items: ['Monday', 'Tuesday', 'Wednesday'] },
  { id: 'sizes', label: 'sizes, smallest to largest', items: ['small', 'medium', 'large'] },
  { id: 'ages', label: 'people, youngest to oldest', items: ['baby', 'child', 'adult'] },
  { id: 'numbers', label: 'these numbers, least to greatest', items: ['2', '5', '9'] },
  { id: 'rainbow', label: 'classic rainbow colours, first three', items: ['red', 'orange', 'yellow'] },
  { id: 'planets', label: 'planets from the Sun, first three', items: ['Mercury', 'Venus', 'Earth'] },
  { id: 'letters', label: 'these letters, A to Z', items: ['B', 'M', 'T'] },
  { id: 'coffee', label: 'making coffee, first to last', items: ['grind', 'brew', 'pour'] },
] as const;

export const GEN_KINDS = ['math', 'unit', 'weekday', 'spell', 'unscramble', 'order'] as const;
export type GenKind = (typeof GEN_KINDS)[number];

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function uniqueOptions(answer: string, extras: string[], random: () => number): [string, string, string, string] {
  const pool = [answer, ...extras.filter((row) => optionKey(row) !== optionKey(answer) && row.trim())];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const row of shuffle(pool, random)) {
    const key = optionKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length === 4) break;
  }
  while (unique.length < 4) {
    const filler = `${answer}-${unique.length}`;
    if (seen.has(optionKey(filler))) continue;
    unique.push(filler);
    seen.add(optionKey(filler));
  }
  const arranged = shuffle(unique.slice(0, 4), random);
  return [arranged[0], arranged[1], arranged[2], arranged[3]];
}

function scrambleWord(word: string, random: () => number): string {
  if (word.length < 3) return word;
  for (let i = 0; i < 12; i += 1) {
    const next = shuffle(word.split(''), random).join('');
    if (next !== word) return next;
  }
  return `${word.slice(1)}${word[0]}`;
}

function permute<T>(items: readonly T[], random: () => number): T[] {
  let next = items.slice();
  for (let i = 0; i < 8; i += 1) {
    next = shuffle(items, random);
    if (next.join('|') !== items.join('|')) return next;
  }
  return next.slice().reverse();
}

function mathAttempt(seed: number, spin: number): BankQuestion {
  const random = mulberry32((seed + spin * 7919) >>> 0);
  const mode = Math.floor(random() * 4);
  let a = 3 + Math.floor(random() * 20);
  let b = 3 + Math.floor(random() * 9);
  let text = '';
  let answer = 0;
  if (mode === 0) {
    text = `what is ${a} plus ${b}?`;
    answer = a + b;
  } else if (mode === 1) {
    if (b >= a) a += b + 2;
    text = `what is ${a} minus ${b}?`;
    answer = a - b;
  } else if (mode === 2) {
    a = 3 + Math.floor(random() * 9);
    b = 3 + Math.floor(random() * 9);
    text = `what is ${a} times ${b}?`;
    answer = a * b;
  } else {
    b = 3 + Math.floor(random() * 8);
    answer = 3 + Math.floor(random() * 9);
    a = answer * b;
    text = `what is ${a} divided by ${b}?`;
  }
  const extras = [answer + 2, answer + 3, answer + a, answer + b, Math.abs(a + b), Math.abs(a * 2 - b)]
    .filter((n) => n > 0 && n !== answer)
    .map((n) => String(n));
  return {
    id: `gen-math-${seed}`,
    kind: 'math',
    category: 'math',
    difficulty: mode === 2 || mode === 3 ? 2 : 1,
    text,
    options: uniqueOptions(String(answer), extras, random),
    answer: String(answer),
  };
}

export function generateMath(seed: number): BankQuestion {
  return firstValid(seed, mathAttempt);
}

function firstValid(seed: number, factory: (seed: number, spin: number) => BankQuestion): BankQuestion {
  for (let spin = 0; spin < 40; spin += 1) {
    const row = factory(seed, spin);
    if (!validateQuestion(row).length) return row;
  }
  const fallback = factory(seed, 99);
  return {
    ...fallback,
    text: 'what is 8 plus 5?',
    options: uniqueOptions('13', ['11', '12', '14'], mulberry32(seed)),
    answer: '13',
  };
}

export function generateUnit(seed: number): BankQuestion {
  return firstValid(seed, (base, spin) => {
    const random = mulberry32((base + spin * 4243) >>> 0);
    const row = pick(UNIT_ROWS, random);
    const amount = 2 + Math.floor(random() * 8);
    const answer = amount * row.factor;
    const extras = [amount * 10, amount * 100, answer + amount, answer + row.factor, amount * 60]
      .map((n) => String(Math.round(n)))
      .filter((n) => optionKey(n) !== optionKey(String(answer)));
    return {
      id: `gen-unit-${base}`,
      kind: 'unit',
      category: 'unit',
      difficulty: row.factor >= 1000 ? 2 : 1,
      text: `how many ${row.to} are in ${amount} ${row.from}?`,
      options: uniqueOptions(String(answer), extras, random),
      answer: String(answer),
    };
  });
}

export function generateWeekday(seed: number): BankQuestion {
  return firstValid(seed, (base, spin) => {
    const random = mulberry32((base + spin * 3331) >>> 0);
    const start = Math.floor(random() * 7);
    const delta = 1 + Math.floor(random() * 6);
    const after = random() > 0.45;
    const answerIndex = after ? (start + delta) % 7 : (start - delta + 70) % 7;
    const answer = DAYS[answerIndex];
    const extras = DAYS.filter((day) => day !== answer) as string[];
    return {
      id: `gen-weekday-${base}`,
      kind: 'weekday',
      category: 'weekday',
      difficulty: delta >= 4 ? 2 : 1,
      text: after
        ? `what day is ${delta} day${delta === 1 ? '' : 's'} after ${DAYS[start]}?`
        : `what day is ${delta} day${delta === 1 ? '' : 's'} before ${DAYS[start]}?`,
      options: uniqueOptions(answer, extras, random),
      answer,
    };
  });
}

export function generateSpell(seed: number): BankQuestion {
  return firstValid(seed, (base, spin) => {
    const random = mulberry32((base + spin * 2711) >>> 0);
    const row = pick(SPELL_WORDS, random);
    const answer = row[0];
    return {
      id: `gen-spell-${base}`,
      kind: 'spell',
      category: 'spell',
      difficulty: 2,
      text: 'which spelling is the real English one?',
      options: uniqueOptions(answer, row.slice(1) as string[], random),
      answer,
    };
  });
}

export function generateUnscramble(seed: number): BankQuestion {
  return firstValid(seed, (base, spin) => {
    const random = mulberry32((base + spin * 1999) >>> 0);
    const answer = pick(UNSCRAMBLE_WORDS, random);
    const mixed = scrambleWord(answer, random);
    const extras = UNSCRAMBLE_WORDS.filter((word) => word !== answer && Math.abs(word.length - answer.length) <= 1);
    return {
      id: `gen-unscramble-${base}`,
      kind: 'unscramble',
      category: 'unscramble',
      difficulty: 2,
      text: `unscramble "${mixed}"`,
      options: uniqueOptions(answer, extras, random),
      answer,
    };
  });
}

export function generateOrder(seed: number): BankQuestion {
  return firstValid(seed, (base, spin) => {
    const random = mulberry32((base + spin * 1181) >>> 0);
    const row = pick(ORDER_ROWS, random);
    const answer = row.items.join(', ');
    const extras = [0, 1, 2, 3, 4, 5, 6]
      .map((n) => permute(row.items, mulberry32((base + spin + n) >>> 0)).join(', '))
      .filter((line) => optionKey(line) !== optionKey(answer));
    return {
      id: `gen-order-${base}`,
      kind: 'order',
      category: 'order',
      difficulty: 2,
      text: `which list is the right order for ${row.label}?`,
      options: uniqueOptions(answer, extras, random),
      answer,
    };
  });
}

export function generatePuzzle(kind: GenKind, seed: number): BankQuestion {
  switch (kind) {
    case 'math':
      return generateMath(seed);
    case 'unit':
      return generateUnit(seed);
    case 'weekday':
      return generateWeekday(seed);
    case 'spell':
      return generateSpell(seed);
    case 'unscramble':
      return generateUnscramble(seed);
    case 'order':
      return generateOrder(seed);
    default:
      return generateMath(seed);
  }
}

export function generateDailyPuzzles(seed: number, count: number): BankQuestion[] {
  const random = mulberry32(seed ^ 0x51ed);
  const kinds = shuffle([...GEN_KINDS], random);
  const out: BankQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    const kind = kinds[i % kinds.length] ?? 'math';
    out.push(generatePuzzle(kind, (seed + (i + 1) * 9973) >>> 0));
  }
  return out;
}

export function isGenKind(kind: BankKind): kind is GenKind {
  return (GEN_KINDS as readonly string[]).includes(kind);
}

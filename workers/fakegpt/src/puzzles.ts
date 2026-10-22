import { mulberry32 } from '../../../components/games/fakegpt/logic';
import { normalizeAnswer } from '../../../components/games/fakegpt/match';
import { dateSeed, type DailyRound, type PromptKind } from './schema';

export const CODE_KEY_KINDS = ['math', 'unit', 'weekday', 'order', 'unscramble', 'spell'] as const;
export type CodeKeyKind = (typeof CODE_KEY_KINDS)[number];
export const AI_KEY_KINDS = ['mc', 'typed', 'translate', 'tone', 'fill'] as const;

export function isCodeKeyKind(kind: string): kind is CodeKeyKind {
  return (CODE_KEY_KINDS as readonly string[]).includes(kind);
}

export function isAiKeyKind(kind: string): boolean {
  return (AI_KEY_KINDS as readonly string[]).includes(kind);
}

export type PuzzleSpec = {
  id: string;
  kind: CodeKeyKind;
  /** Code-written in-character fallback prepended when the model lead-in leaks. */
  lead: string;
  /** Puzzle line with the numbers or words. Code always owns this. */
  question: string;
  /** Same as `question` — kept so math/unit validators can read the fact line. */
  prompt: string;
  answer: string;
  aliases: string[];
  options: string[];
  category: string;
  difficulty: 1 | 2 | 3;
};

const DEFAULT_LEADS: Record<CodeKeyKind, readonly string[]> = {
  math: ['quick math', 'calculator died', 'before coffee'],
  unit: ['unit brain needed', 'convert this', 'quick conversion'],
  weekday: ['calendar check', 'date brain please', 'quick calendar'],
  order: ['put these in order', 'sort these', 'right sequence please'],
  unscramble: ['word salad', 'letters got scrambled', 'unscramble this'],
  spell: ['spelling check', 'this looks wrong', 'fix the spelling'],
};

export function assembleQuestion(lead: string, question: string): string {
  const head = String(lead || '')
    .replace(/\s+/g, ' ')
    .trim();
  const body = String(question || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!head) return body;
  if (!body) return head;
  return `${head} ${body}`;
}

export function containsNormalizedToken(haystack: string, needle: string): boolean {
  const h = normalizeAnswer(haystack);
  const n = normalizeAnswer(needle);
  if (!n || !h) return false;
  if (h === n) return true;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^| )${escaped}(?:$| )`).test(h);
}

export function orderItemsOf(answer: string): string[] {
  return normalizeAnswer(answer).split(' ').filter(Boolean);
}

/** True when `text` states the key, a useful alias, or the correct-order sequence. */
export function textLeaksKey(kind: string, text: string, answer: string, aliases: readonly string[] = []): boolean {
  if (containsNormalizedToken(text, answer)) return true;
  const src = normalizeAnswer(text);
  const key = normalizeAnswer(answer);
  if (key && src.includes(key) && (kind === 'order' || key.includes(' '))) return true;
  for (const alias of aliases) {
    const normalized = normalizeAnswer(alias);
    if (!normalized || normalized === key) continue;
    if (containsNormalizedToken(text, alias)) return true;
  }
  return false;
}

function listsOrderItems(lead: string, answer: string): boolean {
  const items = orderItemsOf(answer);
  if (items.length < 2) return false;
  return items.every((item) => containsNormalizedToken(lead, item));
}

/** Reject a model lead-in that gives away the answer or restates the puzzle. */
export function leadInLeaks(puzzle: PuzzleSpec, lead: string): boolean {
  const trimmed = String(lead || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return false;
  if (trimmed.length > 90) return true;
  if (textLeaksKey(puzzle.kind, trimmed, puzzle.answer, puzzle.aliases)) return true;
  if (puzzle.kind === 'order' && listsOrderItems(trimmed, puzzle.answer)) return true;
  const question = normalizeAnswer(puzzle.question || puzzle.prompt);
  const src = normalizeAnswer(trimmed);
  if (question && src.includes(question)) return true;
  return false;
}

export function pickPuzzleLead(puzzle: PuzzleSpec, rawLead: string): { lead: string; flavored: boolean } {
  const lead = String(rawLead || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (lead && !leadInLeaks(puzzle, lead)) return { lead, flavored: true };
  return { lead: puzzle.lead, flavored: false };
}

export const DAILY_PUZZLE_COUNT = 12;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const UNIT_ROWS: readonly { from: string; to: string; factor: number; amounts: readonly number[] }[] = [
  { from: 'meters', to: 'millimeters', factor: 1000, amounts: [1, 1.5, 1.8, 2, 2.5, 3] },
  { from: 'meters', to: 'centimeters', factor: 100, amounts: [1, 1.5, 2, 3, 4] },
  { from: 'kilometers', to: 'meters', factor: 1000, amounts: [1, 2, 3, 5] },
  { from: 'centimeters', to: 'meters', factor: 0.01, amounts: [100, 150, 200, 250, 300] },
  { from: 'millimeters', to: 'meters', factor: 0.001, amounts: [1000, 1500, 2000] },
  { from: 'grams', to: 'kilograms', factor: 0.001, amounts: [250, 500, 1000, 2000] },
  { from: 'kilograms', to: 'grams', factor: 1000, amounts: [1, 2, 3, 5] },
  { from: 'hours', to: 'minutes', factor: 60, amounts: [1, 2, 3] },
  { from: 'minutes', to: 'seconds', factor: 60, amounts: [1, 2, 3] },
  { from: 'days', to: 'hours', factor: 24, amounts: [1, 2] },
  { from: 'hours', to: 'days', factor: 1 / 24, amounts: [24, 48, 72] },
  { from: 'minutes', to: 'hours', factor: 1 / 60, amounts: [60, 120, 180] },
];

const KNOWN_DATES: readonly [number, number, number][] = [
  [2024, 1, 1],
  [2000, 1, 1],
  [2026, 10, 21],
  [1776, 7, 4],
  [2025, 12, 25],
  [2023, 1, 1],
  [2024, 2, 29],
  [2012, 8, 6],
  [1999, 12, 31],
  [2020, 3, 1],
];

const SPELLS: readonly [string, string][] = [
  ['recieve', 'receive'],
  ['seperate', 'separate'],
  ['definately', 'definitely'],
  ['occured', 'occurred'],
  ['tommorrow', 'tomorrow'],
  ['accomodate', 'accommodate'],
  ['wierd', 'weird'],
  ['goverment', 'government'],
  ['enviroment', 'environment'],
  ['Febuary', 'February'],
  ['neccessary', 'necessary'],
  ['thier', 'their'],
  ['untill', 'until'],
  ['truely', 'truly'],
];

const WORDS = ['apple', 'orange', 'house', 'water', 'chair', 'table', 'earth', 'train', 'bread', 'night', 'model', 'token', 'planet', 'guitar', 'window'] as const;
const ALPHA_WORDS = ['cat', 'dog', 'eel', 'ant', 'owl', 'fox', 'bat', 'elk'] as const;
const WEIGHTS = ['feather', 'apple', 'brick', 'car'] as const;
const TEMPS = ['ice', 'water', 'steam'] as const;
const RAINBOW = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'] as const;
const MEALS = ['breakfast', 'lunch', 'dinner'] as const;

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function formatAnswerNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export function spacingAliases(answer: string): string[] {
  const spaced = answer.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced && spaced !== answer ? [spaced] : [];
}

function joinItems(items: readonly string[]): string {
  return items.join(', ');
}

export function weekdayUtc(year: number, month: number, day: number): string {
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function finishPuzzle(
  rng: () => number,
  spec: Omit<PuzzleSpec, 'lead' | 'prompt'> & { lead?: string; prompt?: string },
): PuzzleSpec {
  const lead = spec.lead || pick(rng, DEFAULT_LEADS[spec.kind]);
  const question = spec.question;
  return { ...spec, lead, prompt: spec.prompt || question };
}

function makeMath(rng: () => number, index: number): PuzzleSpec {
  const makers = [
    () => {
      const a = 2 + Math.floor(rng() * 30);
      const b = 2 + Math.floor(rng() * 30);
      return { question: `${a} + ${b}`, lead: 'I dropped my calculator', answer: a + b };
    },
    () => {
      const b = 2 + Math.floor(rng() * 20);
      const a = b + 2 + Math.floor(rng() * 30);
      return { question: `${a} − ${b}`, lead: 'before my coffee', answer: a - b };
    },
    () => {
      const a = 2 + Math.floor(rng() * 12);
      const b = 2 + Math.floor(rng() * 12);
      return { question: `${a} × ${b}`, lead: 'the classic', answer: a * b };
    },
    () => {
      const b = 2 + Math.floor(rng() * 12);
      const q = 2 + Math.floor(rng() * 12);
      return { question: `${b * q} divided by ${b}`, answer: q };
    },
    () => {
      const a = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
      return { question: `${a} squared, not cubed`, answer: a * a };
    },
    () => {
      const percent = pick(rng, [10, 20, 25, 50]);
      const base = pick(rng, [40, 60, 80, 100, 200]);
      return { question: `${percent}% of ${base}`, lead: 'tax brain please', answer: (percent * base) / 100 };
    },
  ];
  const made = pick(rng, makers)();
  const answer = formatAnswerNumber(made.answer);
  return finishPuzzle(rng, {
    id: `pz-math-${index}`,
    kind: 'math',
    lead: made.lead,
    question: made.question,
    answer,
    aliases: [],
    options: [],
    category: 'math',
    difficulty: 1,
  });
}

function makeUnit(rng: () => number, index: number): PuzzleSpec {
  const row = pick(rng, UNIT_ROWS);
  const amount = pick(rng, row.amounts);
  const answer = formatAnswerNumber(amount * row.factor);
  return finishPuzzle(rng, {
    id: `pz-unit-${index}`,
    kind: 'unit',
    question: `Convert ${amount} ${row.from} to ${row.to}`,
    answer,
    aliases: [],
    options: [],
    category: 'units',
    difficulty: 1,
  });
}

function makeWeekday(rng: () => number, index: number): PuzzleSpec {
  if (rng() < 0.25) {
    const today = pick(rng, WEEKDAYS);
    const yesterday = WEEKDAYS[(WEEKDAYS.indexOf(today) + 6) % 7];
    return finishPuzzle(rng, {
      id: `pz-wd-${index}`,
      kind: 'weekday',
      question: `if yesterday was ${yesterday}, today is`,
      answer: today,
      aliases: [],
      options: [],
      category: 'calendar',
      difficulty: 1,
    });
  }
  const [year, month, day] = pick(rng, KNOWN_DATES);
  const answer = weekdayUtc(year, month, day);
  const label = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return finishPuzzle(rng, {
    id: `pz-wd-${index}`,
    kind: 'weekday',
    question: `what day of the week was ${label}`,
    answer,
    aliases: [],
    options: [],
    category: 'calendar',
    difficulty: 2,
  });
}

function makeSpell(rng: () => number, index: number): PuzzleSpec {
  const [wrong, right] = pick(rng, SPELLS);
  return finishPuzzle(rng, {
    id: `pz-sp-${index}`,
    kind: 'spell',
    question: `fix: ${wrong}`,
    answer: right,
    aliases: [],
    options: [],
    category: 'spelling',
    difficulty: 1,
  });
}

export function scrambleWord(word: string, rng: () => number): string {
  let out = word;
  for (let attempt = 0; attempt < 8 && out === word; attempt += 1) {
    out = shuffle(rng, word.split('')).join('');
  }
  if (out === word && word.length >= 2) out = `${word[1]}${word[0]}${word.slice(2)}`;
  return out;
}

function makeUnscramble(rng: () => number, index: number): PuzzleSpec {
  const word = pick(rng, WORDS);
  return finishPuzzle(rng, {
    id: `pz-un-${index}`,
    kind: 'unscramble',
    question: `unscramble: ${scrambleWord(word, rng)}`,
    answer: word,
    aliases: [],
    options: [],
    category: 'words',
    difficulty: 1,
  });
}

function fourPerms(rng: () => number, items: readonly string[], correct: string): string[] {
  const seen = new Set<string>([correct]);
  const options = [correct];
  for (let guard = 0; options.length < 4 && guard < 48; guard += 1) {
    const perm = joinItems(shuffle(rng, items));
    if (seen.has(perm)) continue;
    seen.add(perm);
    options.push(perm);
  }
  for (let offset = 1; options.length < 4 && offset < items.length; offset += 1) {
    const perm = joinItems([...items.slice(offset), ...items.slice(0, offset)]);
    if (seen.has(perm)) continue;
    seen.add(perm);
    options.push(perm);
  }
  return shuffle(rng, options);
}

function makeOrder(rng: () => number, index: number): PuzzleSpec {
  const type = pick(rng, ['alpha', 'numeric', 'rainbow', 'weight', 'temp', 'meals'] as const);
  let items: string[];
  let ordered: string[];
  let rule: string;
  if (type === 'alpha') {
    items = shuffle(rng, ALPHA_WORDS).slice(0, 4);
    ordered = [...items].sort();
    rule = 'alphabetical order';
  } else if (type === 'numeric') {
    items = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4).map(String);
    ordered = [...items].sort((a, b) => Number(a) - Number(b));
    rule = 'smallest to largest';
  } else if (type === 'rainbow') {
    items = shuffle(rng, RAINBOW).slice(0, 4);
    ordered = [...items].sort((a, b) => RAINBOW.indexOf(a) - RAINBOW.indexOf(b));
    rule = 'rainbow order';
  } else if (type === 'weight') {
    items = [...WEIGHTS];
    ordered = [...WEIGHTS];
    rule = 'lightest to heaviest';
  } else if (type === 'temp') {
    items = [...TEMPS];
    ordered = [...TEMPS];
    rule = 'coldest to hottest';
  } else {
    items = [...MEALS];
    ordered = [...MEALS];
    rule = 'in a day, chronological';
  }
  const answer = joinItems(ordered);
  const options = fourPerms(rng, items, answer);
  if (!options.includes(answer)) options[0] = answer;
  let shown = joinItems(shuffle(rng, items));
  for (let guard = 0; guard < 8 && normalizeAnswer(shown) === normalizeAnswer(answer); guard += 1) {
    shown = joinItems(shuffle(rng, items));
  }
  if (normalizeAnswer(shown) === normalizeAnswer(answer) && items.length > 1) {
    shown = joinItems([...items.slice(1), items[0]]);
  }
  return finishPuzzle(rng, {
    id: `pz-or-${index}`,
    kind: 'order',
    question: `${rule}: ${shown}`,
    answer,
    aliases: [],
    options,
    category: 'order',
    difficulty: 1,
  });
}

const MAKERS = [makeMath, makeUnit, makeWeekday, makeOrder, makeUnscramble, makeSpell];

export function buildDayPuzzles(date: string, count = DAILY_PUZZLE_COUNT): PuzzleSpec[] {
  const rng = mulberry32(dateSeed(`${date}:puzzles`));
  const out: PuzzleSpec[] = [];
  const used = new Set<string>();
  let index = 0;
  let guard = 0;
  while (out.length < count && guard < count * 10) {
    guard += 1;
    const puzzle = MAKERS[out.length % MAKERS.length](rng, index);
    index += 1;
    const assembled = assembleQuestion(puzzle.lead, puzzle.question);
    if (textLeaksKey(puzzle.kind, assembled, puzzle.answer, puzzle.aliases)) continue;
    if (textLeaksKey(puzzle.kind, puzzle.question, puzzle.answer, puzzle.aliases)) continue;
    const key = `${puzzle.kind}:${puzzle.question}:${puzzle.answer}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push(puzzle);
  }
  return out;
}

export function puzzleToRound(puzzle: PuzzleSpec, over: Partial<DailyRound> = {}): DailyRound {
  return {
    id: puzzle.id,
    kind: puzzle.kind as PromptKind,
    text: over.text || assembleQuestion(puzzle.lead, puzzle.question),
    persona: over.persona || 'Dana',
    vibe: over.vibe || 'impatient, funny, slightly unhinged',
    category: puzzle.category,
    difficulty: puzzle.difficulty,
    answer: puzzle.answer,
    aliases: puzzle.aliases,
    options: puzzle.options,
    nudges: over.nudges?.length ? over.nudges : ['hello??', 'are you still generating?'],
    good: over.good || 'ok the model remembered a fact. rare.',
    bad: over.bad || `that's a hallucination, buddy. it's ${puzzle.answer}.`,
  };
}

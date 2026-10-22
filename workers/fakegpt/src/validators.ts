import { parseFlexibleNumber } from '../../../components/games/fakegpt/jobs';
import { matchChoice, normalizeAnswer } from '../../../components/games/fakegpt/match';
import { firstName, type DailyPersona } from '../../../components/games/fakegpt/lanes';
import { isFormatAlias } from './schema';
import type { DailyRound } from './schema';

const TARGET_LANGUAGE =
  /\b(english|spanish|french|german|italian|portuguese|japanese|chinese|korean|arabic|latin|dutch|swedish|norwegian|danish|russian|hindi|greek|hebrew|polish|turkish|esperanto|mandarin)\b/i;

const ORDER_RULE =
  /\b(alphabet|alpha(?:betical)?|a to z|numeric|numerical|numbers?|smallest|largest|least|greatest|count(?:ing)?(?:\s+up|\s+down)?|chronolog|time order|ascending|descending|first to last|low to high|high to low|rainbow|classic colors|weekdays?)\b/i;

const TIME_SENSITIVE =
  /\b((most|fewest|how many)\s+moons?|moons?\s+(does|of)\s+(jupiter|saturn|uranus|neptune)|world record|tallest (building|mountain|tower)|fastest (animal|land animal)|oldest living)\b/i;

const NONSENSE = /\bbuilt-in umbrella\b|\bumbrella called a dorsal\b/i;

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const RAINBOW = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];

const LENGTH_SI: Record<string, number> = {
  mm: 0.001,
  millimeter: 0.001,
  millimeters: 0.001,
  cm: 0.01,
  centimeter: 0.01,
  centimeters: 0.01,
  m: 1,
  meter: 1,
  meters: 1,
  km: 1000,
  kilometer: 1000,
  kilometers: 1000,
  inch: 0.0254,
  inches: 0.0254,
  in: 0.0254,
  foot: 0.3048,
  feet: 0.3048,
  ft: 0.3048,
  yard: 0.9144,
  yards: 0.9144,
  yd: 0.9144,
};

const MASS_SI: Record<string, number> = {
  g: 0.001,
  gram: 0.001,
  grams: 0.001,
  kg: 1,
  kilogram: 1,
  kilograms: 1,
};

const TIME_SEC: Record<string, number> = {
  second: 1,
  seconds: 1,
  sec: 1,
  minute: 60,
  minutes: 60,
  min: 60,
  hour: 3600,
  hours: 3600,
  hr: 3600,
  day: 86400,
  days: 86400,
  week: 604800,
  weeks: 604800,
};

export type RoundCheck = { ok: true; round: DailyRound } | { ok: false; reason: string };

export function namesTargetLanguage(text: string): boolean {
  return TARGET_LANGUAGE.test(text);
}

export function isAmbiguousUnitPrompt(text: string): boolean {
  const src = text.toLowerCase();
  if (/\b(flour|sugar|butter|rice|baking|ingredient)\b/.test(src) && /\b(oz|ounce)s?\b/.test(src)) return true;
  const volumeToOz = /\b(cups?|tbsp|tablespoons?|teaspoons?|tsp|ml|liters?|pints?|gallons?)\b/.test(src) && /\b(oz|ounce)s?\b/.test(src);
  if (volumeToOz && !/\bfl(?:uid)?\.?\s*oz\b/.test(src) && !/\bfluid\b/.test(src) && !/\bweight\b/.test(src)) return true;
  return false;
}

export function isTimeSensitivePrompt(text: string): boolean {
  return TIME_SENSITIVE.test(text);
}

export function isNonsensicalPrompt(text: string): boolean {
  return NONSENSE.test(text);
}

export function optionTokens(value: string): string[] {
  return normalizeAnswer(value).split(' ').filter(Boolean);
}

function sortedJoin(tokens: string[]): string {
  return [...tokens].sort().join('\0');
}

export function optionsArePermutations(options: readonly string[]): boolean {
  if (options.length < 2) return false;
  const base = optionTokens(options[0]);
  if (base.length < 2) return false;
  return options.every((option) => {
    const tokens = optionTokens(option);
    return tokens.length === base.length && sortedJoin(tokens) === sortedJoin(base);
  });
}

export function hasMoreSpecificDistractor(answer: string, options: readonly string[]): boolean {
  const key = normalizeAnswer(answer);
  if (!key) return false;
  return options.some((option) => {
    const got = normalizeAnswer(option);
    if (!got || got === key) return false;
    return got.includes(key) && got.length > key.length;
  });
}

export function hasOrderRule(text: string): boolean {
  return ORDER_RULE.test(text);
}

function tokenValue(token: string): number | null {
  if (token in NUMBER_WORDS) return NUMBER_WORDS[token];
  const num = Number(token);
  return Number.isFinite(num) ? num : null;
}

export function computeOrderAnswer(text: string, options: readonly string[]): string | null {
  if (!optionsArePermutations(options)) return null;
  const items = optionTokens(options[0]);
  const asked = text.toLowerCase();
  let ordered: string[] | null = null;
  if (/\balphabet|a to z\b/.test(asked)) {
    ordered = [...items].sort();
  } else if (items.every((item) => RAINBOW.includes(item))) {
    ordered = [...items].sort((a, b) => RAINBOW.indexOf(a) - RAINBOW.indexOf(b));
  } else if (/\b(numeric|numerical|smallest|largest|least|greatest|count|ascending|descending|low to high|high to low)\b/.test(asked)) {
    if (!items.every((item) => tokenValue(item) != null)) return null;
    ordered = [...items].sort((a, b) => (tokenValue(a) ?? 0) - (tokenValue(b) ?? 0));
    if (/\b(largest|greatest|descending|high to low|count down)\b/.test(asked)) ordered.reverse();
  }
  if (!ordered) return null;
  const want = normalizeAnswer(ordered.join(' '));
  const match = options.find((option) => normalizeAnswer(option) === want);
  return match ?? null;
}

export function computeMathAnswer(text: string): number | null {
  const src = text.replace(/×/g, '*').replace(/−/g, '-').replace(/÷/g, '/');
  const percent = src.match(/(-?\d+(?:\.\d+)?)\s*%\s+of\s+(-?\d+(?:\.\d+)?)/i);
  if (percent) return (Number(percent[1]) / 100) * Number(percent[2]);
  const half = src.match(/\bhalf of\s+(-?\d+(?:\.\d+)?)/i);
  if (half) return Number(half[1]) / 2;
  const root = src.match(/square root of\s+(-?\d+(?:\.\d+)?)/i);
  if (root) return Math.sqrt(Number(root[1]));
  const squared = src.match(/(-?\d+(?:\.\d+)?)\s+squared\b/i);
  if (squared) return Number(squared[1]) ** 2;
  const cubed = src.match(/(-?\d+(?:\.\d+)?)\s+cubed\b/i);
  if (cubed) return Number(cubed[1]) ** 3;
  const power = src.match(/(-?\d+(?:\.\d+)?)\s+(?:to the power of|\^)\s*(-?\d+)/i);
  if (power) return Number(power[1]) ** Number(power[2]);
  const triple = src.match(/(-?\d+(?:\.\d+)?)\s*([*x+/-])\s*(-?\d+(?:\.\d+)?)\s*([*x+/-])\s*(-?\d+(?:\.\d+)?)/i);
  if (triple) {
    const a = Number(triple[1]);
    const b = Number(triple[3]);
    const c = Number(triple[5]);
    const first = applyOp(a, triple[2], b);
    if (first == null) return null;
    return applyOp(first, triple[4], c);
  }
  const pair = src.match(/(-?\d+(?:\.\d+)?)\s*(plus|\+|minus|-|times|\*|x|multipl(?:y|ied by)?|divided by|\/)\s*(-?\d+(?:\.\d+)?)/i);
  if (pair) return applyOp(Number(pair[1]), pair[2], Number(pair[3]));
  return null;
}

function applyOp(left: number, op: string, right: number): number | null {
  const token = op.toLowerCase();
  if (token === '+' || token === 'plus') return left + right;
  if (token === '-' || token === 'minus') return left - right;
  if (token === '*' || token === 'x' || token === 'times' || token.startsWith('multipl')) return left * right;
  if (token === '/' || token.startsWith('divided')) return right === 0 ? null : left / right;
  return null;
}

function lookupUnit(token: string, table: Record<string, number>): number | null {
  return table[token] ?? null;
}

export function computeUnitAnswer(text: string): number | null {
  const src = text.toLowerCase().replace(/[?.,]/g, ' ');
  if (/32\s+fahrenheit|fahrenheit is what celsius/.test(src)) return 0;
  if (/water boils/.test(src) && /fahrenheit/.test(src)) return 212;
  if (/days in a (?:common )?(?:not leap )?year/.test(src) || /common \(not leap\) year/.test(src)) return 365;
  if (/days in a week/.test(src)) return 7;
  if (/hours in a day/.test(src)) return 24;
  if (/minutes in an hour/.test(src)) return 60;
  if (/seconds in a minute/.test(src)) return 60;
  if (/inches in a foot/.test(src)) return 12;
  if (/feet in a yard/.test(src)) return 3;

  const qty = src.match(/(-?\d+(?:\.\d+)?)\s+([a-z]+)/);
  const toward = src.match(/(?:how many|in|to)\s+([a-z]+)/);
  if (qty && toward) {
    const amount = Number(qty[1]);
    const from = qty[2];
    const to = toward[1];
    for (const table of [LENGTH_SI, MASS_SI, TIME_SEC]) {
      const a = lookupUnit(from, table);
      const b = lookupUnit(to, table);
      if (a != null && b != null && b !== 0) return amount * (a / b);
    }
  }
  return null;
}

function numbersClose(got: string, want: number): boolean {
  const parsed = parseFlexibleNumber(got);
  return parsed != null && Math.abs(parsed - want) <= 0.051;
}

export function validateAiRound(round: DailyRound): RoundCheck {
  if (isTimeSensitivePrompt(round.text) || isNonsensicalPrompt(round.text)) {
    return { ok: false, reason: 'unstable-or-nonsense' };
  }
  if (hasMoreSpecificDistractor(round.answer, round.options)) {
    return { ok: false, reason: 'specific-distractor' };
  }

  if (round.kind === 'translate') {
    const aliases = round.aliases.filter((alias) => isFormatAlias(alias, round.answer));
    return { ok: true, round: { ...round, aliases } };
  }

  if (round.kind === 'order') {
    if (!optionsArePermutations(round.options)) {
      return { ok: false, reason: 'order-shape' };
    }
    const computed = computeOrderAnswer(round.text, round.options);
    if (computed) {
      return { ok: true, round: { ...round, answer: computed } };
    }
  }

  if (round.kind === 'math') {
    const computed = computeMathAnswer(round.text);
    if (computed != null && !numbersClose(round.answer, computed)) {
      return { ok: true, round: { ...round, answer: String(computed), aliases: [] } };
    }
  }

  if (round.kind === 'unit') {
    if (isAmbiguousUnitPrompt(round.text)) return { ok: false, reason: 'unit-ambiguous' };
    const computed = computeUnitAnswer(round.text);
    if (computed != null && !numbersClose(round.answer, computed)) {
      return { ok: true, round: { ...round, answer: String(computed), aliases: [] } };
    }
  }

  if (round.kind === 'mc' || round.kind === 'tone' || (round.kind === 'fill' && round.options.length === 4)) {
    const hits = round.options.filter((option) => matchChoice(option, round.answer)).length;
    if (round.options.length === 4 && hits !== 1) return { ok: false, reason: 'mc-key' };
  }

  return { ok: true, round };
}

export function filterAiRounds(rounds: DailyRound[]): DailyRound[] {
  const kept: DailyRound[] = [];
  for (const row of rounds) {
    const checked = validateAiRound(row);
    if (checked.ok) {
      kept.push(checked.round);
    } else {
      console.log(`fakegpt daily drop id=${row.id} reason=${checked.reason}`);
    }
  }
  return kept;
}

export function personaNameKeys(personas: readonly DailyPersona[]): string[] {
  const keys = new Set<string>();
  for (const row of personas) {
    const full = row.name.trim();
    if (full.length >= 3) keys.add(full);
    const first = firstName(full);
    if (first.length >= 3) keys.add(first);
  }
  return [...keys];
}

export function mentionsOtherPersona(text: string, self: string, personas: readonly DailyPersona[]): boolean {
  const own = new Set([self, firstName(self)].map((name) => name.toLowerCase()).filter((name) => name.length >= 3));
  for (const name of personaNameKeys(personas)) {
    if (own.has(name.toLowerCase())) continue;
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) return true;
  }
  return false;
}

export function sanitizeReplies(round: DailyRound, personas: readonly DailyPersona[]): DailyRound {
  const good = mentionsOtherPersona(round.good, round.persona, personas)
    ? 'ok wait. the model knew a thing. screenshotting the void.'
    : round.good;
  const bad = mentionsOtherPersona(round.bad, round.persona, personas)
    ? `that's a hallucination, buddy. it's ${round.answer}.`
    : round.bad;
  return { ...round, good, bad };
}

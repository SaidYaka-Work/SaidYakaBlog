import { QUOTES } from './quotes';
import type { Cell, Field, Grade, Mode, Puzzle, Quote, Result, Word } from './types';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const MAX_SCORE = 100;
export const MAX_HINTS = 3;
export const HINT_COST = 15;
export const GRACE_SECONDS = 180;
export const TIME_STEP_SECONDS = 30;
export const TIME_STEP_COST = 3;
export const MIN_SOLVED_SCORE = 25;
export const LAUNCH_DATE = '2026-10-25';

export const ENGLISH_ORDER = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';

const FIELD_LABEL: Record<Field, string> = {
  literature: 'Literature',
  philosophy: 'Philosophy',
  politics: 'Politics',
  science: 'Science',
  poetry: 'Poetry',
  faith: 'Faith',
};

const GRADE_LABEL: Record<Grade, string> = {
  swift: 'Swift',
  steady: 'Steady',
  patient: 'Patient',
  hinted: 'Hinted',
  guided: 'Guided',
};

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0x3c6ef372) >>> 0;
}

export function mulberry32(seed: number) {
  return () => {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function calendarDayIndex(date: string, launch = LAUNCH_DATE): number {
  const current = Date.parse(`${date}T00:00:00Z`);
  const origin = Date.parse(`${launch}T00:00:00Z`);
  return Math.floor((current - origin) / 86_400_000);
}

export function puzzleNumberForDate(date: string): number {
  return Math.max(1, calendarDayIndex(date) + 1);
}

export function lettersIn(text: string): string {
  return text.toUpperCase().replace(/[^A-Z]/g, '');
}

export function uniqueLetters(text: string): string[] {
  return Array.from(new Set(lettersIn(text).split('')));
}

function validateBank(quotes: readonly Quote[]) {
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const quote of quotes) {
    if (ids.has(quote.id)) throw new Error(`Plaintext: duplicate id ${quote.id}`);
    ids.add(quote.id);
    const normalized = lettersIn(quote.text);
    if (texts.has(normalized)) throw new Error(`Plaintext: duplicate text ${quote.id}`);
    texts.add(normalized);
    if (!quote.text.trim() || !quote.author.trim() || !quote.bio.trim() || !quote.why.trim()) {
      throw new Error(`Plaintext: incomplete ${quote.id}`);
    }
    const unique = uniqueLetters(quote.text);
    if (unique.length < 8) {
      throw new Error(`Plaintext: ${quote.id} has only ${unique.length} unique letters`);
    }
    if (normalized.length < 18) {
      throw new Error(`Plaintext: ${quote.id} is too short (${normalized.length} letters)`);
    }
    if (normalized.length > 280) {
      throw new Error(`Plaintext: ${quote.id} is too long (${normalized.length} letters)`);
    }
    const sentences = quote.bio.split(/[.?!](?:\s|$)/).filter((part) => part.trim().length > 20);
    if (sentences.length < 2) {
      throw new Error(`Plaintext: ${quote.id} bio should be 2–3 sentences`);
    }
  }
  if (quotes.length < 60) {
    throw new Error(`Plaintext: bank has ${quotes.length} quotes; need at least 60`);
  }
}

validateBank(QUOTES);

/** Sattolo’s algorithm: one cycle through the alphabet, so no letter maps to itself. */
export function derangeAlphabet(random: () => number): string[] {
  const next = ALPHABET.split('');
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * i);
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  if (next.some((letter, index) => letter === ALPHABET[index])) {
    return derangeAlphabet(random);
  }
  return next;
}

export function makeMaps(random: () => number): { encodeMap: Record<string, string>; decodeMap: Record<string, string> } {
  const image = derangeAlphabet(random);
  const encodeMap: Record<string, string> = {};
  const decodeMap: Record<string, string> = {};
  for (let i = 0; i < ALPHABET.length; i += 1) {
    const plain = ALPHABET[i];
    const cipher = image[i];
    encodeMap[plain] = cipher;
    decodeMap[cipher] = plain;
  }
  return { encodeMap, decodeMap };
}

export function encodeText(text: string, encodeMap: Record<string, string>): string {
  return text.replace(/[A-Za-z]/g, (char) => encodeMap[char.toUpperCase()] ?? char);
}

export function buildPuzzle(quote: Quote, seed: number): Puzzle {
  const random = mulberry32(seed);
  const { encodeMap, decodeMap } = makeMaps(random);
  return {
    quote,
    encodeMap,
    decodeMap,
    encoded: encodeText(quote.text, encodeMap),
  };
}

export function pickQuote(seed: number): Quote {
  return shuffle(QUOTES, mulberry32(seed))[0];
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  const seed = dateSeed(date);
  return buildPuzzle(pickQuote(seed), seed ^ 0x9e3779b9);
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000)): Puzzle {
  return buildPuzzle(pickQuote(seed), seed ^ 0x85ebca6b);
}

export function wordsFrom(encoded: string): Word[] {
  return encoded.split(/(\s+)/).map((chunk) => ({
    cells: chunk.split('').map((char) =>
      /[A-Z]/.test(char) ? ({ kind: 'letter', cipher: char } satisfies Cell) : ({ kind: 'mark', value: char } satisfies Cell),
    ),
  }));
}

export function frequencies(encoded: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const letter of uniqueLetters(encoded)) counts[letter] = 0;
  for (const char of encoded) {
    if (counts[char] !== undefined) counts[char] += 1;
  }
  return counts;
}

export function frequencyList(encoded: string): { letter: string; count: number }[] {
  const counts = frequencies(encoded);
  return Object.keys(counts)
    .map((letter) => ({ letter, count: counts[letter] }))
    .sort((a, b) => b.count - a.count || a.letter.localeCompare(b.letter));
}

export function usedPlain(guesses: Record<string, string>): Map<string, string[]> {
  const used = new Map<string, string[]>();
  for (const [cipher, plain] of Object.entries(guesses)) {
    if (!plain) continue;
    const list = used.get(plain) ?? [];
    list.push(cipher);
    used.set(plain, list);
  }
  return used;
}

export function conflictsOf(guesses: Record<string, string>): Set<string> {
  const flagged = new Set<string>();
  Array.from(usedPlain(guesses).values()).forEach((ciphers) => {
    if (ciphers.length < 2) return;
    ciphers.forEach((cipher) => flagged.add(cipher));
  });
  return flagged;
}

export function isSolved(puzzle: Puzzle, guesses: Record<string, string>): boolean {
  const needed = uniqueLetters(puzzle.encoded);
  if (needed.length === 0) return false;
  return needed.every((cipher) => guesses[cipher] === puzzle.decodeMap[cipher]);
}

export function nextEmptyCipher(letters: string[], guesses: Record<string, string>, current: string | null): string | null {
  if (letters.length === 0) return null;
  const start = current ? Math.max(0, letters.indexOf(current)) : -1;
  for (let offset = 1; offset <= letters.length; offset += 1) {
    const candidate = letters[(start + offset) % letters.length];
    if (!guesses[candidate]) return candidate;
  }
  return current && guesses[current] ? null : current;
}

export function nextHint(puzzle: Puzzle, guesses: Record<string, string>): string | null {
  const counts = frequencies(puzzle.encoded);
  const open = uniqueLetters(puzzle.encoded)
    .filter((cipher) => guesses[cipher] !== puzzle.decodeMap[cipher])
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));
  return open[0] ?? null;
}

export function applyHint(
  puzzle: Puzzle,
  guesses: Record<string, string>,
  cipher: string,
): Record<string, string> {
  const plain = puzzle.decodeMap[cipher];
  const next: Record<string, string> = { ...guesses, [cipher]: plain };
  for (const [other, value] of Object.entries(next)) {
    if (other !== cipher && value === plain) delete next[other];
  }
  return next;
}

export function scoreRun(seconds: number, hints: number): number {
  let points = MAX_SCORE - hints * HINT_COST;
  if (seconds > GRACE_SECONDS) {
    const extra = Math.floor((seconds - GRACE_SECONDS) / TIME_STEP_SECONDS);
    points -= extra * TIME_STEP_COST;
  }
  return Math.max(MIN_SOLVED_SCORE, points);
}

export function gradeFor(seconds: number, hints: number): Grade {
  if (hints >= MAX_HINTS) return 'guided';
  if (hints > 0) return 'hinted';
  if (seconds <= GRACE_SECONDS) return 'swift';
  if (seconds <= GRACE_SECONDS * 2) return 'steady';
  return 'patient';
}

export function makeResult(quote: Quote, seconds: number, hints: number): Result {
  return {
    quote,
    seconds,
    hints,
    points: scoreRun(seconds, hints),
    grade: gradeFor(seconds, hints),
  };
}

export function fieldLabel(field: Field) {
  return FIELD_LABEL[field];
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function hintLabel(count: number) {
  return count === 1 ? '1 hint' : `${count} hints`;
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Plaintext #${puzzleNumberForDate(date)}` : 'Plaintext · practice';
  return [title, `${formatTime(result.seconds)} · ${hintLabel(result.hints)} · ${result.points}/${MAX_SCORE}`];
}

export { QUOTES };

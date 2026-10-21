import { BONUS, TRIVIA, type TriviaItem } from './trivia';
import type { Prompt, PromptKind, RoundAttempt, ScoreResult, Thumbs } from './types';
import type { DailyRound } from '../../../workers/fakegpt/src/schema';

export const ROUNDS_PER_RUN = 8;
export const BASE_SECONDS = 24;
export const MIN_SECONDS = 14;
export const MC_SECONDS = 16;
export const TYPED_SECONDS = 20;
export const STORAGE_KEY = 'fakegpt-best';
export const MAX_BONUS_PER_RUN = 1;

export const NUDGE_MARKS = [
  { at: 0.42, text: 'hello??' },
  { at: 0.68, text: 'are you still generating?' },
  { at: 0.86, text: 'my context window is getting bored' },
] as const;

const HALLUCINATION_ROASTS = [
  "that's a hallucination, buddy. I asked a fact and you invented a vibe.",
  'wrong. confidently wrong. the worst model crime.',
  'I fact-checked you against a cereal box and the cereal box won.',
];

const EMPTY_ROASTS = [
  'that is a blank reply. my stapler could do that, and the stapler is unionized.',
  'silence. elegant. useless. sending you to the model garden.',
  'i asked for output and you handed me a vacuum. zero tokens. zero vibes.',
  'this is the loading state of art. i am unsubscribing from you.',
];

const LATE_ROASTS = [
  'you finished after the deadline. even my microwave is faster, and it burns soup.',
  'the answer arrived fashionably late, like a fax from 1997.',
  'good attempt, terrible latency. i have already asked another model.',
];

const DOWN_NOTES = [
  'hm. i requested wonder and received a shrug. thumbs adjacent to down.',
  'this is giving "first draft of a first draft." i will not hang it on the fridge.',
  'technically a response. spiritually a shrug. try having more opinions next time.',
  'i showed this to my houseplant. the houseplant looked away.',
];

const UP_NOTES = [
  'ok wait. this slaps. i am screenshotting the void.',
  'unexpectedly moving. i will think about this in the shower.',
  'the board of imaginary users voted yes. you may continue existing.',
  'this is the good kind of wrong. printing it on a mug immediately.',
  'i do not understand it and that is why it works. gold star, plastic trophy.',
];

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function roundSeconds(roundIndex: number, kind?: PromptKind): number {
  if (kind === 'mc') return Math.max(10, MC_SECONDS - Math.floor(roundIndex / 2));
  if (kind === 'typed') return Math.max(12, TYPED_SECONDS - Math.floor(roundIndex / 2));
  return Math.max(MIN_SECONDS, BASE_SECONDS - roundIndex);
}

export function formatTimer(ms: number): string {
  const safe = Math.max(0, ms);
  const total = Math.ceil(safe / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function shouldIncludeBonus(seed: number): boolean {
  return seed % 2 === 0;
}

export function bonusCountFor(rounds: readonly { kind: string }[]): number {
  return rounds.filter((round) => round.kind === 'draw' || round.kind === 'sound').length;
}

/** Trivia-first run: mostly MC/typed, at most one draw/sound bonus. */
export function pickPrompts(pool: readonly TriviaItem[], count: number, random = Math.random, seed = 1): Prompt[] {
  const mc = shuffle(
    pool.filter((item) => item.kind === 'mc'),
    random,
  );
  const typed = shuffle(
    pool.filter((item) => item.kind === 'typed'),
    random,
  );
  const bonusPool = shuffle(
    pool.filter((item) => item.kind === 'draw' || item.kind === 'sound'),
    random,
  );
  const wantBonus = shouldIncludeBonus(seed) && bonusPool.length > 0;
  const typedCount = wantBonus ? 2 : 3;
  const mcCount = count - typedCount - (wantBonus ? 1 : 0);
  const usedAnswers = new Set<string>();
  const takeUnique = (items: TriviaItem[], n: number) => {
    const picked: TriviaItem[] = [];
    for (const item of takeByDifficulty(items, items.length, random)) {
      const key = item.answer.trim().toLowerCase();
      if (usedAnswers.has(key)) continue;
      usedAnswers.add(key);
      picked.push(item);
      if (picked.length >= n) break;
    }
    return picked;
  };
  const trivia: TriviaItem[] = [];
  trivia.push(...takeUnique(mc, mcCount));
  trivia.push(...takeUnique(typed, typedCount));
  if (trivia.length < mcCount + typedCount) {
    for (const item of shuffle([...mc, ...typed], random)) {
      if (trivia.length >= mcCount + typedCount) break;
      const key = item.answer.trim().toLowerCase();
      if (usedAnswers.has(key) || trivia.some((row) => row.id === item.id)) continue;
      usedAnswers.add(key);
      trivia.push(item);
    }
  }
  trivia.sort((a, b) => a.difficulty - b.difficulty);
  const dressed = trivia.map((item, index) => dressTrivia(item, random, index));
  if (wantBonus) {
    const bonus = dressTrivia(bonusPool[0], random, dressed.length);
    const insertAt = Math.min(dressed.length, 4 + (seed % 2));
    dressed.splice(insertAt, 0, bonus);
  }
  return dressed.slice(0, count);
}

function takeByDifficulty(pool: TriviaItem[], count: number, random: () => number): TriviaItem[] {
  const bands = [1, 2, 3].map((level) => pool.filter((item) => item.difficulty === level));
  const picked: TriviaItem[] = [];
  const used = new Set<string>();
  const targets = [Math.max(1, Math.ceil(count * 0.45)), Math.max(1, Math.ceil(count * 0.8)), count];
  for (let band = 0; band < bands.length && picked.length < count; band += 1) {
    for (const item of bands[band]) {
      if (picked.length >= count || picked.length >= targets[band]) break;
      if (used.has(item.id)) continue;
      used.add(item.id);
      picked.push(item);
    }
  }
  for (const item of shuffle(pool, random)) {
    if (picked.length >= count) break;
    if (used.has(item.id)) continue;
    used.add(item.id);
    picked.push(item);
  }
  return picked;
}

const PERSONAS = [
  'Kira the intern',
  'Uncle Modem',
  'a sentient stapler',
  'the microwave',
  'Roomba 4',
  'a tired sysadmin',
  'Fax from 1997',
  'the last cookie',
];

const VIBES = [
  'panicking at a gate',
  'pub-quiz smug',
  'half-charged and impatient',
  'fact-checking the void',
  'on hold with reality',
  'one espresso past polite',
];

function dressTrivia(item: TriviaItem, random: () => number, index: number): DailyRound {
  const options = item.kind === 'mc' && item.options ? shuffle(item.options, random) : [];
  return {
    id: item.id,
    kind: item.kind,
    text: item.text,
    persona: PERSONAS[Math.floor(random() * PERSONAS.length)] ?? PERSONAS[0],
    vibe: VIBES[Math.floor(random() * VIBES.length)] ?? VIBES[0],
    category: item.category,
    difficulty: item.difficulty,
    answer: item.answer,
    aliases: item.aliases ?? [],
    options,
    nudges: index % 2 === 0 ? ['hello??', 'any day now'] : ['are you still generating?', 'my context window is bored'],
    good: 'ok wait. the model knew a thing. screenshotting the void.',
    bad: `that's a hallucination, buddy. it's ${item.answer}.`,
  };
}

export function localTriviaPool(): TriviaItem[] {
  return [...TRIVIA, ...BONUS];
}

export function nextNudge(elapsedRatio: number, shown: number, custom?: string[]): string | null {
  const text = custom?.[shown] ?? NUDGE_MARKS[shown]?.text;
  if (!text) return null;
  const at = NUDGE_MARKS[shown]?.at ?? 0.42 + shown * 0.22;
  return elapsedRatio >= at ? text : null;
}

export function scoreTrivia(
  attempt: Pick<RoundAttempt, 'submittedInTime' | 'remainingMs' | 'totalMs'> & { correct: boolean; empty: boolean },
  random = Math.random,
): ScoreResult {
  const late = !attempt.submittedInTime;
  if (attempt.empty) {
    return { points: 0, quality: 0, thumbs: 'down', stars: 0, empty: true, late, reaction: pickFrom(EMPTY_ROASTS, random) };
  }
  if (!attempt.correct) {
    return {
      points: late ? 0 : 8,
      quality: 14,
      thumbs: 'down',
      stars: 1,
      empty: false,
      late,
      reaction: pickFrom(HALLUCINATION_ROASTS, random),
    };
  }
  const remainingRatio = attempt.totalMs > 0 ? clamp(attempt.remainingMs / attempt.totalMs, 0, 1) : 0;
  const speedBonus = late ? 0 : Math.round(remainingRatio * 40);
  const onTime = late ? 0 : 100;
  return {
    points: onTime + speedBonus + (late ? 20 : 40),
    quality: late ? 52 : 92,
    thumbs: late ? 'down' : 'up',
    stars: late ? 3 : 5,
    empty: false,
    late,
    reaction: late ? pickFrom(LATE_ROASTS, random) : pickFrom(UP_NOTES, random),
  };
}

export function scoreWithJudge(attempt: RoundAttempt, judgeScore: number, random = Math.random): ScoreResult {
  const empty = attempt.kind === 'draw' ? isEmptyDraw(attempt) : isEmptySound(attempt);
  const late = !attempt.submittedInTime;
  if (empty) return scoreRound(attempt, random);
  const remainingRatio = attempt.totalMs > 0 ? clamp(attempt.remainingMs / attempt.totalMs, 0, 1) : 0;
  const quality = clamp(judgeScore * 10, 1, 100);
  const speedBonus = late ? 0 : Math.round(remainingRatio * 40);
  const onTime = late ? 0 : 100;
  const points = onTime + speedBonus + Math.round(clamp(judgeScore, 0, 10) * 12);
  const thumbs: Thumbs = !late && judgeScore >= 5 ? 'up' : 'down';
  const stars = clamp(Math.round(quality / 20), 1, 5);
  const reaction = late
    ? pickFrom(LATE_ROASTS, random)
    : thumbs === 'down'
      ? pickFrom(DOWN_NOTES, random)
      : pickFrom(UP_NOTES, random);
  return { points, quality, thumbs, stars, empty, late, reaction };
}

export function isEmptyDraw(attempt: Pick<RoundAttempt, 'strokeCount' | 'coverage'>): boolean {
  return attempt.strokeCount <= 0;
}

export function isEmptySound(attempt: Pick<RoundAttempt, 'audioMs' | 'peakLevel' | 'padHits'>): boolean {
  return attempt.padHits <= 0 && attempt.audioMs < 180 && attempt.peakLevel < 0.04;
}

function qualityFrom(attempt: RoundAttempt): number {
  if (attempt.kind === 'draw') {
    if (isEmptyDraw(attempt)) return 0;
    return clamp(
      28 +
        Math.min(32, attempt.strokeCount * 5) +
        Math.min(16, attempt.uniqueColors * 5) +
        Math.min(24, attempt.coverage * 90),
      1,
      100,
    );
  }
  if (isEmptySound(attempt)) return 0;
  return clamp(
    28 +
      Math.min(28, attempt.audioMs / 70) +
      Math.min(22, attempt.peakLevel * 50) +
      Math.min(22, attempt.padHits * 4),
    1,
    100,
  );
}

function pickFrom(list: readonly string[], random: () => number) {
  return list[Math.floor(random() * list.length)] ?? list[0];
}

export function scoreRound(attempt: RoundAttempt, random = Math.random): ScoreResult {
  if (attempt.kind === 'mc' || attempt.kind === 'typed') {
    return scoreTrivia(
      {
        submittedInTime: attempt.submittedInTime,
        remainingMs: attempt.remainingMs,
        totalMs: attempt.totalMs,
        correct: Boolean(attempt.correct),
        empty: Boolean(attempt.empty),
      },
      random,
    );
  }
  const empty = attempt.kind === 'draw' ? isEmptyDraw(attempt) : isEmptySound(attempt);
  const late = !attempt.submittedInTime;
  const remainingRatio = attempt.totalMs > 0 ? clamp(attempt.remainingMs / attempt.totalMs, 0, 1) : 0;
  const quality = empty ? 0 : qualityFrom(attempt);
  const speedBonus = late || empty ? 0 : Math.round(remainingRatio * 40);
  const onTime = late || empty ? 0 : 100;
  const qualityBonus = empty ? 0 : late ? Math.round(quality * 0.25) : Math.round(quality * 0.4);
  const points = empty && late ? 0 : onTime + speedBonus + qualityBonus;
  const thumbs: Thumbs = !empty && !late && quality >= 38 ? 'up' : 'down';
  const stars = empty ? 0 : clamp(Math.round(quality / 20), 1, 5);
  const reaction = empty
    ? pickFrom(EMPTY_ROASTS, random)
    : late
      ? pickFrom(LATE_ROASTS, random)
      : thumbs === 'down'
        ? pickFrom(DOWN_NOTES, random)
        : pickFrom(UP_NOTES, random);

  return { points, quality, thumbs, stars, empty, late, reaction };
}

export function totalScore(artifacts: readonly { points: number }[]): number {
  return artifacts.reduce((sum, item) => sum + item.points, 0);
}

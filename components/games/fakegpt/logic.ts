import type { Prompt, RoundAttempt, ScoreResult, Thumbs } from './types';

export const ROUNDS_PER_RUN = 8;
export const BASE_SECONDS = 24;
export const MIN_SECONDS = 14;
export const STORAGE_KEY = 'fakegpt-best';

export const NUDGE_MARKS = [
  { at: 0.42, text: 'hello??' },
  { at: 0.68, text: 'are you still generating?' },
  { at: 0.86, text: 'my context window is getting bored' },
] as const;

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

export function roundSeconds(roundIndex: number): number {
  return Math.max(MIN_SECONDS, BASE_SECONDS - roundIndex);
}

export function formatTimer(ms: number): string {
  const safe = Math.max(0, ms);
  const total = Math.ceil(safe / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Alternate draw/sound so a full run always exercises both verbs. */
export function pickPrompts(pool: readonly Prompt[], count: number, random = Math.random): Prompt[] {
  const draw = shuffle(
    pool.filter((prompt) => prompt.kind === 'draw'),
    random,
  );
  const sound = shuffle(
    pool.filter((prompt) => prompt.kind === 'sound'),
    random,
  );
  const picked: Prompt[] = [];
  let drawIndex = 0;
  let soundIndex = 0;
  let takeDraw = random() < 0.5;

  while (picked.length < count && (drawIndex < draw.length || soundIndex < sound.length)) {
    if (takeDraw && drawIndex < draw.length) {
      picked.push(draw[drawIndex]);
      drawIndex += 1;
    } else if (!takeDraw && soundIndex < sound.length) {
      picked.push(sound[soundIndex]);
      soundIndex += 1;
    } else if (drawIndex < draw.length) {
      picked.push(draw[drawIndex]);
      drawIndex += 1;
    } else {
      picked.push(sound[soundIndex]);
      soundIndex += 1;
    }
    takeDraw = !takeDraw;
  }

  return picked;
}

export function nextNudge(elapsedRatio: number, shown: number): string | null {
  const mark = NUDGE_MARKS[shown];
  if (!mark) return null;
  return elapsedRatio >= mark.at ? mark.text : null;
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

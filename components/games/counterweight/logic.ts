import type {
  Attempt,
  GenerateOptions,
  Grade,
  Mode,
  Puzzle,
  Result,
  Scale,
  ShapeId,
  ShapeInfo,
  Side,
  Step,
  Token,
  Tone,
} from './types';

export const MAX_TRIES = 4;
export const MAX_SCORE = 100;
export const MAX_HINTS = 3;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 9;
export const LAUNCH_DATE = '2026-10-28';

export const SHAPE_ORDER: ShapeId[] = ['circle', 'triangle', 'square', 'diamond', 'hexagon'];

export const SHAPE_DEFS: Omit<ShapeInfo, 'weight'>[] = [
  { id: 'circle', name: 'circle', plural: 'circles' },
  { id: 'triangle', name: 'triangle', plural: 'triangles' },
  { id: 'square', name: 'square', plural: 'squares' },
  { id: 'diamond', name: 'diamond', plural: 'diamonds' },
  { id: 'hexagon', name: 'hexagon', plural: 'hexagons' },
];

const SHAPE_NAME = Object.fromEntries(SHAPE_DEFS.map((shape) => [shape.id, shape.name])) as Record<
  ShapeId,
  string
>;
const SHAPE_PLURAL = Object.fromEntries(SHAPE_DEFS.map((shape) => [shape.id, shape.plural])) as Record<
  ShapeId,
  string
>;

const COUNT_WORD = ['', 'a', 'two', 'three', 'four', 'five'];

const BLURBS = [
  'A level balance is an equation. Whatever sits on the left equals whatever sits on the right, so you can subtract one scale from another and read the leftover piece as a difference.',
  'Substitution is replacement: once two circles equal a 6-weight, a circle may be swapped for a 3-weight on any later scale. The beam still sits level.',
  'Numbered bars pin the unit. Without a known mass, balanced shapes only give ratios — many assignments would sit level. One number on a pan collapses the system to a single set of weights.',
  'These puzzles are tiny linear systems over the integers 1 to 9. A few independent equations, the rule that each shape is different, and only one assignment survives.',
];

const GRADE_EMOJI: Record<Grade, string> = {
  first: '🎯',
  second: '✨',
  third: '🟢',
  fourth: '🟡',
  miss: '🔴',
};

const GRADE_LABEL: Record<Grade, string> = {
  first: 'First try',
  second: 'Second try',
  third: 'Third try',
  fourth: 'Last try',
  miss: 'Missed',
};

const TONE_EMOJI: Record<Tone, string> = {
  hit: '🟩',
  close: '🟨',
  miss: '⬛',
};

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0xc0ffee11) >>> 0;
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

export function addUtcDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

export function shapeName(id: ShapeId, count = 1): string {
  return count === 1 ? SHAPE_NAME[id] : SHAPE_PLURAL[id];
}

export function cap(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function joinAnd(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function anWeight(value: number): string {
  const article = value === 8 || value === 11 || value === 18 ? 'an' : 'a';
  return `${article} ${value}-weight`;
}

export function countPhrase(count: number, id: ShapeId): string {
  if (count === 1) return `a ${SHAPE_NAME[id]}`;
  return `${COUNT_WORD[count] ?? count} ${SHAPE_PLURAL[id]}`;
}

export function repeatShape(shape: ShapeId, count: number): Token[] {
  return Array.from({ length: count }, () => ({ kind: 'shape' as const, shape }));
}

export function mass(value: number): Token {
  return { kind: 'mass', value };
}

export function describeSide(side: Side): string {
  const parts: string[] = [];
  let index = 0;
  while (index < side.length) {
    const token = side[index];
    if (token.kind === 'mass') {
      parts.push(anWeight(token.value));
      index += 1;
      continue;
    }
    let count = 0;
    const { shape } = token;
    while (index < side.length) {
      const next = side[index];
      if (next.kind !== 'shape' || next.shape !== shape) break;
      count += 1;
      index += 1;
    }
    parts.push(countPhrase(count, shape));
  }
  return joinAnd(parts);
}

export function sideWeight(side: Side, weights: Partial<Record<ShapeId, number>>): number {
  return side.reduce((sum, token) => {
    if (token.kind === 'mass') return sum + token.value;
    return sum + (weights[token.shape] ?? 0);
  }, 0);
}

export function scalesBalance(scales: readonly Scale[], weights: Partial<Record<ShapeId, number>>): boolean {
  return scales.every((scale) => sideWeight(scale.left, weights) === sideWeight(scale.right, weights));
}

function massValuesOk(scale: Scale): boolean {
  const values = [...scale.left, ...scale.right]
    .filter((token): token is Extract<Token, { kind: 'mass' }> => token.kind === 'mass')
    .map((token) => token.value);
  return values.every((value) => value >= 1 && value <= 18);
}

function serialSide(side: Side): string {
  return side.map((token) => (token.kind === 'mass' ? `n${token.value}` : token.shape[0])).join('');
}

function puzzleKey(shapes: readonly ShapeInfo[], scales: readonly Scale[], question: Side): string {
  const shapePart = shapes.map((shape) => `${shape.id[0]}${shape.weight}`).join('');
  const scalePart = scales.map((scale) => `${serialSide(scale.left)}=${serialSide(scale.right)}`).join('|');
  return `${shapePart}~${scalePart}~${serialSide(question)}`;
}

export function findSolutions(
  shapeIds: readonly ShapeId[],
  scales: readonly Scale[],
  minWeight = MIN_WEIGHT,
  maxWeight = MAX_WEIGHT,
  distinct = true,
): Record<ShapeId, number>[] {
  const results: Record<ShapeId, number>[] = [];
  const used = new Set<number>();
  const assign = {} as Record<ShapeId, number>;

  const walk = (index: number) => {
    if (index === shapeIds.length) {
      if (scalesBalance(scales, assign)) results.push({ ...assign });
      return;
    }
    const id = shapeIds[index];
    for (let weight = minWeight; weight <= maxWeight; weight += 1) {
      if (distinct && used.has(weight)) continue;
      used.add(weight);
      assign[id] = weight;
      walk(index + 1);
      used.delete(weight);
    }
  };

  walk(0);
  return results;
}

export function parseGuess(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, '').replace(/_/g, '').replace(/\s+/g, '');
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 1 || value > 99) return null;
  return value;
}

export function guessTone(guess: number, answer: number): Tone {
  if (guess === answer) return 'hit';
  if (Math.abs(guess - answer) <= 2) return 'close';
  return 'miss';
}

export function scoreAttempt(tries: number, solved: boolean): number {
  if (!solved) return 0;
  if (tries <= 1) return 100;
  if (tries === 2) return 80;
  if (tries === 3) return 60;
  return 40;
}

export function gradeFor(tries: number, solved: boolean): Grade {
  if (!solved) return 'miss';
  if (tries <= 1) return 'first';
  if (tries === 2) return 'second';
  if (tries === 3) return 'third';
  return 'fourth';
}

export function makeResult(puzzle: Puzzle, attempts: Attempt[], solved: boolean): Result {
  const tries = attempts.length;
  return {
    puzzle,
    attempts,
    solved,
    tries,
    points: scoreAttempt(tries, solved),
    grade: gradeFor(tries, solved),
  };
}

export function gradeEmoji(grade: Grade) {
  return GRADE_EMOJI[grade];
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function toneEmoji(tone: Tone) {
  return TONE_EMOJI[tone];
}

export function shareGrid(attempts: readonly Attempt[]): string {
  return attempts.map((attempt) => toneEmoji(attempt.tone)).join('');
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Counterweight #${puzzleNumberForDate(date)}` : 'Counterweight · practice';
  const tries = result.solved ? `${result.tries}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
  return [title, shareGrid(result.attempts), `${tries} · ${result.points}/${MAX_SCORE}`];
}

export function unlockedHintCount(misses: number): number {
  return Math.min(MAX_HINTS, Math.max(0, misses));
}

function pickShapeCount(random: () => number): number {
  const roll = random();
  if (roll < 0.42) return 3;
  if (roll < 0.82) return 4;
  return 5;
}

function pickMaxWeight(shapeCount: number): number {
  if (shapeCount <= 3) return 6;
  if (shapeCount === 4) return 8;
  return 9;
}

function explainSum(side: Side, shapes: readonly ShapeInfo[]): string {
  const lookup = Object.fromEntries(shapes.map((shape) => [shape.id, shape.weight])) as Record<ShapeId, number>;
  const bits = side.map((token) => {
    if (token.kind === 'mass') return String(token.value);
    return `${lookup[token.shape]} (${SHAPE_NAME[token.shape]})`;
  });
  const total = sideWeight(side, lookup);
  return `${bits.join(' + ')} = ${total}`;
}

function makeHints(shapes: readonly ShapeInfo[], steps: readonly Step[], answer: number): string[] {
  const ordered = [...shapes].sort((left, right) => left.weight - right.weight);
  const light = ordered[0];
  const heavy = ordered[ordered.length - 1];
  const revealed = steps.find((step) => / = \d+$/.test(step.title)) ?? steps[0];
  const lo = Math.max(1, answer - 3);
  const hi = answer + 3;
  return [
    `The ${light.name} is the lightest shape; the ${heavy.name} is the heaviest.`,
    `The ${light.name} weighs ${light.weight}.`,
    revealed?.text ?? `The mystery side is between ${lo} and ${hi}.`,
  ];
}

function isolateFirst(shape: ShapeInfo, random: () => number): { scale: Scale; steps: Step[] } {
  const copies = random() < 0.45 ? 3 : 2;
  const extra = 1 + Math.floor(random() * 3);
  const stacked = copies * shape.weight;

  if (stacked <= 16 && random() < 0.55) {
    return {
      scale: { left: repeatShape(shape.id, copies), right: [mass(stacked)] },
      steps: [
        {
          title: `${cap(shape.name)} = ${shape.weight}`,
          text: `${cap(countPhrase(copies, shape.id))} weigh ${stacked}, so each ${shape.name} is ${stacked} ÷ ${copies} = ${shape.weight}.`,
        },
      ],
    };
  }

  const total = stacked + extra;
  if (total <= 18) {
    return {
      scale: { left: [...repeatShape(shape.id, copies), mass(extra)], right: [mass(total)] },
      steps: [
        {
          title: `${cap(shape.name)} = ${shape.weight}`,
          text: `${cap(countPhrase(copies, shape.id))} and ${anWeight(extra)} balance ${anWeight(total)}. The ${shape.plural} account for ${total} − ${extra} = ${stacked}, so each ${shape.name} is ${shape.weight}.`,
        },
      ],
    };
  }

  return {
    scale: { left: repeatShape(shape.id, 2), right: [mass(2 * shape.weight)] },
    steps: [
      {
        title: `${cap(shape.name)} = ${shape.weight}`,
        text: `Two ${shape.plural} weigh ${2 * shape.weight}, so each ${shape.name} is ${shape.weight}.`,
      },
    ],
  };
}

function introduceShape(
  shape: ShapeInfo,
  known: readonly ShapeInfo[],
  random: () => number,
): { scale: Scale; steps: Step[] } | null {
  const options: { scale: Scale; steps: Step[] }[] = [];
  const k = known[Math.floor(random() * known.length)];

  const push = (scale: Scale, title: string, text: string) => {
    if (!massValuesOk(scale)) return;
    options.push({ scale, steps: [{ title, text }] });
  };

  push(
    { left: [...repeatShape(shape.id, 1), ...repeatShape(k.id, 1)], right: [mass(shape.weight + k.weight)] },
    `${cap(shape.name)} = ${shape.weight}`,
    `A ${shape.name} and a ${k.name} weigh ${shape.weight + k.weight}. The ${k.name} is ${k.weight}, so the ${shape.name} is ${shape.weight + k.weight} − ${k.weight} = ${shape.weight}.`,
  );

  const doubleRest = 2 * shape.weight - k.weight;
  if (doubleRest >= 1) {
    push(
      { left: repeatShape(shape.id, 2), right: [...repeatShape(k.id, 1), mass(doubleRest)] },
      `${cap(shape.name)} = ${shape.weight}`,
      `Two ${shape.plural} balance a ${k.name} and ${anWeight(doubleRest)}. The ${k.name} is ${k.weight}, so two ${shape.plural} weigh ${k.weight + doubleRest}. Each ${shape.name} is ${shape.weight}.`,
    );
  }

  const twoPlus = 2 * shape.weight + k.weight;
  push(
    { left: [...repeatShape(shape.id, 2), ...repeatShape(k.id, 1)], right: [mass(twoPlus)] },
    `${cap(shape.name)} = ${shape.weight}`,
    `Two ${shape.plural} and a ${k.name} weigh ${twoPlus}. Subtract the ${k.name} (${k.weight}) to get ${twoPlus - k.weight}, so each ${shape.name} is ${shape.weight}.`,
  );

  const heavier = shape.weight - k.weight;
  if (heavier >= 1) {
    push(
      { left: repeatShape(shape.id, 1), right: [...repeatShape(k.id, 1), mass(heavier)] },
      `${cap(shape.name)} = ${shape.weight}`,
      `A ${shape.name} balances a ${k.name} and ${anWeight(heavier)}. The ${k.name} is ${k.weight}, so the ${shape.name} is ${k.weight} + ${heavier} = ${shape.weight}.`,
    );
  }

  if (known.length >= 2) {
    const [x, y] = shuffle(known, random).slice(0, 2);
    const triple = shape.weight + x.weight + y.weight;
    push(
      {
        left: [...repeatShape(shape.id, 1), ...repeatShape(x.id, 1), ...repeatShape(y.id, 1)],
        right: [mass(triple)],
      },
      `${cap(shape.name)} = ${shape.weight}`,
      `A ${shape.name}, a ${x.name}, and a ${y.name} weigh ${triple}. Subtract ${x.weight} and ${y.weight} to leave ${shape.weight} for the ${shape.name}.`,
    );
    const rest = x.weight + y.weight - shape.weight;
    if (rest >= 1) {
      push(
        {
          left: [...repeatShape(x.id, 1), ...repeatShape(y.id, 1)],
          right: [...repeatShape(shape.id, 1), mass(rest)],
        },
        `${cap(shape.name)} = ${shape.weight}`,
        `A ${x.name} and a ${y.name} balance a ${shape.name} and ${anWeight(rest)}. The left side is ${x.weight} + ${y.weight} = ${x.weight + y.weight}, so the ${shape.name} is ${x.weight + y.weight} − ${rest} = ${shape.weight}.`,
      );
    }
  }

  if (!options.length) return null;
  return options[Math.floor(random() * options.length)];
}

function pairPattern(
  a: ShapeInfo,
  b: ShapeInfo,
  scales: [Scale, Scale],
  steps: Step[],
): { scales: Scale[]; steps: Step[] } | null {
  if (!scales.every(massValuesOk)) return null;
  return { scales, steps };
}

function buildPair(a: ShapeInfo, b: ShapeInfo, random: () => number): { scales: Scale[]; steps: Step[] } | null {
  const options: { scales: Scale[]; steps: Step[] }[] = [];

  const consider = (left: ShapeInfo, right: ShapeInfo) => {
    const wA = left.weight;
    const wB = right.weight;
    const m1 = wA + wB;
    const m2 = 2 * wA + wB;
    const found = pairPattern(
      left,
      right,
      [
        { left: [...repeatShape(left.id, 1), ...repeatShape(right.id, 1)], right: [mass(m1)] },
        { left: [...repeatShape(left.id, 2), ...repeatShape(right.id, 1)], right: [mass(m2)] },
      ],
      [
        {
          title: 'Read the first two scales together',
          text: `${cap(countPhrase(1, left.id))} and a ${right.name} weigh ${m1}. ${cap(countPhrase(2, left.id))} and a ${right.name} weigh ${m2}. The second scale is the first plus one extra ${left.name}. That extra ${left.name} is ${m2} − ${m1} = ${wA}.`,
        },
        {
          title: `${cap(left.name)} = ${wA}`,
          text: `Put ${wA} back on the first scale: the ${right.name} is ${m1} − ${wA} = ${wB}.`,
        },
        {
          title: `${cap(right.name)} = ${wB}`,
          text: `A ${left.name} weighs ${wA}. On the first scale that leaves ${m1} − ${wA} = ${wB} for the ${right.name}.`,
        },
      ],
    );
    if (found) options.push(found);

    if (2 * wA > wB) {
      const rest = 2 * wA - wB;
      const total = wA + wB;
      const swapped = pairPattern(
        left,
        right,
        [
          { left: repeatShape(left.id, 2), right: [...repeatShape(right.id, 1), mass(rest)] },
          { left: [...repeatShape(left.id, 1), ...repeatShape(right.id, 1)], right: [mass(total)] },
        ],
        [
          {
            title: `Two facts about the ${left.name} and ${right.name}`,
            text: `Two ${left.plural} balance a ${right.name} and ${anWeight(rest)}. A ${left.name} and a ${right.name} weigh ${total}.`,
          },
          {
            title: `${cap(left.name)} = ${wA}`,
            text: `Write x for the ${left.name} and y for the ${right.name}. Then 2x = y + ${rest} and x + y = ${total}. Replace y with 2x − ${rest} in the second equation: x + (2x − ${rest}) = ${total}, so 3x = ${total + rest} and x = ${wA}.`,
          },
          {
            title: `${cap(right.name)} = ${wB}`,
            text: `The second scale now reads: a ${left.name} (${wA}) plus a ${right.name} is ${total}, so the ${right.name} is ${total} − ${wA} = ${wB}.`,
          },
        ],
      );
      if (swapped) options.push(swapped);
    }
  };

  consider(a, b);
  consider(b, a);

  if (!options.length) return null;
  return options[Math.floor(random() * options.length)];
}

function makeQuestion(shapes: readonly ShapeInfo[], random: () => number): { side: Side; answer: number } {
  const typeCount = Math.min(shapes.length, 2 + Math.floor(random() * 2));
  const chosen = shuffle(shapes, random).slice(0, typeCount);
  const tokens: Token[] = [];
  for (const shape of chosen) {
    const copies = 1 + Math.floor(random() * (chosen.length === 1 ? 3 : 2));
    tokens.push(...repeatShape(shape.id, copies));
  }
  if (tokens.length > 4) tokens.splice(4);
  if (tokens.length < 2 && shapes.length > 1) {
    const extra = shapes.find((shape) => shape.id !== (tokens[0] && tokens[0].kind === 'shape' ? tokens[0].shape : undefined));
    if (extra) tokens.push(...repeatShape(extra.id, 1));
  }
  if (tokens.length === 0) tokens.push(...repeatShape(shapes[0].id, 2));
  const lookup = Object.fromEntries(shapes.map((shape) => [shape.id, shape.weight])) as Record<ShapeId, number>;
  return { side: tokens, answer: sideWeight(tokens, lookup) };
}

function acceptPuzzle(puzzle: Puzzle): boolean {
  const ids = puzzle.shapes.map((shape) => shape.id);
  if (new Set(ids).size !== ids.length) return false;
  if (puzzle.shapes.length < 3 || puzzle.shapes.length > 5) return false;
  if (puzzle.scales.length < 2 || puzzle.scales.length > 5) return false;
  if (puzzle.steps.length < 2 || puzzle.hints.length < 3) return false;
  if (puzzle.answer < 1 || puzzle.answer > 40) return false;
  const weights = Object.fromEntries(puzzle.shapes.map((shape) => [shape.id, shape.weight])) as Record<
    ShapeId,
    number
  >;
  const used = new Set(puzzle.shapes.map((shape) => shape.weight));
  if (used.size !== puzzle.shapes.length) return false;
  if (puzzle.shapes.some((shape) => shape.weight < MIN_WEIGHT || shape.weight > MAX_WEIGHT)) return false;
  if (!scalesBalance(puzzle.scales, weights)) return false;
  if (sideWeight(puzzle.question, weights) !== puzzle.answer) return false;
  const solutions = findSolutions(ids, puzzle.scales);
  if (solutions.length !== 1) return false;
  return puzzle.shapes.every((shape) => solutions[0][shape.id] === shape.weight);
}

function fallbackPuzzle(seed: number): Puzzle {
  const shapes: ShapeInfo[] = [
    { id: 'circle', name: 'circle', plural: 'circles', weight: 3 },
    { id: 'triangle', name: 'triangle', plural: 'triangles', weight: 5 },
    { id: 'square', name: 'square', plural: 'squares', weight: 4 },
  ];
  const scales: Scale[] = [
    { left: [...repeatShape('circle', 1), ...repeatShape('triangle', 1)], right: [mass(8)] },
    { left: [...repeatShape('circle', 2), ...repeatShape('triangle', 1)], right: [mass(11)] },
    { left: [...repeatShape('square', 1), ...repeatShape('circle', 1)], right: [mass(7)] },
  ];
  const question = [...repeatShape('square', 1), ...repeatShape('triangle', 1)];
  const steps: Step[] = [
    {
      title: 'Read the first two scales together',
      text: 'A circle and a triangle weigh 8. Two circles and a triangle weigh 11. The extra circle is 11 − 8 = 3.',
    },
    {
      title: 'Circle = 3',
      text: 'Put 3 back on the first scale: the triangle is 8 − 3 = 5.',
    },
    {
      title: 'Square = 4',
      text: 'A square and a circle weigh 7. The circle is 3, so the square is 4.',
    },
    {
      title: 'The mystery side',
      text: `A square and a triangle weigh 4 (square) + 5 (triangle) = 9.`,
    },
  ];
  return {
    id: `cw-fallback-${seed.toString(16)}`,
    shapes,
    scales,
    question,
    answer: 9,
    steps,
    hints: makeHints(shapes, steps, 9),
    blurb: BLURBS[seed % BLURBS.length],
  };
}

function tryStructured(random: () => number, n: number, seed: number, template?: 'pair' | 'isolate'): Puzzle | null {
  const chosen = shuffle(SHAPE_DEFS, random).slice(0, n);
  const pool = range(MIN_WEIGHT, pickMaxWeight(n));
  const weights = shuffle(pool, random).slice(0, n);
  const shapes: ShapeInfo[] = chosen.map((def, index) => ({ ...def, weight: weights[index] }));
  const kind = template ?? (random() < 0.58 ? 'pair' : 'isolate');

  const scales: Scale[] = [];
  const steps: Step[] = [];
  const known: ShapeInfo[] = [];

  if (kind === 'pair' && n >= 2) {
    const pair = buildPair(shapes[0], shapes[1], random);
    if (!pair) return null;
    scales.push(...pair.scales);
    steps.push(...pair.steps);
    known.push(shapes[0], shapes[1]);
    for (let index = 2; index < n; index += 1) {
      const intro = introduceShape(shapes[index], known, random);
      if (!intro) return null;
      scales.push(intro.scale);
      steps.push(...intro.steps);
      known.push(shapes[index]);
    }
  } else {
    for (const shape of shapes) {
      if (known.length === 0) {
        const first = isolateFirst(shape, random);
        scales.push(first.scale);
        steps.push(...first.steps);
        known.push(shape);
        continue;
      }
      const intro = introduceShape(shape, known, random);
      if (!intro) return null;
      scales.push(intro.scale);
      steps.push(...intro.steps);
      known.push(shape);
    }
  }

  if (scales.length > 5) return null;

  const question = makeQuestion(shapes, random);
  steps.push({
    title: 'The mystery side',
    text: `${cap(describeSide(question.side))} weigh ${question.answer}: ${explainSum(question.side, shapes)}.`,
  });

  return {
    id: `cw-${seed.toString(16)}-${puzzleKey(shapes, scales, question.side)}`,
    shapes,
    scales,
    question: question.side,
    answer: question.answer,
    steps,
    hints: makeHints(shapes, steps, question.answer),
    blurb: BLURBS[Math.floor(random() * BLURBS.length)],
  };
}

export function generatePuzzle(seed: number, options: GenerateOptions = {}): Puzzle {
  const random = mulberry32(seed);
  const n = options.shapeCount ?? pickShapeCount(random);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const puzzle = tryStructured(random, n, seed, options.template);
    if (puzzle && acceptPuzzle(puzzle)) return puzzle;
  }
  const fallback = fallbackPuzzle(seed);
  if (!acceptPuzzle(fallback)) {
    throw new Error('Counterweight: fallback puzzle failed validation');
  }
  return fallback;
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  const seed = dateSeed(date);
  if (calendarDayIndex(date) === 0) {
    return generatePuzzle(seed, { shapeCount: 3, template: 'pair' });
  }
  return generatePuzzle(seed);
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000), date = utcDate()): Puzzle {
  const today = dailyPuzzle(date);
  for (let offset = 0; offset < 16; offset += 1) {
    const next = generatePuzzle((seed + offset * 0x9e3779b9) >>> 0);
    if (next.id !== today.id) return next;
  }
  return generatePuzzle((seed + 1) >>> 0);
}

export function puzzleIdentity(puzzle: Puzzle): string {
  return puzzleKey(puzzle.shapes, puzzle.scales, puzzle.question);
}

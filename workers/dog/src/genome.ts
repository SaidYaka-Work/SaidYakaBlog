import type { LifeStage } from './stages';

export type EarShape = 'prick' | 'flop' | 'rose' | 'button';
export type TailType = 'saber' | 'curl' | 'nub' | 'plume';
export type Snout = 'short' | 'medium' | 'long';
export type Build = 'tiny' | 'lean' | 'stocky' | 'long';
export type Pattern = 'solid' | 'spots' | 'patches' | 'saddle' | 'mask';
export type Marking = 'none' | 'blaze' | 'bib' | 'socks' | 'brow';
export type Accessory = 'none' | 'bandana' | 'collar' | 'bow';

export type DogGenome = {
  seed: string;
  body: string;
  ear: string;
  spot: string;
  belly: string;
  eye: string;
  nose: string;
  pattern: Pattern;
  marking: Marking;
  earShape: EarShape;
  earFloppy: number;
  tail: TailType;
  snout: Snout;
  build: Build;
  accessory: Accessory;
  accessoryColor: string;
};

export const BISCUIT_SEED = 'biscuit-porch-1';
export const BISCUIT_PERSONALITY =
  'Thinks the whole internet is a front porch, and every visitor is a neighbor.';

const PALETTES = [
  { body: '#f0d8c8', ear: '#b4532a', spot: '#e8a87c', belly: '#fff4ea', nose: '#16120f' },
  { body: '#2a2420', ear: '#16120f', spot: '#6d675e', belly: '#4a453f', nose: '#111010' },
  { body: '#c46a3a', ear: '#7a3418', spot: '#e8a87c', belly: '#f0d8c8', nose: '#2a1810' },
  { body: '#8a8378', ear: '#4a453f', spot: '#c4b8a8', belly: '#ddd6cc', nose: '#2a2420' },
  { body: '#d4a574', ear: '#8a5a32', spot: '#f0d8c8', belly: '#f7ead8', nose: '#3d2218' },
  { body: '#7a4630', ear: '#3d2218', spot: '#c48a64', belly: '#e8c4a8', nose: '#1a100c' },
  { body: '#f3eee6', ear: '#c4b8a8', spot: '#e8a87c', belly: '#fffaf3', nose: '#c48a64' },
  { body: '#3d4a3a', ear: '#1f2a1c', spot: '#8a9a78', belly: '#c4d0b4', nose: '#16120f' },
  { body: '#6b3a4a', ear: '#3d1f2a', spot: '#c48a9a', belly: '#f0d8de', nose: '#241018' },
  { body: '#4a5a6b', ear: '#2a3440', spot: '#a8b8c4', belly: '#dce4ea', nose: '#161820' },
];

const EYES = ['#16120f', '#3d2218', '#5a3a12', '#2a4a3a', '#4a5a6b', '#7a4630', '#8a5a32'];
const ACCESSORY_COLORS = ['#c46a3a', '#2a4a3a', '#4a5a6b', '#7a3418', '#e8a87c', '#3d1f2a', '#16120f'];

const PERSONALITIES = [
  'Thinks every visitor came over just to sit on the floor.',
  'Collects interesting smells and forgives everyone eventually.',
  'Believes the leash is a diplomatic treaty.',
  'Sleeps in commas and wakes in exclamation points.',
  'Keeps a quiet watch on the dark porch.',
  'Treats tennis balls as a renewable resource.',
  'Judges your posture, then leans on your shin anyway.',
  'Convinced dinner is a civil right.',
  'Would follow a paper bag into traffic, politely.',
  'Holds court on the cream rug.',
  'Takes nap negotiations very seriously.',
  'Sure that every stranger is a cousin.',
  'Practices looking heroic in reflections.',
  'Knows three tricks and pretends there are more.',
  'Writes essays with their eyebrows.',
  'Always ready for a block-long expedition.',
  'Saves the last warm patch of sun for later.',
  'Thinks thunder is a rumor.',
  'Greets the mailbox like an old friend.',
  'Has opinions about socks.',
  'Would like to discuss the concept of “off the couch.”',
  'Keeps secrets in the ruff of their neck.',
  'Believes fetch is a conversation.',
  'Dramatic about crumbs and vain about ears.',
  'Low to the ground, high on opinions.',
  'Quiet collector of shadows.',
  'Wakes up already mid-adventure.',
  'Thinks every closed door is a riddle.',
  'Would like one more loop around the block.',
  'Practices patience, badly.',
];

export function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number) {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]) {
  return items[Math.floor(rng() * items.length)] ?? items[0];
}

function jitter(rng: () => number, hex: string, amount = 12) {
  const n = parseInt(hex.slice(1), 16);
  const shift = (value: number) => {
    const next = value + Math.floor((rng() - 0.5) * amount * 2);
    return Math.max(0, Math.min(255, next));
  };
  const r = shift((n >> 16) & 255);
  const g = shift((n >> 8) & 255);
  const b = shift(n & 255);
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function generateGenome(seed: string): DogGenome {
  const rng = mulberry32(hashSeed(seed));
  const palette = pick(rng, PALETTES);
  const patterns: Pattern[] = ['solid', 'spots', 'patches', 'saddle', 'mask'];
  const markings: Marking[] = ['none', 'blaze', 'bib', 'socks', 'brow'];
  const ears: EarShape[] = ['prick', 'flop', 'rose', 'button'];
  const tails: TailType[] = ['saber', 'curl', 'nub', 'plume'];
  const snouts: Snout[] = ['short', 'medium', 'long'];
  const builds: Build[] = ['tiny', 'lean', 'stocky', 'long'];
  const accessories: Accessory[] = ['none', 'none', 'bandana', 'collar', 'bow'];
  return {
    seed,
    body: jitter(rng, palette.body),
    ear: jitter(rng, palette.ear),
    spot: jitter(rng, palette.spot),
    belly: jitter(rng, palette.belly, 8),
    eye: pick(rng, EYES),
    nose: jitter(rng, palette.nose, 6),
    pattern: pick(rng, patterns),
    marking: pick(rng, markings),
    earShape: pick(rng, ears),
    earFloppy: Math.round(rng() * 100) / 100,
    tail: pick(rng, tails),
    snout: pick(rng, snouts),
    build: pick(rng, builds),
    accessory: pick(rng, accessories),
    accessoryColor: pick(rng, ACCESSORY_COLORS),
  };
}

export function generatePersonality(seed: string) {
  const rng = mulberry32(hashSeed(`${seed}:voice`));
  return pick(rng, PERSONALITIES);
}

export function lookFromGenome(genome: DogGenome, stage: LifeStage) {
  const stageScale = { puppy: 0.72, young: 0.88, adult: 1, senior: 1.04 }[stage];
  const buildScale = { tiny: 0.86, lean: 0.94, stocky: 1.1, long: 1.04 }[genome.build];
  const bodyRx = genome.build === 'long' ? 70 : genome.build === 'stocky' ? 66 : 62;
  const bodyRy = genome.build === 'tiny' ? 32 : genome.build === 'stocky' ? 42 : 38;
  const headRx = genome.snout === 'short' ? 32 : genome.snout === 'long' ? 40 : 36;
  const headRy = genome.snout === 'short' ? 30 : 32;
  const muzzle = genome.snout === 'long' ? 9 : genome.snout === 'short' ? 4 : 5;
  return {
    stageScale,
    buildScale,
    scale: Math.round(stageScale * buildScale * 1000) / 1000,
    bodyRx,
    bodyRy,
    headRx,
    headRy,
    muzzle,
    earFloppy: genome.earFloppy,
  };
}

export function genomesEqual(a: DogGenome, b: DogGenome) {
  return JSON.stringify(a) === JSON.stringify(b);
}

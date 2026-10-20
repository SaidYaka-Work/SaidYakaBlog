import { hashSeed, mulberry32, type DogGenome, type LifeStage } from '@/lib/dog';

export type SkyMood = 'dawn' | 'day' | 'dusk' | 'night';
export type IdlePose = 'sit' | 'lie' | 'stretch' | 'scratch' | 'yawn' | 'look';
export type PortraitReaction = 'idle' | 'pet' | 'walk' | 'feed' | 'sleep';

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function hexToRgb(hex: string) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw;
  const n = parseInt(full.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function mixHex(a: string, b: string, t: number) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return rgbToHex(
    left.r + (right.r - left.r) * t,
    left.g + (right.g - left.g) * t,
    left.b + (right.b - left.b) * t,
  );
}

export function shadeHex(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const lift = (value: number) => value + amount * (amount > 0 ? 255 - value : value);
  return rgbToHex(lift(r), lift(g), lift(b));
}

export type CoatExtras = {
  fluff: number;
  ruff: boolean;
  cheekTuft: boolean;
  sparkle: number;
};

export function extrasFromGenome(genome: DogGenome): CoatExtras {
  const rng = mulberry32(hashSeed(`${genome.seed}:coat`));
  return {
    fluff: Math.round(rng() * 100) / 100,
    ruff: rng() > 0.42,
    cheekTuft: rng() > 0.5,
    sparkle: Math.round(rng() * 100) / 100,
  };
}

export function stageLook(stage: LifeStage) {
  return {
    puppy: { head: 1.18, eye: 1.28, leg: 0.78, body: 0.86, droop: 0 },
    young: { head: 1.06, eye: 1.1, leg: 0.94, body: 0.94, droop: 0 },
    adult: { head: 1, eye: 1, leg: 1, body: 1, droop: 0 },
    senior: { head: 0.98, eye: 0.92, leg: 0.96, body: 1.04, droop: 1 },
  }[stage];
}

export function buildLook(build: DogGenome['build']) {
  return {
    tiny: { bodyX: 0.86, bodyY: 0.9, length: 0.92 },
    lean: { bodyX: 0.9, bodyY: 0.86, length: 1.04 },
    stocky: { bodyX: 1.12, bodyY: 1.1, length: 0.96 },
    long: { bodyX: 0.96, bodyY: 0.92, length: 1.12 },
  }[build];
}

export function snoutLook(snout: DogGenome['snout']) {
  return {
    short: { length: 16, drop: 6 },
    medium: { length: 24, drop: 8 },
    long: { length: 34, drop: 9 },
  }[snout];
}

export function localSky(now = Date.now()): SkyMood {
  const hour = new Date(now).getHours();
  if (hour < 6 || hour >= 21) return 'night';
  if (hour < 8) return 'dawn';
  if (hour >= 18) return 'dusk';
  return 'day';
}

export function wagMs(happiness: number, asleep: boolean, sad: boolean) {
  if (asleep) return 2400;
  if (sad) return 1600;
  if (happiness >= 84) return 280;
  if (happiness >= 60) return 420;
  return 700;
}

export function reactionFromEvent(text: string): PortraitReaction | null {
  const line = text.toLowerCase();
  if (line.includes('petted') || line.includes('scratched')) return 'pet';
  if (line.includes('fed') || line.includes('dinner')) return 'feed';
  if (line.includes('walk') || line.includes('sniff')) return 'walk';
  if (line.includes('curled') || line.includes('flopped') || line.includes('nap')) return 'sleep';
  return null;
}

export function palette(genome: DogGenome) {
  const outline = mixHex(shadeHex(genome.body, -0.55), '#16120f', 0.35);
  return {
    body: genome.body,
    bodyDeep: shadeHex(genome.body, -0.18),
    bodyLite: shadeHex(genome.body, 0.16),
    ear: genome.ear,
    earDeep: shadeHex(genome.ear, -0.2),
    spot: genome.spot,
    belly: genome.belly,
    eye: genome.eye,
    nose: genome.nose,
    outline,
    grey: mixHex(genome.belly, '#c4b8a8', 0.55),
    accessory: genome.accessoryColor,
  };
}

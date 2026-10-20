import { hashSeed, mulberry32, type DogGenome, type LifeStage } from '@/lib/dog';

export type SkyMood = 'dawn' | 'day' | 'dusk' | 'night';
export type IdlePose = 'sit' | 'lie' | 'stretch' | 'scratch' | 'yawn' | 'look';
export type PortraitReaction = 'idle' | 'pet' | 'walk' | 'feed' | 'sleep';
export type FurType = 'smooth' | 'fluffy';

export type CoatKind =
  | 'cream'
  | 'golden'
  | 'red'
  | 'tan'
  | 'chocolate'
  | 'blacktan'
  | 'merle'
  | 'whitepatch'
  | 'brindle';

const COAT_KIND_LIST: CoatKind[] = [
  'cream',
  'golden',
  'red',
  'tan',
  'chocolate',
  'blacktan',
  'merle',
  'whitepatch',
  'brindle',
];

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

const COATS: Record<CoatKind, { body: string; ear: string; belly: string; spot: string; nose: string; tan: string }> = {
  cream: { body: '#f3d2b3', ear: '#c47a3a', belly: '#fff6ea', spot: '#e8a87c', nose: '#3d2218', tan: '#e8c4a0' },
  golden: { body: '#e0a04a', ear: '#b4532a', belly: '#f7e6c4', spot: '#c46a3a', nose: '#2a1810', tan: '#e8b86a' },
  red: { body: '#c46a3a', ear: '#7a3418', belly: '#f0d8c8', spot: '#8a3a18', nose: '#241010', tan: '#e8a87c' },
  tan: { body: '#d4a574', ear: '#8a5a32', belly: '#f7ead8', spot: '#b4532a', nose: '#3d2218', tan: '#e8c4a0' },
  chocolate: { body: '#7a4024', ear: '#4a2414', belly: '#f3d4bc', spot: '#5a2a16', nose: '#1a100c', tan: '#d4a574' },
  blacktan: { body: '#2c241c', ear: '#1a1410', belly: '#e8b86a', spot: '#d4a05a', nose: '#0e0c0a', tan: '#e0a04a' },
  merle: { body: '#9aa8b6', ear: '#4a5564', belly: '#f4f6f8', spot: '#2e3846', nose: '#1a1c22', tan: '#d4c8bc' },
  whitepatch: { body: '#f7f1e6', ear: '#c46a3a', belly: '#fffaf3', spot: '#2a2420', nose: '#c48a64', tan: '#e8a87c' },
  brindle: { body: '#b07848', ear: '#5a3218', belly: '#f3e0cc', spot: '#2a1810', nose: '#16120f', tan: '#d4a574' },
};

export function coatKindFromGenome(genome: DogGenome): CoatKind {
  if (genome.seed === 'biscuit-porch-1') return 'golden';
  const rng = mulberry32(hashSeed(`${genome.seed}:coat-kind-v2`));
  const { r, g, b } = hexToRgb(genome.body);
  const lum = (r * 2 + g * 3 + b) / 6;
  const warm = r - b;
  const pick = (items: CoatKind[]) => items[Math.floor(rng() * items.length)] ?? items[0];
  if (lum > 205) return pick(['cream', 'whitepatch', 'golden']);
  if (lum > 168) return pick(warm > 12 ? ['golden', 'tan', 'cream', 'red'] : ['cream', 'tan', 'merle']);
  if (lum > 118) return pick(warm > 8 ? ['red', 'tan', 'brindle', 'chocolate'] : ['brindle', 'tan', 'merle']);
  return pick(['blacktan', 'chocolate', 'merle', 'brindle']);
}

export type CoatExtras = {
  fluff: number;
  ruff: boolean;
  fur: FurType;
  kind: CoatKind;
};

export function extrasFromGenome(genome: DogGenome): CoatExtras {
  const rng = mulberry32(hashSeed(`${genome.seed}:coat`));
  const fluff = Math.round(rng() * 100) / 100;
  return {
    fluff,
    ruff: rng() > 0.4,
    fur: fluff > 0.55 || genome.tail === 'plume' ? 'fluffy' : 'smooth',
    kind: coatKindFromGenome(genome),
  };
}

export function stageLook(stage: LifeStage) {
  return {
    puppy: { head: 1.34, eye: 1.48, leg: 0.66, paw: 1.38, muzzle: 0.62, body: 0.82, droop: 0, tilt: -4 },
    young: { head: 1.04, eye: 1.1, leg: 1.2, paw: 0.94, muzzle: 0.92, body: 0.88, droop: 0, tilt: -1 },
    adult: { head: 1, eye: 1, leg: 1, paw: 1, muzzle: 1, body: 1, droop: 0, tilt: 0 },
    senior: { head: 0.98, eye: 0.86, leg: 0.88, paw: 1.04, muzzle: 1, body: 1.04, droop: 1, tilt: 10 },
  }[stage];
}

export function buildLook(build: DogGenome['build']) {
  return {
    tiny: { chest: 0.86, haunch: 0.88, length: 0.88, leg: 0.82 },
    lean: { chest: 0.84, haunch: 0.86, length: 1.12, leg: 1.16 },
    stocky: { chest: 1.16, haunch: 1.18, length: 0.92, leg: 0.86 },
    long: { chest: 0.92, haunch: 0.94, length: 1.2, leg: 1.08 },
  }[build];
}

export function snoutLook(snout: DogGenome['snout'], stageMuzzle = 1) {
  return Math.round({ short: 30, medium: 48, long: 64 }[snout] * stageMuzzle);
}

export function localSky(now = Date.now()): SkyMood {
  const hour = new Date(now).getHours();
  if (hour < 6 || hour >= 21) return 'night';
  if (hour < 8) return 'dawn';
  if (hour >= 18) return 'dusk';
  return 'day';
}

export function wagMs(happiness: number, asleep: boolean, sad: boolean) {
  if (asleep) return 2800;
  if (sad) return 1500;
  if (happiness >= 84) return 220;
  if (happiness >= 60) return 360;
  return 620;
}

export function reactionFromEvent(text: string): PortraitReaction | null {
  const line = text.toLowerCase();
  if (line.includes('petted') || line.includes('scratched')) return 'pet';
  if (line.includes('fed') || line.includes('dinner')) return 'feed';
  if (line.includes('walk') || line.includes('sniff')) return 'walk';
  if (line.includes('curled') || line.includes('flopped') || line.includes('nap')) return 'sleep';
  return null;
}

export function formatNeed(ms: number, overdue: boolean) {
  if (overdue && Math.abs(ms) < 60_000) return 'Due now';
  if (!overdue && Math.abs(ms) < 30_000) return 'Due now';
  if (overdue) return `Overdue ${formatNeedClock(ms)}`;
  return `In ${formatNeedClock(ms)}`;
}

function formatNeedClock(ms: number) {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function palette(genome: DogGenome) {
  const extras = extrasFromGenome(genome);
  const coat = COATS[extras.kind];
  const outline = mixHex(shadeHex(coat.body, extras.kind === 'blacktan' ? 0.08 : -0.42), '#2a1810', extras.kind === 'blacktan' ? 0.15 : 0.38);
  const eye =
    extras.kind === 'merle'
      ? '#4a5a6b'
      : extras.kind === 'cream' || extras.kind === 'golden'
        ? '#5a3a12'
        : extras.kind === 'blacktan'
          ? '#1a120c'
          : '#2a1810';
  return {
    kind: extras.kind,
    body: coat.body,
    bodyDeep: shadeHex(coat.body, extras.kind === 'blacktan' ? 0.12 : -0.2),
    bodyLite: shadeHex(coat.body, extras.kind === 'blacktan' ? 0.28 : 0.24),
    ear: coat.ear,
    earDeep: shadeHex(coat.ear, -0.16),
    earIn: mixHex(coat.ear, '#f0d8c8', 0.38),
    spot: coat.spot,
    belly: coat.belly,
    eye,
    nose: coat.nose,
    tan: coat.tan,
    outline,
    grey: '#c8c0b6',
    accessory: genome.accessoryColor === '#16120f' ? '#c46a3a' : genome.accessoryColor,
    rim: extras.kind === 'blacktan' ? '#6a5a48' : shadeHex(coat.body, 0.48),
  };
}

export { COAT_KIND_LIST };

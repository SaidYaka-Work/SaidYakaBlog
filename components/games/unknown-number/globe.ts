import type { Birthplace } from './types';

export const GLOBE_STEPS = [
  { id: 'world', label: 'World', scale: 148, hintDeg: 86, pull: 0 },
  { id: 'continent', label: 'Continent', scale: 252, hintDeg: 26, pull: 0.74 },
  { id: 'subregion', label: 'Subregion', scale: 400, hintDeg: 18, pull: 0.88 },
  { id: 'country', label: 'Country', scale: 640, hintDeg: 8.5, pull: 0.96 },
  { id: 'region', label: 'Region', scale: 1020, hintDeg: 3.4, pull: 1 },
  { id: 'city', label: 'City', scale: 1640, hintDeg: 1.05, pull: 1 },
] as const;

export type GlobeStepId = (typeof GLOBE_STEPS)[number]['id'];

const REST_ROTATE: [number, number] = [18, -12];

export function globeStepIndex(wrongGuesses: number): number {
  return Math.max(0, Math.min(GLOBE_STEPS.length - 1, Math.floor(wrongGuesses)));
}

export function globeStepId(wrongGuesses: number): GlobeStepId {
  return GLOBE_STEPS[globeStepIndex(wrongGuesses)].id;
}

export type GlobeView = {
  index: number;
  id: GlobeStepId;
  label: string;
  scale: number;
  hintDeg: number;
  rotate: [number, number];
  showHint: boolean;
  showPin: boolean;
};

export function globeView(wrongGuesses: number, birth: Birthplace, revealed: boolean): GlobeView {
  const index = revealed ? GLOBE_STEPS.length - 1 : globeStepIndex(wrongGuesses);
  const spec = GLOBE_STEPS[index];
  const target: [number, number] = [-birth.lng, -birth.lat];
  const pull = revealed ? 1 : spec.pull;
  return {
    index,
    id: spec.id,
    label: spec.label,
    scale: spec.scale,
    hintDeg: revealed ? 0.28 : spec.hintDeg,
    rotate: [
      REST_ROTATE[0] + (target[0] - REST_ROTATE[0]) * pull,
      REST_ROTATE[1] + (target[1] - REST_ROTATE[1]) * pull,
    ],
    showHint: !revealed && index > 0,
    showPin: revealed,
  };
}

export function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

export function shortestLng(from: number, to: number) {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return from + delta;
}

export function lerpLng(from: number, to: number, t: number) {
  return lerp(from, shortestLng(from, to), t);
}

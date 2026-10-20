import type { DogGenome } from '../workers/dog/src/genome';

export type { DogGenome } from '../workers/dog/src/genome';
export { BISCUIT_SEED, generateGenome, hashSeed, lookFromGenome, mulberry32 } from '../workers/dog/src/genome';
export { DOG_NAMES, nameById, suggestNames, recentNameIds } from '../workers/dog/src/names';
export type { DogName } from '../workers/dog/src/names';

/**
 * Live Cloudflare Worker origin for the shared dog.
 *
 * After `npx wrangler deploy` from `workers/dog`, paste the printed
 * `https://saidyaka-dog.<subdomain>.workers.dev` URL here (no trailing slash).
 * `NEXT_PUBLIC_DOG_WORKER_URL` overrides this at build time if set.
 */
export const PRODUCTION_DOG_WORKER_URL = 'https://saidyaka-dog.saidyaka.workers.dev';

export function dogWorkerUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_DOG_WORKER_URL?.trim();
  return (fromEnv || PRODUCTION_DOG_WORKER_URL).replace(/\/$/, '');
}

export function dogWsUrl() {
  const http = dogWorkerUrl();
  if (!http) return '';
  const url = new URL('/ws', http);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export type DogProfile = {
  id: string;
  name: string;
  personality: string;
};

export type Totals = {
  pets: number;
  walks: number;
  feeds: number;
  miles: number;
};

export type Activity = {
  at: number;
  action: string;
  text: string;
};

export type LifeStage = 'puppy' | 'young' | 'adult' | 'senior';

export type CareView = {
  nextFeedInMs: number;
  nextWalkInMs: number;
  feedOverdue: boolean;
  walkOverdue: boolean;
  hunger: number;
  walkNeed: number;
  runawayInMs: number | null;
  warning: string | null;
  walkHint: string;
  mealHint: string;
  ageNote: string;
  walkCaption: string;
  walkGameMs: number;
  walkSpeed: number;
  walkSpawnMs: number;
  walkRockChance: number;
  feedDrops: number;
};

export type PublicDog = {
  profile: DogProfile;
  happiness: number;
  energy: number;
  affection: number;
  fullness: number;
  asleep: boolean;
  night: boolean;
  mood: string;
  totals: Totals;
  activity: Activity[];
  arrivedAt: number;
  ageHours: number;
  ageDays: number;
  stage: LifeStage;
  stageLabel: string;
  biologicalDays: number;
  care: CareView;
  genome: DogGenome;
  namedByCatcher: boolean;
};

export type Memorial = {
  id: string;
  profile: DogProfile;
  caughtAt: number;
  leftAt: number | null;
  daysSurvived: number;
  furthestStage: LifeStage;
  totals: Totals;
  peakHappiness: number;
  departed: 'home' | 'ran_away';
  genome: DogGenome;
  namedByCatcher: boolean;
};

export type HistoryPage = {
  dogs: Memorial[];
  total: number;
  offset: number;
  limit: number;
  leaders: {
    longestLived: Memorial | null;
    mostWalked: Memorial | null;
    mostPets: Memorial | null;
  };
};

export type DogSnapshot = {
  type: 'state';
  dog: PublicDog | null;
  presence: number;
  awaitingCatch: boolean;
  awaitingName: boolean;
  nameUntil: number | null;
  usedNameIds: string[];
  memorial: Memorial | null;
  history: Memorial[];
};

export function stageWord(stage: LifeStage) {
  return { puppy: 'puppyhood', young: 'youth', adult: 'adulthood', senior: 'his senior years' }[stage];
}

export function formatCountdown(ms: number) {
  const abs = Math.abs(ms);
  const minutes = Math.max(0, Math.round(abs / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

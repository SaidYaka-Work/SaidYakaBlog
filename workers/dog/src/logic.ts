import {
  BISCUIT_PERSONALITY,
  BISCUIT_SEED,
  generateGenome,
  generatePersonality,
  type DogGenome,
} from './genome';
import { nameById, pickName, recentNameIds } from './names';
import {
  CARE_BY_STAGE,
  careFor,
  furthestStage,
  growthRate,
  stageFromAge,
  type LifeStage,
} from './stages';
import {
  createYard,
  fillFeeder,
  markWalkCredited,
  migrateYard,
  nearFeeder,
  placeFeeder,
  publicFeeder,
  publicLeash,
  publicPose,
  releaseLeash,
  startEating,
  tryAcquireLeash,
  walkCreditPending,
  WALK_CREDIT_M,
  type YardState,
} from './room';
import {
  applyHomeOrWorldDrive,
  applyTravel,
  migrateLocation,
  publicLocation,
  settleWorldYard,
  tickWorldAi,
  type PublicLocation,
} from './world';
import {
  applyEmote,
  applyHere,
  dropCompanion,
  isEmote,
  pruneCompanions,
  publicCompanions,
  seatCompanion,
  type Companion,
  type EmoteKind,
  type PublicCompanion,
} from './presence';

export {
  applyEmote,
  applyHere,
  dropCompanion,
  isEmote,
  pruneCompanions,
  publicCompanions,
  seatCompanion,
  takeEmoteRate,
  COMPANION_RADIUS,
  EMOTE_GAP_MS,
  EMOTE_MAX_PER_WINDOW,
  EMOTES,
  HERE_GAP_MS,
  type Companion,
  type EmoteBucket,
  type EmoteKind,
  type PublicCompanion,
} from './presence';
export {
  CARE_BY_STAGE,
  careFor,
  dailyMeals,
  dailyWalkGameMs,
  stageFromAge,
  STAGE_AT_MS,
  STAGES,
  type LifeStage,
  type StageCare,
} from './stages';
export {
  BISCUIT_PERSONALITY,
  BISCUIT_SEED,
  generateGenome,
  generatePersonality,
  lookFromGenome,
  type DogGenome,
} from './genome';
export { DOG_NAMES, nameById, pickName, suggestNames, type DogName } from './names';

export const ACTIONS = ['pet', 'feed', 'walk', 'catch'] as const;

export type ErrorCode =
  | 'invalid'
  | 'rate_limited'
  | 'cooldown'
  | 'asleep'
  | 'too_tired'
  | 'full'
  | 'busy'
  | 'not_needed'
  | 'gone'
  | 'home'
  | 'too_soon'
  | 'missed'
  | 'not_catcher'
  | 'too_late'
  | 'named'
  | 'too_far';

export type CareGame = 'feed' | 'walk' | 'catch';

export type Activity = {
  at: number;
  action: 'pet' | 'feed' | 'walk' | 'sleep' | 'wake' | 'runaway' | 'catch' | 'system';
  text: string;
};

export type DogProfile = {
  id: string;
  name: string;
  personality: string;
};

export const BISCUIT_PROFILE: DogProfile = {
  id: 'biscuit',
  name: 'Biscuit',
  personality: BISCUIT_PERSONALITY,
};

export const PROFILES: DogProfile[] = [BISCUIT_PROFILE];

export const FEED_EVERY_MS = CARE_BY_STAGE.puppy.feedEveryMs;
export const WALK_EVERY_MS = CARE_BY_STAGE.puppy.walkEveryMs;
export const FEED_MIN_GAP_MS = CARE_BY_STAGE.puppy.feedMinGapMs;
export const WALK_MIN_GAP_MS = CARE_BY_STAGE.puppy.walkMinGapMs;
export const PET_COOLDOWN_MS = 4_000;
export const CATCH_COOLDOWN_MS = 12_000;
export const LOW_HAPPINESS = 25;
export const RUNAWAY_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
export const CONNECTION_GAP_MS = 1_200;
export const IP_WINDOW_MS = 60_000;
export const IP_MAX_ACTIONS = 20;
export const MAX_CONNECTIONS = 80;
export const MAX_ACTIVITY = 16;
export const MAX_HISTORY = 500;
export const HISTORY_PAGE = 12;
export const DECAY_ALARM_MS = 60_000;

export const FEED_GAME = { minMs: 4_000, maxMs: 40_000 };
export const WALK_GAME = { minMs: 4_000, maxMs: 60_000 };
export const CATCH_GAME = { minMs: 6_000, maxMs: 45_000 };
export const CATCH_MIN_SCORE = 35;
export const NAME_WINDOW_MS = 60_000;
export const RECENT_NAME_AVOID = 24;

export type Totals = {
  pets: number;
  walks: number;
  feeds: number;
  miles: number;
};

export type LivingDog = {
  id: string;
  profile: DogProfile;
  happiness: number;
  energy: number;
  affection: number;
  lastFedAt: number;
  lastWalkedAt: number;
  lastPettedAt: number;
  lastDecayAt: number;
  lowSince: number | null;
  asleep: boolean;
  totals: Totals;
  arrivedAt: number;
  biologicalAgeMs: number;
  peakHappiness: number;
  furthestStage: LifeStage;
  activity: Activity[];
  genome: DogGenome;
  namedByCatcher: boolean;
};

export type DogRecord = {
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

/** Hall of Dogs row. Phase 4 can add stamps/collectibles/tricks here per past dog. */
export type Memorial = DogRecord;

export type PendingName = {
  token: string;
  until: number;
};

export type RoomState = {
  dog: LivingDog | null;
  memorial: Memorial | null;
  history: Memorial[];
  lastCatchAt: number;
  pendingName: PendingName | null;
  yard?: YardState;
  /** Absent on older rooms. Live visitors near Biscuit. */
  companions?: Record<string, Companion>;
};

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

export type PublicPose = {
  x: number;
  z: number;
  yaw: number;
  gait: YardState['pose']['gait'];
};

export type PublicLeash = {
  held: boolean;
  holderId: string | null;
  queue?: string[];
  nextId?: string | null;
};

export type PublicFeeder = {
  hasFood: boolean;
  eating: boolean;
  near: boolean;
  x?: number;
  z?: number;
};

export type PublicSnapshot = {
  type: 'state';
  dog: PublicDog | null;
  presence: number;
  awaitingCatch: boolean;
  awaitingName: boolean;
  nameUntil: number | null;
  usedNameIds: string[];
  memorial: Memorial | null;
  history: Memorial[];
  pose?: PublicPose;
  leash?: PublicLeash;
  feeder?: PublicFeeder;
  /** Absent on older Workers. Later phases add optional companions, weather, stamps — never required fields. */
  location?: PublicLocation;
  companions?: PublicCompanion[];
};

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function isNight(now: number) {
  const hour = new Date(now).getUTCHours();
  return hour >= 2 && hour < 10;
}

export function isBiscuitProfile(profile: Pick<DogProfile, 'id' | 'name'>) {
  return profile.id === 'biscuit' || profile.name === 'Biscuit';
}

export function displayName(dog: Pick<LivingDog, 'profile'>) {
  return dog.profile.name || 'the new dog';
}

export function createDog(profile: DogProfile, now: number, id = `dog-${now}`): LivingDog {
  const biscuit = isBiscuitProfile(profile);
  const genome = generateGenome(biscuit ? BISCUIT_SEED : id);
  const personality = biscuit ? BISCUIT_PERSONALITY : profile.personality || generatePersonality(id);
  return {
    id,
    profile: { ...profile, personality },
    happiness: 76,
    energy: 70,
    affection: 48,
    lastFedAt: now,
    lastWalkedAt: now,
    lastPettedAt: 0,
    lastDecayAt: now,
    lowSince: null,
    asleep: isNight(now),
    totals: { pets: 0, walks: 0, feeds: 0, miles: 0 },
    arrivedAt: now,
    biologicalAgeMs: 0,
    peakHappiness: 76,
    furthestStage: 'puppy',
    genome,
    namedByCatcher: false,
    activity: [
      {
        at: now,
        action: 'system',
        text: biscuit
          ? `${profile.name} claimed the cream rug as a puppy. The internet is a porch now.`
          : profile.name
            ? `${profile.name} claimed the cream rug as a puppy.`
            : 'A new dog was caught. Waiting for a name.',
      },
    ],
  };
}

export function createRoom(now: number): RoomState {
  return {
    dog: createDog(BISCUIT_PROFILE, now, 'biscuit'),
    memorial: null,
    history: [],
    lastCatchAt: 0,
    pendingName: null,
    yard: createYard(now),
    companions: {},
  };
}

function withGenome<T extends { id: string; profile: DogProfile; genome?: DogGenome; namedByCatcher?: boolean }>(
  record: T,
): T & { genome: DogGenome; namedByCatcher: boolean } {
  if (record.genome) {
    return { ...record, namedByCatcher: record.namedByCatcher ?? false };
  }
  const seed = isBiscuitProfile(record.profile) ? BISCUIT_SEED : record.id;
  return {
    ...record,
    genome: generateGenome(seed),
    namedByCatcher: record.namedByCatcher ?? false,
    profile: {
      id: record.profile.id,
      name: record.profile.name,
      personality: isBiscuitProfile(record.profile)
        ? BISCUIT_PERSONALITY
        : record.profile.personality || generatePersonality(seed),
    },
  };
}

export function migrateRoom(room: RoomState, now = Date.now()): RoomState {
  return {
    ...room,
    pendingName: room.pendingName ?? null,
    dog: room.dog ? withGenome(room.dog) : null,
    memorial: room.memorial ? withGenome(room.memorial) : null,
    history: room.history.map((record) => withGenome(record)),
    yard: settleWorldYard(migrateYard(room.yard, now), now),
    companions: room.companions ?? {},
  };
}

function withLocation(yard: YardState, now: number): YardState {
  return settleWorldYard(yard, now);
}

export function usedNameIds(room: RoomState) {
  const current = room.dog ? [{ id: room.dog.profile.id, name: room.dog.profile.name }] : [];
  return recentNameIds(
    [...current, ...room.history.map((record) => ({ id: record.profile.id, name: record.profile.name }))],
    RECENT_NAME_AVOID,
  );
}

function finishNaming(
  room: RoomState,
  name: { id: string; label: string },
  now: number,
  byCatcher: boolean,
): RoomState {
  if (!room.dog) return { ...room, pendingName: null };
  const dog = room.dog;
  const next: LivingDog = {
    ...dog,
    profile: { ...dog.profile, id: name.id, name: name.label },
    namedByCatcher: byCatcher,
  };
  const event: Activity = {
    at: now,
    action: 'system',
    text: byCatcher
      ? `The catcher named him ${name.label}. ${name.label} claimed the cream rug as a puppy.`
      : `The porch settled on ${name.label}. ${name.label} claimed the cream rug as a puppy.`,
  };
  next.activity = pushActivity(dog.activity, event);
  return { ...room, dog: next, pendingName: null };
}

export function resolvePendingName(room: RoomState, now: number, rng: () => number = Math.random): RoomState {
  if (!room.pendingName || !room.dog) return room;
  if (now < room.pendingName.until) return room;
  return finishNaming(room, pickName(rng, usedNameIds(room)), now, false);
}

export function applyName(
  room: RoomState,
  nameId: string,
  token: string | null | undefined,
  now: number,
  rng: () => number = Math.random,
): { ok: true; room: RoomState; event: Activity } | ActionFail {
  const pending = migrateRoom(room).pendingName;
  const current = resolvePendingName(migrateRoom(room), now, rng);
  if (!current.dog) return { ok: false, code: 'gone', room: current };
  if (!current.pendingName) {
    if (pending && now >= pending.until) return { ok: false, code: 'too_late', room: current };
    return { ok: false, code: current.dog.profile.name ? 'named' : 'too_late', room: current };
  }
  if (!token || token !== current.pendingName.token) {
    return { ok: false, code: 'not_catcher', room: current };
  }
  if (now >= current.pendingName.until) {
    const named = resolvePendingName(current, now, rng);
    return { ok: false, code: 'too_late', room: named };
  }
  const picked = nameById(nameId);
  if (!picked) return { ok: false, code: 'invalid', room: current };
  if (usedNameIds(current).includes(picked.id)) return { ok: false, code: 'invalid', room: current };
  const next = finishNaming(current, picked, now, true);
  const event = next.dog?.activity[0] ?? { at: now, action: 'system' as const, text: `${picked.label} is home.` };
  return { ok: true, room: next, event };
}

export function hungerFrom(dog: LivingDog, now: number) {
  const due = careFor(dogStage(dog)).feedEveryMs;
  return clamp(((now - dog.lastFedAt) / (due * 2)) * 100);
}

export function walkNeedFrom(dog: LivingDog, now: number) {
  const due = careFor(dogStage(dog)).walkEveryMs;
  return clamp(((now - dog.lastWalkedAt) / (due * 1.7)) * 100);
}

export function dogStage(dog: Pick<LivingDog, 'biologicalAgeMs' | 'furthestStage'>) {
  return furthestStage(stageFromAge(dog.biologicalAgeMs), dog.furthestStage);
}

export function careView(dog: LivingDog, now: number): CareView {
  const stage = dogStage(dog);
  const care = careFor(stage);
  const nextFeedInMs = dog.lastFedAt + care.feedEveryMs - now;
  const nextWalkInMs = dog.lastWalkedAt + care.walkEveryMs - now;
  const feedOverdue = nextFeedInMs <= 0;
  const walkOverdue = nextWalkInMs <= 0;
  const runawayInMs =
    dog.lowSince !== null ? Math.max(0, dog.lowSince + RUNAWAY_AFTER_MS - now) : null;

  let warning: string | null = null;
  if (dog.happiness < LOW_HAPPINESS && runawayInMs !== null) {
    const hours = Math.ceil(runawayInMs / 3_600_000);
    warning =
      hours <= 12
        ? `${displayName(dog)} is packing a sad little bag. A meal and a walk might still keep him.`
        : `${displayName(dog)} has been unhappy for a while. If this lasts about ${Math.max(1, Math.ceil(runawayInMs / 86_400_000))} more day(s), he may run away.`;
  } else if (feedOverdue && walkOverdue) {
    warning = `${displayName(dog)} needs dinner and a walk. The porch is getting gloomy.`;
  } else if (feedOverdue) {
    warning = `${displayName(dog)} is overdue for a meal.`;
  } else if (walkOverdue) {
    warning = `${displayName(dog)} is overdue for a walk.`;
  } else if (dog.happiness < 40) {
    warning = `${displayName(dog)} is getting gloomy. A little care would help.`;
  }

  return {
    nextFeedInMs,
    nextWalkInMs,
    feedOverdue,
    walkOverdue,
    hunger: Math.round(hungerFrom(dog, now)),
    walkNeed: Math.round(walkNeedFrom(dog, now)),
    runawayInMs,
    warning,
    walkHint: care.walkHint,
    mealHint: care.mealHint,
    ageNote: care.ageNote,
    walkCaption: care.walkCaption,
    walkGameMs: care.walkGameMs,
    walkSpeed: care.walkSpeed,
    walkSpawnMs: care.walkSpawnMs,
    walkRockChance: care.walkRockChance,
    feedDrops: care.feedDrops,
  };
}

function pushActivity(list: Activity[], event: Activity) {
  return [event, ...list].slice(0, MAX_ACTIVITY);
}

export function applyDecay(room: RoomState, now: number): RoomState {
  const current = resolvePendingName(migrateRoom(room), now);
  const dog = current.dog;
  if (!dog) return current;
  if (now <= dog.lastDecayAt) return current;

  const hours = (now - dog.lastDecayAt) / 3_600_000;
  if (hours <= 0) return room;

  const stage = dogStage(dog);
  const care = careFor(stage);
  const feedOverdue = now > dog.lastFedAt + care.feedEveryMs;
  const walkOverdue = now > dog.lastWalkedAt + care.walkEveryMs;
  const neglected = feedOverdue || walkOverdue || dog.happiness < LOW_HAPPINESS;
  const wellCared = !feedOverdue && !walkOverdue && dog.happiness >= 60;
  const biologicalAgeMs = dog.biologicalAgeMs + (now - dog.lastDecayAt) * growthRate(stage, neglected, wellCared);
  const nextStage = furthestStage(stageFromAge(biologicalAgeMs), dog.furthestStage);

  let happiness = clamp(
    dog.happiness -
      (3 + (feedOverdue ? 8 : 0) + (walkOverdue ? 5 : 0)) * hours,
  );
  let energy = clamp(dog.energy - (dog.asleep ? -14 : care.walkEnergyDrainPerHour) * hours);
  let affection = clamp(dog.affection - 2 * hours);
  let asleep = dog.asleep;
  let activity = dog.activity.slice();
  const night = isNight(now);

  if (!asleep && (energy < 16 || (night && energy < 48))) {
    asleep = true;
    energy = clamp(energy + 4);
    activity = pushActivity(activity, {
      at: now,
      action: 'sleep',
      text: night
        ? `${displayName(dog)} curled up for the night.`
        : `${displayName(dog)} flopped over for a mid-porch nap.`,
    });
  } else if (asleep && !night && energy > 74) {
    asleep = false;
    activity = pushActivity(activity, {
      at: now,
      action: 'wake',
      text: `${displayName(dog)} stretched, yawned, and reclaimed the rug.`,
    });
  }

  let lowSince = dog.lowSince;
  if (happiness < LOW_HAPPINESS) {
    if (dog.happiness >= LOW_HAPPINESS) {
      const drop = dog.happiness - happiness;
      const frac = drop <= 0 ? 1 : (dog.happiness - LOW_HAPPINESS) / drop;
      lowSince = dog.lastDecayAt + Math.max(0, Math.min(1, frac)) * (now - dog.lastDecayAt);
    } else {
      lowSince = dog.lowSince ?? dog.lastDecayAt;
    }
  } else {
    lowSince = null;
  }

  if (lowSince !== null && now - lowSince >= RUNAWAY_AFTER_MS) {
    return runaway(
      current,
      {
        ...dog,
        happiness,
        energy,
        affection,
        asleep,
        activity,
        lastDecayAt: now,
        lowSince,
        biologicalAgeMs,
        furthestStage: nextStage,
        peakHappiness: Math.max(dog.peakHappiness, happiness),
      },
      now,
    );
  }

  if (nextStage !== dog.furthestStage) {
    activity = pushActivity(activity, {
      at: now,
      action: 'system',
      text: `${displayName(dog)} grew into a ${careFor(nextStage).label.toLowerCase()}.`,
    });
  }

  return {
    ...current,
    dog: {
      ...dog,
      happiness,
      energy,
      affection,
      asleep,
      lastDecayAt: now,
      lowSince,
      activity,
      biologicalAgeMs,
      furthestStage: nextStage,
      peakHappiness: Math.max(dog.peakHappiness, happiness),
    },
  };
}

export function toRecord(dog: LivingDog, now: number, departed: DogRecord['departed']): DogRecord {
  return {
    id: dog.id,
    profile: dog.profile,
    caughtAt: dog.arrivedAt,
    leftAt: departed === 'home' ? null : now,
    daysSurvived: Math.max(0, Math.round(((now - dog.arrivedAt) / 86_400_000) * 10) / 10),
    furthestStage: dog.furthestStage,
    totals: dog.totals,
    peakHappiness: Math.round(Math.max(dog.peakHappiness, dog.happiness)),
    departed,
    genome: dog.genome,
    namedByCatcher: dog.namedByCatcher,
  };
}

export function runaway(room: RoomState, dog: LivingDog, now: number): RoomState {
  const memorial = toRecord(dog, now, 'ran_away');
  return {
    dog: null,
    memorial,
    history: [memorial, ...room.history].slice(0, MAX_HISTORY),
    lastCatchAt: room.lastCatchAt,
    pendingName: null,
    yard: migrateYard(room.yard, now),
  };
}

export function listHistory(room: RoomState, offset = 0, limit = HISTORY_PAGE) {
  const safeLimit = Math.max(1, Math.min(50, limit));
  const safeOffset = Math.max(0, offset);
  return {
    dogs: room.history.slice(safeOffset, safeOffset + safeLimit),
    total: room.history.length,
    offset: safeOffset,
    limit: safeLimit,
    leaders: {
      longestLived: [...room.history].sort((a, b) => b.daysSurvived - a.daysSurvived)[0] ?? null,
      mostWalked: [...room.history].sort((a, b) => b.totals.miles - a.totals.miles)[0] ?? null,
      mostPets: [...room.history].sort((a, b) => b.totals.pets - a.totals.pets)[0] ?? null,
    },
  };
}

export function moodLine(dog: LivingDog, now: number) {
  const care = careView(dog, now);
  if (dog.asleep) return 'Dreaming about a longer leash and a slower internet.';
  if (care.warning && dog.happiness < LOW_HAPPINESS) return 'Waiting to see if anyone still comes by.';
  if (care.hunger > 78) return 'Staring like dinner is a civil right.';
  if (care.walkNeed > 78) return 'Orbiting the door with the optimism of a tennis ball.';
  if (dog.energy < 22) return 'Considering a nap with both eyes open.';
  if (dog.happiness > 84) return 'Convinced every visitor came over just to play.';
  if (dog.affection > 80) return 'Leaning a whole personality against your shin.';
  if (isNight(now)) return 'Keeping a quiet watch on the dark porch.';
  return 'Holding court on the cream rug.';
}

export function toPublic(dog: LivingDog, now: number): PublicDog {
  const care = careView(dog, now);
  return {
    profile: dog.profile,
    happiness: Math.round(dog.happiness),
    energy: Math.round(dog.energy),
    affection: Math.round(dog.affection),
    fullness: Math.round(100 - care.hunger),
    asleep: dog.asleep,
    night: isNight(now),
    mood: moodLine(dog, now),
    totals: dog.totals,
    activity: dog.activity,
    arrivedAt: dog.arrivedAt,
    ageHours: Math.max(0, Math.round(((now - dog.arrivedAt) / 3_600_000) * 10) / 10),
    ageDays: Math.max(0, Math.round(((now - dog.arrivedAt) / 86_400_000) * 10) / 10),
    stage: dogStage(dog),
    stageLabel: careFor(dogStage(dog)).label,
    biologicalDays: Math.max(0, Math.round((dog.biologicalAgeMs / 86_400_000) * 10) / 10),
    care,
    genome: dog.genome,
    namedByCatcher: dog.namedByCatcher,
  };
}

export function snapshot(room: RoomState, now: number, presence: number): PublicSnapshot {
  const current = applyDecay(room, now);
  const yard = migrateYard(current.yard, now);
  return {
    type: 'state',
    dog: current.dog ? toPublic(current.dog, now) : null,
    presence,
    awaitingCatch: !current.dog,
    awaitingName: Boolean(current.pendingName),
    nameUntil: current.pendingName?.until ?? null,
    usedNameIds: usedNameIds(current),
    memorial: current.memorial,
    history: current.history.slice(0, 4),
    pose: publicPose(yard.pose),
    leash: publicLeash(yard.leash, now),
    feeder: publicFeeder(yard.feeder, yard.pose, now),
    location: publicLocation(migrateLocation(yard.location, now)),
    companions: publicCompanions(current.companions, yard.pose, now),
  };
}

export type ActionFail = { ok: false; code: ErrorCode; room: RoomState; retryAfterMs?: number };
export type PetOk = { ok: true; kind: 'pet'; room: RoomState; event: Activity };
export type CareOk = { ok: true; kind: 'feed' | 'walk'; room: RoomState; event: Activity };
export type CatchOk = { ok: true; kind: 'catch'; room: RoomState; event: Activity; nameToken: string };
export type ActionResult = PetOk | CareOk | CatchOk | ActionFail;

export function applyPet(room: RoomState, now: number): ActionResult {
  const current = applyDecay(room, now);
  if (!current.dog) return { ok: false, code: 'gone', room: current };
  const wait = current.dog.lastPettedAt + PET_COOLDOWN_MS - now;
  if (wait > 0) return { ok: false, code: 'cooldown', room: current, retryAfterMs: wait };

  const dog = current.dog;
  const next: LivingDog = {
    ...dog,
    happiness: clamp(dog.happiness + (dog.asleep ? 2 : 6)),
    affection: clamp(dog.affection + (dog.asleep ? 4 : 8)),
    lastPettedAt: now,
    totals: { ...dog.totals, pets: dog.totals.pets + 1 },
    peakHappiness: Math.max(dog.peakHappiness, dog.happiness + (dog.asleep ? 2 : 6)),
  };
  const event: Activity = {
    at: now,
    action: 'pet',
    text: next.asleep
        ? `Someone scratched ${displayName(dog)} behind the ear. A tail answered.`
      : `Someone just petted ${displayName(dog)}.`,
  };
  next.activity = pushActivity(dog.activity, event);
  if (next.happiness >= LOW_HAPPINESS) next.lowSince = null;
  return { ok: true, kind: 'pet', room: { ...current, dog: next }, event };
}

export function canStartCare(room: RoomState, kind: 'feed' | 'walk', now: number): ActionFail | { ok: true; room: RoomState } {
  const current = applyDecay(room, now);
  if (!current.dog) return { ok: false, code: 'gone', room: current };
  if (kind === 'walk' && current.dog.asleep) return { ok: false, code: 'asleep', room: current };
  if (kind === 'walk' && current.dog.energy < 16) return { ok: false, code: 'too_tired', room: current };
  const care = careFor(dogStage(current.dog));
  const gap = kind === 'feed' ? care.feedMinGapMs : care.walkMinGapMs;
  const last = kind === 'feed' ? current.dog.lastFedAt : current.dog.lastWalkedAt;
  const wait = last + gap - now;
  if (wait > 0) return { ok: false, code: 'too_soon', room: current, retryAfterMs: wait };
  return { ok: true, room: current };
}

export function canStartCatch(room: RoomState, now: number): ActionFail | { ok: true; room: RoomState } {
  const current = applyDecay(room, now);
  if (current.dog) return { ok: false, code: 'home', room: current };
  const wait = current.lastCatchAt + CATCH_COOLDOWN_MS - now;
  if (wait > 0) return { ok: false, code: 'cooldown', room: current, retryAfterMs: wait };
  return { ok: true, room: current };
}

export function gameWindow(kind: CareGame) {
  if (kind === 'feed') return FEED_GAME;
  if (kind === 'walk') return WALK_GAME;
  return CATCH_GAME;
}

export function validateFinish(kind: CareGame, startedAt: number, score: number, now: number): ErrorCode | null {
  if (!Number.isFinite(score) || score < 0 || score > 100) return 'invalid';
  const duration = now - startedAt;
  const window = gameWindow(kind);
  if (duration < window.minMs || duration > window.maxMs) return 'invalid';
  return null;
}

export function applyCare(
  room: RoomState,
  kind: 'feed' | 'walk',
  score: number,
  now: number,
): ActionResult {
  const allowed = canStartCare(room, kind, now);
  if (!allowed.ok) return allowed;
  const dog = allowed.room.dog!;
  const quality = clamp(score) / 100;
  const stage = dogStage(dog);
  const care = careFor(stage);

  if (kind === 'feed') {
    const next: LivingDog = {
      ...dog,
      happiness: clamp(dog.happiness + 8 + quality * 12),
      energy: clamp(dog.energy + 6 + quality * 6),
      lastFedAt: now,
      lastDecayAt: now,
      totals: { ...dog.totals, feeds: dog.totals.feeds + 1 },
      peakHappiness: Math.max(dog.peakHappiness, dog.happiness + 8 + quality * 12),
    };
    const event: Activity = {
      at: now,
      action: 'feed',
      text:
        score >= 70
          ? `Someone fed ${displayName(dog)} a heroic dinner.`
          : `Someone fed ${displayName(dog)}.`,
    };
    next.activity = pushActivity(dog.activity, event);
    if (next.happiness >= LOW_HAPPINESS) next.lowSince = null;
    return { ok: true, kind: 'feed', room: { ...allowed.room, dog: next }, event };
  }

  const miles = Math.round((0.08 + quality * 0.16) * 100) / 100;
  const overwalked = score > care.overwalkScore;
  const happinessDelta = overwalked
    ? -care.overwalkHappiness
    : 10 + quality * 14;
  const energyDelta = overwalked
    ? -(care.walkEnergyCost + care.overwalkEnergy)
    : -care.walkEnergyCost + quality * 4;
  const next: LivingDog = {
    ...dog,
    happiness: clamp(dog.happiness + happinessDelta),
    energy: clamp(dog.energy + energyDelta),
    affection: clamp(dog.affection + 6 + quality * 6),
    lastWalkedAt: now,
    lastDecayAt: now,
    peakHappiness: Math.max(dog.peakHappiness, dog.happiness + Math.max(0, happinessDelta)),
    totals: {
      ...dog.totals,
      walks: dog.totals.walks + 1,
      miles: Math.round((dog.totals.miles + miles) * 100) / 100,
    },
  };
  const event: Activity = {
    at: now,
    action: 'walk',
    text: overwalked
      ? `${displayName(dog)} came home tired. That walk was a bit much for a ${care.label.toLowerCase()}.`
      : score >= 70
        ? `${displayName(dog)} came home from a legendary sniff tour.`
        : `${displayName(dog)} went for a walk.`,
  };
  next.activity = pushActivity(dog.activity, event);
  if (next.happiness >= LOW_HAPPINESS) next.lowSince = null;
  return { ok: true, kind: 'walk', room: { ...allowed.room, dog: next }, event };
}

export function creditLeashWalk(room: RoomState, now: number): ActionResult | null {
  const current = applyDecay(room, now);
  const yard = migrateYard(current.yard, now);
  if (walkCreditPending(yard.leash) < WALK_CREDIT_M) return null;
  const allowed = canStartCare(current, 'walk', now);
  if (!allowed.ok) return null;
  const result = applyCare(allowed.room, 'walk', 62, now);
  if (!result.ok) return null;
  return {
    ...result,
    room: { ...result.room, yard: markWalkCredited(yard) },
  };
}

export function applyCompanionHere(
  room: RoomState,
  clientId: string,
  x: number,
  z: number,
  now: number,
): RoomState {
  const current = migrateRoom(room, now);
  const yard = migrateYard(current.yard, now);
  return {
    ...current,
    companions: applyHere(current.companions ?? {}, clientId, x, z, yard.pose, now),
  };
}

export function applyCompanionEmote(
  room: RoomState,
  clientId: string,
  emote: EmoteKind,
  now: number,
): RoomState {
  const current = migrateRoom(room, now);
  const yard = migrateYard(current.yard, now);
  return {
    ...current,
    companions: applyEmote(current.companions ?? {}, clientId, emote, yard.pose, now),
  };
}

export function welcomeCompanion(room: RoomState, clientId: string, now: number): RoomState {
  const current = migrateRoom(room, now);
  const yard = migrateYard(current.yard, now);
  return {
    ...current,
    companions: seatCompanion(current.companions ?? {}, clientId, yard.pose, now),
  };
}

export function forgetVisitor(room: RoomState, clientId: string, now: number, liveIds?: Iterable<string>): RoomState {
  const current = migrateRoom(room, now);
  const yard = migrateYard(current.yard, now);
  const dropped = dropCompanion(current.companions ?? {}, clientId);
  if (yard.leash.holderId === clientId) {
    return { ...current, companions: pruneCompanions(dropped, now, liveIds), yard: releaseLeash(yard, now, liveIds) };
  }
  return {
    ...current,
    companions: pruneCompanions(dropped, now, liveIds),
    yard: {
      ...yard,
      leash: { ...yard.leash, queue: (yard.leash.queue ?? []).filter((wait) => wait.id !== clientId) },
    },
  };
}

export function applyVisitorMove(
  room: RoomState,
  clientId: string,
  ip: string,
  ax: number,
  az: number,
  run: boolean,
  dt: number,
  now: number,
  proposed?: { x: number; z: number } | null,
): { room: RoomState; acquired: boolean; code?: ErrorCode; retryAfterMs?: number; walk?: ActionResult } {
  const current = applyDecay(room, now);
  const yard = migrateYard(current.yard, now);
  const acquired = tryAcquireLeash(yard, clientId, ip, now);
  if (!acquired.ok) {
    return { room: { ...current, yard: acquired.yard }, acquired: false, code: acquired.code, retryAfterMs: acquired.retryAfterMs };
  }
  const driven = applyHomeOrWorldDrive(acquired.yard, ax, az, run, dt, now, proposed);
  const next = { ...current, yard: driven };
  const walk = creditLeashWalk(next, now);
  return { room: walk && walk.ok ? walk.room : next, acquired: true, walk: walk ?? undefined };
}

export function applyWorldAction(
  room: RoomState,
  clientId: string,
  ip: string,
  now: number,
  kind: 'leave' | 'home' | 'travel',
  placeId?: string,
): { room: RoomState; acquired: boolean; code?: ErrorCode; retryAfterMs?: number } {
  const current = applyDecay(room, now);
  const yard = withLocation(migrateYard(current.yard, now), now);
  const acquired = tryAcquireLeash(yard, clientId, ip, now);
  if (!acquired.ok) {
    return { room: { ...current, yard: acquired.yard }, acquired: false, code: acquired.code, retryAfterMs: acquired.retryAfterMs };
  }
  if (kind === 'leave' || kind === 'home') {
    return { room: { ...current, yard: acquired.yard }, acquired: true };
  }
  const traveled = applyTravel(acquired.yard, placeId ?? '', now);
  if (!traveled.ok) return { room: { ...current, yard: acquired.yard }, acquired: true, code: traveled.code };
  return { room: { ...current, yard: traveled.yard }, acquired: true };
}

export function applyBowlAction(
  room: RoomState,
  now: number,
): { room: RoomState; fed?: ActionResult; code?: ErrorCode } {
  const current = applyDecay(room, now);
  const yard = withLocation(migrateYard(current.yard, now), now);
  const filled = fillFeeder(yard, now);
  if (!nearFeeder(filled.pose.x, filled.pose.z, filled.feeder)) {
    return { room: { ...current, yard: filled }, code: 'too_far' };
  }
  const allowed = canStartCare({ ...current, yard: filled }, 'feed', now);
  if (!allowed.ok) {
    return { room: { ...current, yard: filled }, code: allowed.code };
  }
  const fed = applyCare(allowed.room, 'feed', 74, now);
  if (!fed.ok) {
    return { room: { ...fed.room, yard: filled }, fed, code: fed.code };
  }
  return { room: { ...fed.room, yard: startEating(filled, now) }, fed };
}

export function tickSharedYard(room: RoomState, now: number, dt: number): { room: RoomState; fed?: ActionResult } {
  const current = applyDecay(room, now);
  const yard = withLocation(migrateYard(current.yard, now), now);
  const dog = current.dog;
  const care = dog ? careView(dog, now) : null;
  const hungry = Boolean(care && (care.feedOverdue || care.hunger > 58));
  const nextYard = tickWorldAi(yard, now, dt, { hungry });
  let next = { ...current, yard: nextYard };
  if (
    yard.feeder.hasFood &&
    nextYard.feeder.eatingUntil > now &&
    nextYard.feeder.eatingUntil !== yard.feeder.eatingUntil
  ) {
    const fed = applyCare(next, 'feed', 70, now);
    if (fed.ok) return { room: { ...fed.room, yard: nextYard }, fed };
  }
  return { room: next };
}

export function applyCatch(
  room: RoomState,
  score: number,
  now: number,
  rng: () => number = Math.random,
): ActionResult {
  const allowed = canStartCatch(room, now);
  if (!allowed.ok) return allowed;
  if (score < CATCH_MIN_SCORE) {
    return { ok: false, code: 'missed', room: { ...allowed.room, lastCatchAt: now } };
  }
  const seed = `dog-${now}-${Math.floor(rng() * 1e9)}`;
  const token = `name-${Math.floor(rng() * 1e9).toString(36)}${Math.floor(rng() * 1e9).toString(36)}`;
  const dog = createDog(
    { id: seed, name: '', personality: generatePersonality(seed) },
    now,
    seed,
  );
  const event: Activity = {
    at: now,
    action: 'catch',
    text: 'A new dog was caught. Waiting for a name.',
  };
  dog.activity = [event];
  return {
    ok: true,
    kind: 'catch',
    nameToken: token,
    room: {
      dog,
      memorial: null,
      history: allowed.room.history,
      lastCatchAt: now,
      pendingName: { token, until: now + NAME_WINDOW_MS },
      yard: (() => {
        const parked = settleWorldYard(migrateYard(allowed.room.yard, now), now);
        return {
          ...createYard(now),
          pose: { ...parked.pose, vx: 0, vz: 0, gait: 'idle' as const },
          location: parked.location,
          feeder: { ...createYard(now).feeder, ...placeFeeder(parked.pose) },
        };
      })(),
    },
    event,
  };
}

export type RateBucket = {
  count: number;
  windowStart: number;
  lastAt: number;
};

export function takeConnectionGap(lastAt: number, now: number) {
  const wait = lastAt + CONNECTION_GAP_MS - now;
  if (wait > 0) return { ok: false as const, retryAfterMs: wait };
  return { ok: true as const };
}

export function takeRate(
  bucket: RateBucket | undefined,
  now: number,
): { ok: true; bucket: RateBucket } | { ok: false; bucket: RateBucket; retryAfterMs: number } {
  const current: RateBucket = bucket ?? { count: 0, windowStart: now, lastAt: 0 };
  const windowStart = now - current.windowStart > IP_WINDOW_MS ? now : current.windowStart;
  const count = windowStart === current.windowStart ? current.count + 1 : 1;
  if (count > IP_MAX_ACTIONS) {
    return {
      ok: false,
      bucket: { ...current, windowStart },
      retryAfterMs: Math.max(0, IP_WINDOW_MS - (now - windowStart)),
    };
  }
  return { ok: true, bucket: { count, windowStart, lastAt: now } };
}

export function pruneBuckets(map: Record<string, RateBucket>, now: number) {
  const next: Record<string, RateBucket> = {};
  for (const [key, bucket] of Object.entries(map)) {
    if (now - bucket.lastAt < IP_WINDOW_MS * 2) next[key] = bucket;
  }
  return next;
}

export type ClientMessage =
  | { ok: true; kind: 'hello' }
  | { ok: true; kind: 'pet' }
  | { ok: true; kind: 'start'; game: CareGame }
  | { ok: true; kind: 'finish'; playId: string; score: number }
  | { ok: true; kind: 'name'; nameId: string }
  | { ok: true; kind: 'move'; ax: number; az: number; run: boolean; wx?: number; wz?: number }
  | { ok: true; kind: 'bowl' }
  | { ok: true; kind: 'leave' }
  | { ok: true; kind: 'home' }
  | { ok: true; kind: 'travel'; placeId: string }
  | { ok: true; kind: 'emote'; emote: EmoteKind }
  | { ok: true; kind: 'here'; x: number; z: number }
  | { ok: false; code: ErrorCode };

const CLIENT_KEYS = [
  'type',
  'action',
  'kind',
  'game',
  'playId',
  'score',
  'nameId',
  'ax',
  'az',
  'run',
  'wx',
  'wz',
  'placeId',
  'x',
  'z',
];

export function parseClientMessage(raw: string): ClientMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'invalid' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, code: 'invalid' };
  const message = parsed as Record<string, unknown>;
  const keys = Object.keys(message);
  if (keys.some((key) => !CLIENT_KEYS.includes(key))) {
    return { ok: false, code: 'invalid' };
  }
  if (message.type === 'hello') return { ok: true, kind: 'hello' };
  if (message.type === 'action' && message.action === 'pet') return { ok: true, kind: 'pet' };
  if (message.type === 'start' && (message.game === 'feed' || message.game === 'walk' || message.game === 'catch')) {
    return { ok: true, kind: 'start', game: message.game };
  }
  if (message.type === 'finish' && typeof message.playId === 'string' && typeof message.score === 'number') {
    if (!/^[a-z0-9-]{8,40}$/i.test(message.playId)) return { ok: false, code: 'invalid' };
    return { ok: true, kind: 'finish', playId: message.playId, score: message.score };
  }
  if (message.type === 'name' && typeof message.nameId === 'string') {
    if (!/^[a-z0-9-]{1,40}$/.test(message.nameId)) return { ok: false, code: 'invalid' };
    return { ok: true, kind: 'name', nameId: message.nameId };
  }
  if (message.type === 'move' && typeof message.ax === 'number' && typeof message.az === 'number') {
    if (!Number.isFinite(message.ax) || !Number.isFinite(message.az)) return { ok: false, code: 'invalid' };
    const wx = typeof message.wx === 'number' && Number.isFinite(message.wx) ? message.wx : undefined;
    const wz = typeof message.wz === 'number' && Number.isFinite(message.wz) ? message.wz : undefined;
    return { ok: true, kind: 'move', ax: message.ax, az: message.az, run: message.run === true, wx, wz };
  }
  if (message.type === 'bowl') return { ok: true, kind: 'bowl' };
  if (message.type === 'leave') return { ok: true, kind: 'leave' };
  if (message.type === 'home') return { ok: true, kind: 'home' };
  if (message.type === 'travel' && typeof message.placeId === 'string') {
    if (!/^[a-z0-9-]{2,40}$/.test(message.placeId)) return { ok: false, code: 'invalid' };
    return { ok: true, kind: 'travel', placeId: message.placeId };
  }
  if (message.type === 'emote' && isEmote(message.kind)) {
    return { ok: true, kind: 'emote', emote: message.kind };
  }
  if (message.type === 'here' && typeof message.x === 'number' && typeof message.z === 'number') {
    if (!Number.isFinite(message.x) || !Number.isFinite(message.z)) return { ok: false, code: 'invalid' };
    return { ok: true, kind: 'here', x: message.x, z: message.z };
  }
  return { ok: false, code: 'invalid' };
}

export function fanout(clients: Array<{ send: (data: string) => void }>, payload: unknown) {
  const data = JSON.stringify(payload);
  for (const client of clients) client.send(data);
  return data;
}

export const ALLOWED_ORIGIN_DEFAULTS = [
  'https://saidyaka.com',
  'https://www.saidyaka.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3005',
  'http://127.0.0.1:3005',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
];

export function allowedOrigins(raw?: string) {
  const extra = (raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set([...ALLOWED_ORIGIN_DEFAULTS, ...extra]);
}

export function originAllowed(origin: string | null, rawAllowlist?: string) {
  if (!origin) return false;
  return allowedOrigins(rawAllowlist).has(origin);
}

export function formatCountdown(ms: number) {
  const abs = Math.abs(ms);
  const minutes = Math.max(0, Math.round(abs / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

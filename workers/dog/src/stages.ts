export const DAY_MS = 86_400_000;

export const STAGES = ['puppy', 'young', 'adult', 'senior'] as const;
export type LifeStage = (typeof STAGES)[number];

/** Biological age at which each stage begins. Tunable. */
export const STAGE_AT_MS: Record<LifeStage, number> = {
  puppy: 0,
  young: 2 * DAY_MS,
  adult: 7 * DAY_MS,
  senior: 21 * DAY_MS,
};

/**
 * Care cadence, walk feel, meals, and growth by life stage.
 * Decay, eligibility, mini-games, and UI all read this object — tune here only.
 */
export type StageCare = {
  feedEveryMs: number;
  walkEveryMs: number;
  feedMinGapMs: number;
  walkMinGapMs: number;
  walkGameMs: number;
  walkSpeed: number;
  walkSpawnMs: number;
  walkRockChance: number;
  walkEnergyCost: number;
  walkEnergyDrainPerHour: number;
  overwalkScore: number;
  overwalkHappiness: number;
  overwalkEnergy: number;
  feedDrops: number;
  goodGrowth: number;
  neglectGrowth: number;
  walkHint: string;
  mealHint: string;
  ageNote: string;
  walkCaption: string;
  label: string;
};

export const CARE_BY_STAGE: Record<LifeStage, StageCare> = {
  puppy: {
    feedEveryMs: 45 * 60 * 1000,
    walkEveryMs: 90 * 60 * 1000,
    feedMinGapMs: 12 * 60 * 1000,
    walkMinGapMs: 25 * 60 * 1000,
    walkGameMs: 7_000,
    walkSpeed: 132,
    walkSpawnMs: 720,
    walkRockChance: 0.32,
    walkEnergyCost: 6,
    walkEnergyDrainPerHour: 6,
    overwalkScore: 100,
    overwalkHappiness: 0,
    overwalkEnergy: 0,
    feedDrops: 5,
    goodGrowth: 1.3,
    neglectGrowth: 0.55,
    walkHint: 'Puppies need short walks often.',
    mealHint: 'Small meals, more often than a grown dog.',
    ageNote: 'Puppies need short walks often and small meals.',
    walkCaption: 'A short puppy loop. Easy hops, then home.',
    label: 'Puppy',
  },
  young: {
    feedEveryMs: 60 * 60 * 1000,
    walkEveryMs: 2 * 60 * 60 * 1000,
    feedMinGapMs: 18 * 60 * 1000,
    walkMinGapMs: 30 * 60 * 1000,
    walkGameMs: 16_000,
    walkSpeed: 220,
    walkSpawnMs: 420,
    walkRockChance: 0.52,
    walkEnergyCost: 18,
    walkEnergyDrainPerHour: 10,
    overwalkScore: 100,
    overwalkHappiness: 0,
    overwalkEnergy: 0,
    feedDrops: 8,
    goodGrowth: 1.25,
    neglectGrowth: 0.6,
    walkHint: 'Young dogs need the most running around.',
    mealHint: 'A solid meal about once an hour.',
    ageNote: 'Young dogs need the most exercise — longer, faster walks.',
    walkCaption: 'A long, fast run. He will burn through this.',
    label: 'Young',
  },
  adult: {
    feedEveryMs: 60 * 60 * 1000,
    walkEveryMs: 2.5 * 60 * 60 * 1000,
    feedMinGapMs: 20 * 60 * 1000,
    walkMinGapMs: 40 * 60 * 1000,
    walkGameMs: 14_000,
    walkSpeed: 190,
    walkSpawnMs: 500,
    walkRockChance: 0.46,
    walkEnergyCost: 14,
    walkEnergyDrainPerHour: 8,
    overwalkScore: 100,
    overwalkHappiness: 0,
    overwalkEnergy: 0,
    feedDrops: 8,
    goodGrowth: 1.15,
    neglectGrowth: 0.65,
    walkHint: 'Adults want a proper walk, not a sprint.',
    mealHint: 'Dinner on the hour keeps the porch civil.',
    ageNote: 'Adults want a proper walk and a steady dinner hour.',
    walkCaption: 'A proper walk around the block.',
    label: 'Adult',
  },
  senior: {
    feedEveryMs: 75 * 60 * 1000,
    walkEveryMs: 5 * 60 * 60 * 1000,
    feedMinGapMs: 30 * 60 * 1000,
    walkMinGapMs: 70 * 60 * 1000,
    walkGameMs: 7_000,
    walkSpeed: 98,
    walkSpawnMs: 820,
    walkRockChance: 0.25,
    walkEnergyCost: 16,
    walkEnergyDrainPerHour: 4,
    overwalkScore: 58,
    overwalkHappiness: 10,
    overwalkEnergy: 16,
    feedDrops: 6,
    goodGrowth: 1,
    neglectGrowth: 0.7,
    walkHint: 'Seniors need fewer, gentler, shorter walks.',
    mealHint: 'Unhurried meals, a little less often.',
    ageNote: 'Seniors need fewer, gentler, shorter walks. Don’t overdo it.',
    walkCaption: 'An easy senior stroll. Keep it gentle.',
    label: 'Senior',
  },
};

export function stageFromAge(biologicalAgeMs: number): LifeStage {
  if (biologicalAgeMs >= STAGE_AT_MS.senior) return 'senior';
  if (biologicalAgeMs >= STAGE_AT_MS.adult) return 'adult';
  if (biologicalAgeMs >= STAGE_AT_MS.young) return 'young';
  return 'puppy';
}

export function careFor(stage: LifeStage) {
  return CARE_BY_STAGE[stage];
}

export function stageRank(stage: LifeStage) {
  return STAGES.indexOf(stage);
}

export function furthestStage(current: LifeStage, previous: LifeStage) {
  return stageRank(current) >= stageRank(previous) ? current : previous;
}

export function growthRate(stage: LifeStage, neglected: boolean, wellCared: boolean) {
  const care = CARE_BY_STAGE[stage];
  if (neglected) return care.neglectGrowth;
  if (wellCared) return care.goodGrowth;
  return 1;
}

/** Total walk-game time a well-timed day asks for. Young/adult should lead. */
export function dailyWalkGameMs(stage: LifeStage) {
  const care = CARE_BY_STAGE[stage];
  return (DAY_MS / care.walkEveryMs) * care.walkGameMs;
}

export function dailyMeals(stage: LifeStage) {
  return DAY_MS / CARE_BY_STAGE[stage].feedEveryMs;
}

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
 * Care cadence, walk feel, and growth by life stage.
 * Tune numbers here; decay, eligibility, mini-games, and UI all read this.
 */
export const CARE_BY_STAGE: Record<
  LifeStage,
  {
    feedEveryMs: number;
    walkEveryMs: number;
    feedMinGapMs: number;
    walkMinGapMs: number;
    walkGameMs: number;
    walkSpeed: number;
    walkEnergyCost: number;
    walkEnergyDrainPerHour: number;
    overwalkScore: number;
    overwalkHappiness: number;
    overwalkEnergy: number;
    goodGrowth: number;
    neglectGrowth: number;
    walkHint: string;
    mealHint: string;
    label: string;
  }
> = {
  puppy: {
    feedEveryMs: 45 * 60 * 1000,
    walkEveryMs: 90 * 60 * 1000,
    feedMinGapMs: 12 * 60 * 1000,
    walkMinGapMs: 25 * 60 * 1000,
    walkGameMs: 8_000,
    walkSpeed: 140,
    walkEnergyCost: 7,
    walkEnergyDrainPerHour: 7,
    overwalkScore: 100,
    overwalkHappiness: 0,
    overwalkEnergy: 0,
    goodGrowth: 1.3,
    neglectGrowth: 0.55,
    walkHint: 'Puppies need short walks often.',
    mealHint: 'Small meals, more often than a grown dog.',
    label: 'Puppy',
  },
  young: {
    feedEveryMs: 60 * 60 * 1000,
    walkEveryMs: 2.5 * 60 * 60 * 1000,
    feedMinGapMs: 18 * 60 * 1000,
    walkMinGapMs: 35 * 60 * 1000,
    walkGameMs: 13_000,
    walkSpeed: 200,
    walkEnergyCost: 15,
    walkEnergyDrainPerHour: 8,
    overwalkScore: 100,
    overwalkHappiness: 0,
    overwalkEnergy: 0,
    goodGrowth: 1.25,
    neglectGrowth: 0.6,
    walkHint: 'Young dogs need the most running around.',
    mealHint: 'A solid meal about once an hour.',
    label: 'Young',
  },
  adult: {
    feedEveryMs: 60 * 60 * 1000,
    walkEveryMs: 3 * 60 * 60 * 1000,
    feedMinGapMs: 20 * 60 * 1000,
    walkMinGapMs: 45 * 60 * 1000,
    walkGameMs: 12_000,
    walkSpeed: 180,
    walkEnergyCost: 12,
    walkEnergyDrainPerHour: 6,
    overwalkScore: 100,
    overwalkHappiness: 0,
    overwalkEnergy: 0,
    goodGrowth: 1.15,
    neglectGrowth: 0.65,
    walkHint: 'Adults want a proper walk, not a sprint.',
    mealHint: 'Dinner on the hour keeps the porch civil.',
    label: 'Adult',
  },
  senior: {
    feedEveryMs: 75 * 60 * 1000,
    walkEveryMs: 5 * 60 * 60 * 1000,
    feedMinGapMs: 30 * 60 * 1000,
    walkMinGapMs: 70 * 60 * 1000,
    walkGameMs: 8_000,
    walkSpeed: 108,
    walkEnergyCost: 10,
    walkEnergyDrainPerHour: 5,
    overwalkScore: 62,
    overwalkHappiness: 8,
    overwalkEnergy: 12,
    goodGrowth: 1,
    neglectGrowth: 0.7,
    walkHint: 'Seniors need fewer, gentler, shorter walks.',
    mealHint: 'Unhurried meals, a little less often.',
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

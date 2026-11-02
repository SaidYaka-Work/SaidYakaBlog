/** NYC Marathon finish-time math used by the post calculator. */

export const MARATHON_KM = 42.195;
export const MARATHON_MILES = 26.21875;
export const KM_PER_MILE = 1.609344;
export const DEFAULT_RIEGEL_EXPONENT = 1.06;

export const DISTANCE_PRESETS_KM = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
} as const;

const HALF_KM = DISTANCE_PRESETS_KM.half;
/** First-half share for even effort: a touch slower than even, as the post wants. */
const EVEN_EFFORT_FIRST_HALF = 0.504;

export type DistancePreset = keyof typeof DISTANCE_PRESETS_KM | 'custom';
export type Crowding = 'open' | 'typical' | 'dense';
export type Weather = 'cool' | 'mild' | 'warm' | 'hot';
export type Training = 'strong' | 'consistent' | 'thin';
export type SplitMode = '5k' | 'landmarks';
export type EffortPlan = 'even-clock' | 'even-effort';
export type Unit = 'mi' | 'km';

export type CourseFlags = {
  bridges: boolean;
  firstAve: boolean;
  fifthAve: boolean;
  centralPark: boolean;
};

export type EstimateInput = {
  distanceKm: number;
  timeSeconds: number;
  exponent: number;
  course: CourseFlags;
  crowding: Crowding;
  weather: Weather;
  training: Training;
};

export type SplitRow = {
  id: string;
  label: string;
  km: number;
  miles: number;
  splitSeconds: number;
  elapsedSeconds: number;
  paceSecPerKm: number;
  paceSecPerMile: number;
};

export type EstimateResult = {
  riegelSeconds: number;
  vdot: number;
  vdotSeconds: number;
  bufferSeconds: number;
  nycSeconds: number;
  paceSecPerMile: number;
  paceSecPerKm: number;
};

/**
 * Course taxes from the post: a couple of minutes versus a flat,
 * uncrowded equivalent when every listed feature is on.
 */
export const COURSE_SECONDS = {
  bridges: 50,
  firstAve: 20,
  fifthAve: 30,
  centralPark: 20,
} as const;

/** Wave / corral start. Typical is the default first-Sunday shuffle. */
export const CROWDING_SECONDS: Record<Crowding, number> = {
  open: 0,
  typical: 60,
  dense: 150,
};

/** Cool November is the baseline; heat is the variable the post respects most. */
export const WEATHER_SECONDS: Record<Weather, number> = {
  cool: 0,
  mild: 60,
  warm: 180,
  hot: 360,
};

/**
 * Riegel holdback in minutes, not fake percentages.
 * Consistent 18–20 milers: default 1:45 half → 3:45 NYC.
 * Stronger marathon-specific work lands nearer 3:42.
 */
export const TRAINING_SECONDS: Record<Training, number> = {
  strong: 0,
  consistent: 185,
  thin: 485,
};

export const DEFAULT_COURSE: CourseFlags = {
  bridges: true,
  firstAve: true,
  fifthAve: true,
  centralPark: true,
};

const FIVE_K_SPLITS = [
  { id: '5k', label: '5K · Brooklyn', km: 5 },
  { id: '10k', label: '10K · Brooklyn', km: 10 },
  { id: '15k', label: '15K · Brooklyn', km: 15 },
  { id: '20k', label: '20K · approaching Queens', km: 20 },
  { id: '25k', label: '25K · First Avenue', km: 25 },
  { id: '30k', label: '30K · Bronx', km: 30 },
  { id: '35k', label: '35K · Fifth Avenue', km: 35 },
  { id: '40k', label: '40K · Central Park', km: 40 },
  { id: 'finish', label: 'Finish', km: MARATHON_KM },
] as const;

const LANDMARK_SPLITS = [
  { id: 'verrazzano', label: 'Verrazzano', km: 1.609344 },
  { id: '5k', label: '5K · Brooklyn', km: 5 },
  { id: '10k', label: '10K · Brooklyn', km: 10 },
  { id: 'half', label: 'Half · Pulaski', km: 21.0975 },
  { id: 'queensboro', label: 'Queensboro / First Ave', km: 25.75 },
  { id: 'willis', label: 'Willis Ave · Bronx', km: 32.187 },
  { id: 'fifth', label: 'Fifth Avenue', km: 37.015 },
  { id: 'park', label: 'Central Park', km: 39.43 },
  { id: 'finish', label: 'Finish', km: MARATHON_KM },
] as const;

/** Even-effort curve: conservative start, controlled First Ave, late hills cost clock time. */
const EFFORT_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 1.04],
  [8, 1.01],
  [16, 1.005],
  [21.1, 1.0],
  [26, 1.02],
  [32, 1.015],
  [37, 1.03],
  [40, 1.02],
  [MARATHON_KM, 1.0],
];

export function kmFromMiles(miles: number): number {
  return miles * KM_PER_MILE;
}

export function milesFromKm(km: number): number {
  return km / KM_PER_MILE;
}

export function parseHms(hours: number, minutes: number, seconds: number): number {
  if (![hours, minutes, seconds].every((value) => Number.isFinite(value))) return 0;
  if (hours < 0 || minutes < 0 || seconds < 0) return 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatHms(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours === 0) return `${minutes}:${ss}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
}

export function formatPace(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0 || totalSeconds > 3600) return '—';
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function riegelSeconds(
  timeSeconds: number,
  fromKm: number,
  toKm = MARATHON_KM,
  exponent = DEFAULT_RIEGEL_EXPONENT
): number {
  if (timeSeconds <= 0 || fromKm <= 0 || toKm <= 0) return 0;
  return timeSeconds * (toKm / fromKm) ** exponent;
}

/**
 * Jack Daniels / Gilbert oxygen-cost model.
 * VO2 = -4.60 + 0.182258 v + 0.000104 v²  (v in meters / minute)
 * %VO2max = 0.8 + 0.1894393 e^{-0.012778 t} + 0.2989558 e^{-0.1932605 t}
 */
export function vdotFromRace(distanceKm: number, timeSeconds: number): number {
  if (distanceKm <= 0 || timeSeconds <= 0) return 0;
  const minutes = timeSeconds / 60;
  const velocity = (distanceKm * 1000) / minutes;
  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  const percent =
    0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
  if (percent <= 0) return 0;
  return vo2 / percent;
}

export function timeFromVdot(distanceKm: number, vdot: number): number {
  if (distanceKm <= 0 || vdot <= 0) return 0;
  let lo = 4 * 60;
  let hi = 12 * 3600;
  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    const implied = vdotFromRace(distanceKm, mid);
    if (implied > vdot) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function courseBufferSeconds(course: CourseFlags): number {
  return (
    (course.bridges ? COURSE_SECONDS.bridges : 0) +
    (course.firstAve ? COURSE_SECONDS.firstAve : 0) +
    (course.fifthAve ? COURSE_SECONDS.fifthAve : 0) +
    (course.centralPark ? COURSE_SECONDS.centralPark : 0)
  );
}

export function adjustmentSeconds(input: Pick<EstimateInput, 'course' | 'crowding' | 'weather' | 'training'>): number {
  return (
    courseBufferSeconds(input.course) +
    CROWDING_SECONDS[input.crowding] +
    WEATHER_SECONDS[input.weather] +
    TRAINING_SECONDS[input.training]
  );
}

export function estimateFinish(input: EstimateInput): EstimateResult | null {
  if (input.distanceKm <= 0 || input.timeSeconds <= 0) return null;
  const exponent = Number.isFinite(input.exponent) ? input.exponent : DEFAULT_RIEGEL_EXPONENT;
  const riegel = riegelSeconds(input.timeSeconds, input.distanceKm, MARATHON_KM, exponent);
  const vdot = vdotFromRace(input.distanceKm, input.timeSeconds);
  const vdotSeconds = timeFromVdot(MARATHON_KM, vdot);
  const bufferSeconds = adjustmentSeconds(input);
  const nycSeconds = riegel + bufferSeconds;
  return {
    riegelSeconds: riegel,
    vdot,
    vdotSeconds,
    bufferSeconds,
    nycSeconds,
    paceSecPerMile: nycSeconds / MARATHON_MILES,
    paceSecPerKm: nycSeconds / MARATHON_KM,
  };
}

function effortFactorAt(km: number): number {
  if (km <= EFFORT_ANCHORS[0][0]) return EFFORT_ANCHORS[0][1];
  for (let i = 1; i < EFFORT_ANCHORS.length; i += 1) {
    const [x1, y1] = EFFORT_ANCHORS[i - 1];
    const [x2, y2] = EFFORT_ANCHORS[i];
    if (km <= x2) {
      const t = (km - x1) / (x2 - x1);
      return y1 + (y2 - y1) * t;
    }
  }
  return EFFORT_ANCHORS[EFFORT_ANCHORS.length - 1][1];
}

export function buildSplits(
  nycSeconds: number,
  mode: SplitMode,
  plan: EffortPlan = 'even-effort'
): SplitRow[] {
  if (nycSeconds <= 0) return [];
  const points = mode === '5k' ? FIVE_K_SPLITS : LANDMARK_SPLITS;
  const segments = points.map((point, index) => {
    const prevKm = index === 0 ? 0 : points[index - 1].km;
    const distanceKm = point.km - prevKm;
    const mid = (prevKm + point.km) / 2;
    const factor = plan === 'even-effort' ? effortFactorAt(mid) : 1;
    return { point, prevKm, distanceKm, mid, raw: distanceKm * factor };
  });

  const firstRaw = rawAcross(segments, 0, HALF_KM);
  const secondRaw = rawAcross(segments, HALF_KM, MARATHON_KM);
  const firstTarget = plan === 'even-effort' ? nycSeconds * EVEN_EFFORT_FIRST_HALF : nycSeconds * (HALF_KM / MARATHON_KM);
  const secondTarget = nycSeconds - firstTarget;
  const firstScale = firstRaw > 0 ? firstTarget / firstRaw : 0;
  const secondScale = secondRaw > 0 ? secondTarget / secondRaw : 0;

  let elapsed = 0;
  return segments.map(({ point, prevKm, distanceKm, raw }) => {
    const overlapFirst = Math.max(0, Math.min(point.km, HALF_KM) - prevKm);
    const overlapSecond = Math.max(0, point.km - Math.max(prevKm, HALF_KM));
    const firstPart = distanceKm > 0 ? raw * (overlapFirst / distanceKm) * firstScale : 0;
    const secondPart = distanceKm > 0 ? raw * (overlapSecond / distanceKm) * secondScale : 0;
    const splitSeconds = firstPart + secondPart;
    elapsed += splitSeconds;
    return {
      id: point.id,
      label: point.label,
      km: point.km,
      miles: milesFromKm(point.km),
      splitSeconds,
      elapsedSeconds: elapsed,
      paceSecPerKm: distanceKm > 0 ? splitSeconds / distanceKm : 0,
      paceSecPerMile: distanceKm > 0 ? splitSeconds / milesFromKm(distanceKm) : 0,
    };
  });
}

function rawAcross(
  segments: Array<{ prevKm: number; distanceKm: number; raw: number; point: { km: number } }>,
  fromKm: number,
  toKm: number
): number {
  return segments.reduce((sum, segment) => {
    const overlap = Math.min(segment.point.km, toKm) - Math.max(segment.prevKm, fromKm);
    if (overlap <= 0 || segment.distanceKm <= 0) return sum;
    return sum + segment.raw * (overlap / segment.distanceKm);
  }, 0);
}

export function defaultEstimateInput(overrides: Partial<EstimateInput> = {}): EstimateInput {
  return {
    distanceKm: DISTANCE_PRESETS_KM.half,
    timeSeconds: 1 * 3600 + 45 * 60,
    exponent: DEFAULT_RIEGEL_EXPONENT,
    course: { ...DEFAULT_COURSE },
    crowding: 'typical',
    weather: 'cool',
    training: 'consistent',
    ...overrides,
  };
}

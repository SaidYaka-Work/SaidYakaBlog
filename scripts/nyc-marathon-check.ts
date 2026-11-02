import assert from 'node:assert/strict';
import {
  DEFAULT_COURSE,
  DEFAULT_RIEGEL_EXPONENT,
  DISTANCE_PRESETS_KM,
  MARATHON_KM,
  MARATHON_MILES,
  TRAINING_SECONDS,
  adjustmentSeconds,
  buildSplits,
  defaultEstimateInput,
  estimateFinish,
  formatHms,
  formatPace,
  kmFromMiles,
  parseHms,
  riegelSeconds,
} from '../lib/nyc-marathon.ts';
import { splitPostEmbeds } from '../lib/post-embeds.ts';

const halfSeconds = parseHms(1, 45, 0);
assert.equal(halfSeconds, 6300);
assert.equal(formatHms(6300), '1:45:00');

const riegel = riegelSeconds(halfSeconds, DISTANCE_PRESETS_KM.half, MARATHON_KM, DEFAULT_RIEGEL_EXPONENT);
assert.equal(formatHms(riegel), '3:38:55', `Riegel napkin should be 3:38:55, got ${formatHms(riegel)}`);

const ratio = 2 ** 1.06;
assert.ok(ratio > 2.084 && ratio < 2.086, `2^1.06 should be about 2.085, got ${ratio}`);

const worked = estimateFinish(defaultEstimateInput());
assert.ok(worked, 'default estimate should be defined');
assert.equal(formatHms(worked.riegelSeconds), '3:38:55');
assert.equal(formatHms(worked.nycSeconds), '3:45:00', `1:45 half should predict 3:45 in NYC, got ${formatHms(worked.nycSeconds)}`);
assert.equal(formatPace(worked.paceSecPerMile), '8:35', `3:45 should be 8:35 / mile, got ${formatPace(worked.paceSecPerMile)}`);
assert.ok(
  Math.abs(worked.nycSeconds / MARATHON_MILES - (8 * 60 + 35)) < 1,
  'pace per mile should match the wrist-card number'
);

assert.ok(worked.vdot > 40 && worked.vdot < 45, `VDOT from a 1:45 half should sit near 42, got ${worked.vdot}`);
const vdotDelta = Math.abs(worked.vdotSeconds - worked.riegelSeconds);
assert.ok(vdotDelta < 180, `Daniels equivalent should sit near Riegel, delta ${vdotDelta}s`);

const strong = estimateFinish(defaultEstimateInput({ training: 'strong' }));
assert.ok(strong);
assert.equal(formatHms(strong.nycSeconds), '3:41:55');
assert.ok(strong.nycSeconds < worked.nycSeconds);

const thin = estimateFinish(defaultEstimateInput({ training: 'thin' }));
assert.ok(thin);
assert.ok(thin.nycSeconds > worked.nycSeconds);

const warm = estimateFinish(defaultEstimateInput({ weather: 'warm' }));
assert.ok(warm);
assert.equal(Math.round(warm.nycSeconds - worked.nycSeconds), 180);

const noCourse = estimateFinish(
  defaultEstimateInput({
    course: { bridges: false, firstAve: false, fifthAve: false, centralPark: false },
  })
);
assert.ok(noCourse);
assert.equal(Math.round(worked.nycSeconds - noCourse.nycSeconds), 120);

assert.equal(
  adjustmentSeconds({
    course: DEFAULT_COURSE,
    crowding: 'typical',
    weather: 'cool',
    training: 'consistent',
  }),
  120 + 60 + TRAINING_SECONDS.consistent
);

const fromMiles = estimateFinish(
  defaultEstimateInput({ distanceKm: kmFromMiles(13.109375) })
);
assert.ok(fromMiles);
assert.equal(formatHms(fromMiles.riegelSeconds), formatHms(worked.riegelSeconds));

const fiveK = estimateFinish(defaultEstimateInput());
assert.ok(fiveK);
const evenEffort = buildSplits(fiveK.nycSeconds, '5k', 'even-effort');
const evenClock = buildSplits(fiveK.nycSeconds, '5k', 'even-clock');
const landmarks = buildSplits(fiveK.nycSeconds, 'landmarks', 'even-effort');

assert.equal(evenEffort.at(-1)?.id, 'finish');
assert.equal(landmarks.at(-1)?.id, 'finish');
assert.ok(Math.abs((evenEffort.at(-1)?.elapsedSeconds ?? 0) - fiveK.nycSeconds) < 0.01);
assert.ok(Math.abs((landmarks.at(-1)?.elapsedSeconds ?? 0) - fiveK.nycSeconds) < 0.01);

const halfRow = landmarks.find((row) => row.id === 'half');
assert.ok(halfRow);
assert.ok(
  halfRow.elapsedSeconds > fiveK.nycSeconds * 0.5,
  'even-effort first half should be slightly slow'
);
assert.ok(
  Math.abs(halfRow.elapsedSeconds / fiveK.nycSeconds - 0.504) < 0.002,
  'even-effort half should sit near 50.4% of the goal'
);
const clockHalf = evenClock.find((row) => row.id === '20k');
assert.ok(clockHalf);

assert.equal(formatHms(0), '—');
assert.equal(formatHms(26 * 60 + 40), '26:40');
assert.equal(estimateFinish(defaultEstimateInput({ timeSeconds: 0 })), null);

const chunks = splitPostEmbeds('<p>before</p><!--post-embed:nyc-marathon-calculator--><p>after</p>');
assert.deepEqual(
  chunks.map((chunk) => chunk.type),
  ['html', 'embed', 'html']
);
assert.equal(chunks[1].type === 'embed' && chunks[1].id, 'nyc-marathon-calculator');

console.log('nyc-marathon-check: ok');

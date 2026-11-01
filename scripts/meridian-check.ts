import assert from 'node:assert/strict';
import {
  CITIES,
  EARTH_RADIUS_KM,
  GREAT_CIRCLE_EXPLAINER,
  LAUNCH_DATE,
  MAX_SCORE,
  MAX_TRIES,
  REGIONS,
  addUtcDays,
  angularDistance,
  compassPoint,
  dailyCity,
  dailyPuzzle,
  destinationPoint,
  filterCityChoices,
  findCityByGuess,
  formatBearing,
  formatKm,
  gradeFor,
  greatCircleKm,
  headingArcKm,
  initialBearing,
  interpolateGreatCircle,
  makeAttempt,
  makeResult,
  matchesCity,
  practicePuzzle,
  puzzleNumberForDate,
  rotationOrder,
  scoreAttempt,
  shareLines,
  starsFor,
  utcDate,
} from '../components/games/meridian/logic.ts';

assert.ok(CITIES.length >= 80, `need at least 80 cities, got ${CITIES.length}`);
assert.equal(puzzleNumberForDate(LAUNCH_DATE), 1);
assert.ok(GREAT_CIRCLE_EXPLAINER.length > 80);
assert.ok(EARTH_RADIUS_KM === 6371);

const ids = new Set(CITIES.map((city) => city.id));
assert.equal(ids.size, CITIES.length, 'city ids must be unique');

for (const city of CITIES) {
  assert.ok(city.lat >= -90 && city.lat <= 90, `${city.id} latitude`);
  assert.ok(city.lng >= -180 && city.lng <= 180, `${city.id} longitude`);
  assert.ok(city.fact.length > 40, `${city.id} fact`);
  assert.ok(REGIONS.includes(city.region), `${city.id} region`);
  assert.ok(city.name.trim().length >= 3, `${city.id} name`);
  assert.ok(city.country.trim().length >= 3, `${city.id} country`);
}

for (let i = 0; i < CITIES.length; i += 1) {
  for (let j = i + 1; j < CITIES.length; j += 1) {
    const km = greatCircleKm(CITIES[i], CITIES[j]);
    assert.ok(km > 70, `${CITIES[i].id} and ${CITIES[j].id} are only ${km.toFixed(1)} km apart`);
  }
}

const byId = Object.fromEntries(CITIES.map((city) => [city.id, city]));
const tokyo = byId.tokyo;
const nyc = byId['new-york'];
const london = byId.london;
const paris = byId.paris;
const sydney = byId.sydney;
const auckland = byId.auckland;
const quito = byId.quito;
assert.ok(tokyo && nyc && london && paris && sydney && auckland && quito);

const tokyoNyc = greatCircleKm(tokyo, nyc);
assert.ok(tokyoNyc > 10_700 && tokyoNyc < 11_000, `Tokyo–NYC ${tokyoNyc}`);
const parisLondon = greatCircleKm(paris, london);
assert.ok(parisLondon > 330 && parisLondon < 360, `Paris–London ${parisLondon}`);
const sydneyAuckland = greatCircleKm(sydney, auckland);
assert.ok(sydneyAuckland > 2_100 && sydneyAuckland < 2_220, `Sydney–Auckland ${sydneyAuckland}`);
assert.ok(Math.abs(quito.lat) < 0.3, 'Quito should sit near the equator');

const londonNyc = initialBearing(london, nyc);
assert.ok(londonNyc > 270 && londonNyc < 300, `London→NYC bearing ${londonNyc}`);
assert.equal(compassPoint(londonNyc), 'WNW');
const nycLondon = initialBearing(nyc, london);
assert.ok(nycLondon > 40 && nycLondon < 65, `NYC→London bearing ${nycLondon}`);
assert.equal(compassPoint(0), 'N');
assert.equal(compassPoint(90), 'E');
assert.equal(compassPoint(180), 'S');
assert.equal(compassPoint(270), 'W');

const mid = interpolateGreatCircle(london, nyc, 0.5);
assert.ok(mid.lat > 50, 'North Atlantic great circle should bulge north of both cities');
const back = destinationPoint(london, londonNyc, greatCircleKm(london, nyc));
assert.ok(Math.abs(back.lat - nyc.lat) < 0.4, 'destination should recover New York');
assert.ok(Math.abs(back.lng - nyc.lng) < 0.4);
assert.ok(headingArcKm(12_000) < 12_000 * 0.4);
assert.ok(headingArcKm(400) < 400);

assert.ok(findCityByGuess('NYC')?.id === 'new-york');
assert.ok(findCityByGuess('Bombay')?.id === 'mumbai');
assert.ok(findCityByGuess('Peking')?.id === 'beijing');
assert.ok(findCityByGuess('Saigon')?.id === 'ho-chi-minh');
assert.ok(findCityByGuess('Constantinople')?.id === 'istanbul');
assert.ok(matchesCity('new york', nyc));
assert.equal(filterCityChoices('san', 8).length > 0, true);
assert.ok(!filterCityChoices('zzzzzz', 8).length);

const first = dailyPuzzle(LAUNCH_DATE);
const again = dailyPuzzle(LAUNCH_DATE);
assert.equal(first.id, again.id, 'daily puzzles must be deterministic');
assert.equal(first.city.id, again.city.id);
assert.deepEqual({ lat: first.city.lat, lng: first.city.lng }, { lat: again.city.lat, lng: again.city.lng });
assert.equal(dailyCity(LAUNCH_DATE).id, first.id);

const seen = new Set<string>();
const order = rotationOrder();
assert.equal(order.length, CITIES.length);
let regionRepeats = 0;
for (let offset = 0; offset < CITIES.length; offset += 1) {
  const date = addUtcDays(LAUNCH_DATE, offset);
  const puzzle = dailyPuzzle(date);
  assert.ok(!seen.has(puzzle.id), `${date} repeats ${puzzle.id} inside one rotation`);
  seen.add(puzzle.id);
  assert.ok(ids.has(puzzle.id), `${date} produced unknown ${puzzle.id}`);
  assert.ok(puzzle.city.fact.length > 40);
  if (offset > 0) {
    const previous = dailyPuzzle(addUtcDays(LAUNCH_DATE, offset - 1));
    if (previous.city.region === puzzle.city.region) regionRepeats += 1;
  }
}
assert.ok(regionRepeats <= 4, `too many back-to-back regions: ${regionRepeats}`);
assert.equal(seen.size, CITIES.length, 'rotation should visit every city once');
assert.equal(dailyPuzzle(addUtcDays(LAUNCH_DATE, CITIES.length)).id, first.id, 'rotation should cycle');

const practice = practicePuzzle(42, LAUNCH_DATE);
assert.notEqual(practice.id, first.id, 'practice should avoid today’s city when it can');
assert.equal(practicePuzzle(42, LAUNCH_DATE).id, practice.id, 'practice seed must be deterministic');

const miss = makeAttempt(london, tokyo);
assert.ok(miss.km > 8_000);
assert.equal(miss.tone, 'far');
const hit = makeAttempt(tokyo, tokyo);
assert.equal(hit.tone, 'hit');
assert.ok(hit.km < 1);

assert.equal(scoreAttempt(1, true), MAX_SCORE);
assert.equal(scoreAttempt(6, true), 20);
assert.equal(scoreAttempt(6, false), 0);
assert.equal(starsFor(1, true), 5);
assert.equal(starsFor(6, false), 0);
assert.equal(gradeFor(1, true), 'first');
assert.equal(gradeFor(6, false), 'miss');
assert.equal(formatKm(0.2), '0 km');
assert.match(formatKm(1234), /1,234/);
assert.equal(formatBearing(47), '047°');

const lines = shareLines(
  makeResult(first, [miss, makeAttempt(first.city, first.city)], true),
  'daily',
  LAUNCH_DATE,
);
assert.equal(lines[0], 'Meridian #1');
assert.match(lines[1], /🟩/);
assert.match(lines[2], /★/);

assert.ok(angularDistance(london, nyc) * EARTH_RADIUS_KM > 5_000);
assert.equal(MAX_TRIES, 6);

const today = utcDate();
console.log(
  `meridian-ok bank=${CITIES.length} launch=${first.id} today=${dailyPuzzle(today).id} cycle=${CITIES.length}d`,
);

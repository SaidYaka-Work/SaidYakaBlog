import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { globeStepId, globeView } from '../components/games/unknown-number/globe.ts';
import {
  FIGURES,
  SUSPECT_POOL_SIZE,
  createDayState,
  eliminatedIds,
  figureForDate,
  filterFigureChoices,
  normalizeName,
  shareLines,
  suspectPool,
} from '../components/games/unknown-number/logic.ts';
import { LICENSES } from '../components/games/unknown-number/types.ts';

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function containsAlias(clue: string, aliases: string[]) {
  const hay = ` ${normalizeName(clue)} `;
  return aliases.some((alias) => {
    const needle = normalizeName(alias);
    if (needle.length < 3) return false;
    return hay.includes(` ${needle} `);
  });
}

assert.ok(FIGURES.length >= 120, `need at least 120 figures, got ${FIGURES.length}`);

const ids = new Set<string>();
for (const figure of FIGURES) {
  assert.ok(figure.id && !ids.has(figure.id), `duplicate or empty id ${figure.id}`);
  ids.add(figure.id);
  assert.equal(figure.clues.length, 6, `${figure.id} needs 6 clues`);
  assert.ok(figure.source, `${figure.id} needs a source`);
  assert.ok(/^https?:\/\//.test(figure.source), `${figure.id} source must be a URL`);
  assert.ok(figure.aliases.length > 0, `${figure.id} needs aliases`);
  assert.ok(figure.years, `${figure.id} needs years`);
  assert.ok(figure.field && figure.country, `${figure.id} needs field and country`);
  assert.equal(figure.story.length, 3, `${figure.id} needs 3 story paragraphs`);
    assert.ok(figure.voice && figure.contactEmoji, `${figure.id} needs voice and contact emoji`);
    assert.ok(figure.birthplace, `${figure.id} needs a birthplace`);
    assert.ok(figure.birthplace.name && figure.birthplace.country, `${figure.id} birthplace needs name and country`);
    assert.ok(
      Number.isFinite(figure.birthplace.lat) && figure.birthplace.lat >= -90 && figure.birthplace.lat <= 90,
      `${figure.id} lat ${figure.birthplace.lat} is out of range`,
    );
    assert.ok(
      Number.isFinite(figure.birthplace.lng) && figure.birthplace.lng >= -180 && figure.birthplace.lng <= 180,
      `${figure.id} lng ${figure.birthplace.lng} is out of range`,
    );
  const storyWords = figure.story.map(words).reduce((sum, count) => sum + count, 0);
  assert.ok(storyWords >= 90 && storyWords <= 240, `${figure.id} story words ${storyWords} should stay near 120–180`);
  const names = [figure.name, ...figure.aliases];
  figure.clues.forEach((clue, index) => {
    assert.ok(clue.trim().length > 20, `${figure.id} clue ${index + 1} is too short`);
    assert.equal(containsAlias(clue, names), false, `${figure.id} clue ${index + 1} contains a name/alias`);
  });
  if (figure.portrait) {
    assert.ok((LICENSES as readonly string[]).includes(figure.portrait.license), `${figure.id} license ${figure.portrait.license}`);
    assert.ok(figure.portrait.author, `${figure.id} portrait needs author`);
    assert.ok(figure.portrait.commonsUrl.includes('wikimedia.org') || figure.portrait.commonsUrl.includes('wikipedia.org'), `${figure.id} commons URL`);
    assert.ok(
      existsSync(resolve(process.cwd(), 'public', figure.portrait.path.replace(/^\//, ''))),
      `${figure.id} missing ${figure.portrait.path}`,
    );
  }
}

const fields = new Set(FIGURES.map((figure) => figure.field));
const countries = new Set(FIGURES.map((figure) => figure.country));
assert.ok(fields.size >= 12, `need a spread of fields, got ${fields.size}`);
assert.ok(countries.size >= 25, `need a global spread of countries, got ${countries.size}`);

const sampleDate = '2026-10-21';
const answer = figureForDate(sampleDate);
const pool = suspectPool(answer, sampleDate);
assert.equal(pool.length, SUSPECT_POOL_SIZE, 'suspect pool should be 16');
assert.ok(pool.some((figure) => figure.id === answer.id), 'pool must include the answer');
assert.deepEqual(
  pool.map((figure) => figure.id),
  suspectPool(answer, sampleDate).map((figure) => figure.id),
  'suspect pool must be deterministic for a date',
);
const later = suspectPool(figureForDate('2026-10-28'), '2026-10-28');
assert.equal(later.length, SUSPECT_POOL_SIZE);
const poolFields = new Set(pool.map((figure) => figure.field));
assert.ok(poolFields.size >= 3, `pool should mix fields, got ${poolFields.size}`);

const filtered = filterFigureChoices(answer.name.slice(0, 4), 8, pool, []);
assert.ok(filtered.some((figure) => figure.id === answer.id), 'pool-limited autocomplete should find the answer');
assert.equal(filterFigureChoices(answer.name, 8, pool, [answer.id]).length, 0, 'eliminated names stay out of autocomplete');

const day = createDayState(sampleDate);
assert.deepEqual(day.eliminated, []);
assert.deepEqual(
  eliminatedIds({ guesses: [{ text: pool.find((figure) => figure.id !== answer.id)!.name, correct: false }], eliminated: [] }),
  [pool.find((figure) => figure.id !== answer.id)!.id],
);

assert.equal(globeStepId(0), 'world');
assert.equal(globeStepId(5), 'city');
assert.equal(globeView(0, answer.birthplace, false).showHint, false);
assert.equal(globeView(1, answer.birthplace, false).showHint, true);
assert.equal(globeView(2, answer.birthplace, true).showPin, true);
assert.ok(shareLines(1, 'won', 3).join('\n').includes('3/6'));
assert.ok(shareLines(1, 'lost', 6, { globeStep: 5 }).join('\n').includes('🌍 city'));
assert.equal(shareLines(1, 'won', 1, { globeStep: 0 }).some((line) => /Warsaw|Poland/i.test(line)), false);

console.log(`unknown-number dataset ok: ${FIGURES.length} figures, ${fields.size} fields, ${countries.size} countries`);

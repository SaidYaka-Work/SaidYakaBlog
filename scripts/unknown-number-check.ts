import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIGURES, normalizeName } from '../components/games/unknown-number/logic.ts';
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
    assert.ok(existsSync(resolve(process.cwd(), figure.portrait.path.replace(/^\//, ''))), `${figure.id} missing ${figure.portrait.path}`);
  }
}

const fields = new Set(FIGURES.map((figure) => figure.field));
const countries = new Set(FIGURES.map((figure) => figure.country));
assert.ok(fields.size >= 12, `need a spread of fields, got ${fields.size}`);
assert.ok(countries.size >= 25, `need a global spread of countries, got ${countries.size}`);

console.log(`unknown-number dataset ok: ${FIGURES.length} figures, ${fields.size} fields, ${countries.size} countries`);

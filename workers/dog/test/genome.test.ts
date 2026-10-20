import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateGenome, generatePersonality, genomesEqual, lookFromGenome } from '../src/genome.ts';
import { DOG_NAMES, nameById, pickName } from '../src/names.ts';

test('the name list is large, unique, and wholesome-shaped', () => {
  assert.ok(DOG_NAMES.length >= 1000);
  const ids = new Set(DOG_NAMES.map((name) => name.id));
  const labels = new Set(DOG_NAMES.map((name) => name.label.toLowerCase()));
  assert.equal(ids.size, DOG_NAMES.length);
  assert.equal(labels.size, DOG_NAMES.length);
  for (const name of DOG_NAMES) {
    assert.match(name.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(name.label, /^[A-Za-z][A-Za-z' -]{0,15}$/);
    assert.ok(name.label.length >= 2 && name.label.length <= 16);
  }
  assert.ok(nameById('biscuit'));
  assert.equal(nameById('not-a-real-dog-name-xx'), null);
  const banned = [
    'crappie',
    'ugli',
    'navel',
    'tinder',
    'hooch',
    'napoleon',
    'reamer',
    'shroud',
    'seitan',
    'shackle',
  ];
  for (const word of banned) {
    assert.equal(labels.has(word), false, `unexpected name ${word}`);
  }
});

test('the same seed always yields the same genome and look', () => {
  const a = generateGenome('porch-seed-1');
  const b = generateGenome('porch-seed-1');
  const other = generateGenome('porch-seed-2');
  assert.equal(genomesEqual(a, b), true);
  assert.equal(genomesEqual(a, other), false);
  assert.deepEqual(lookFromGenome(a, 'puppy'), lookFromGenome(b, 'puppy'));
  assert.notEqual(lookFromGenome(a, 'puppy').scale, lookFromGenome(a, 'senior').scale);
  assert.ok(a.build !== other.build || a.snout !== other.snout || a.body !== other.body);
});

test('personalities are deterministic per seed and vary across seeds', () => {
  assert.equal(generatePersonality('voice-a'), generatePersonality('voice-a'));
  assert.notEqual(generatePersonality('voice-a'), generatePersonality('voice-b'));
});

test('pickName can avoid recent ids', () => {
  const avoid = DOG_NAMES.slice(0, 20).map((name) => name.id);
  const picked = pickName(() => 0, avoid);
  assert.equal(avoid.includes(picked.id), false);
});

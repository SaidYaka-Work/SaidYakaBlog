import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyCompanionEmote,
  applyCompanionHere,
  applyVisitorMove,
  createRoom,
  forgetVisitor,
  parseClientMessage,
  snapshot,
  welcomeCompanion,
} from '../src/logic.ts';
import {
  COMPANION_RADIUS,
  EMOTE_GAP_MS,
  EMOTE_MAX_PER_WINDOW,
  applyHere,
  clampNearDog,
  isEmote,
  publicCompanions,
  takeEmoteRate,
} from '../src/presence.ts';
import { LEASH_IDLE_MS, createYard, releaseLeash, tryAcquireLeash } from '../src/room.ts';

const T0 = Date.parse('2026-10-21T16:00:00Z');

test('preset emotes are allowlisted; free text and extra keys stay invalid', () => {
  assert.equal(parseClientMessage('{"type":"emote","kind":"wave"}').ok, true);
  assert.equal(parseClientMessage('{"type":"emote","kind":"heart"}').ok, true);
  assert.equal(parseClientMessage('{"type":"here","x":1,"z":-0.5}').ok, true);
  assert.equal(parseClientMessage('{"type":"emote","kind":"hello everyone"}').ok, false);
  assert.equal(parseClientMessage('{"type":"emote","kind":"wave","text":"hi"}').ok, false);
  assert.equal(parseClientMessage('{"type":"here","x":1,"z":0,"note":"no"}').ok, false);
  assert.equal(isEmote('clap'), true);
  assert.equal(isEmote('custom'), false);
  const oldMove = parseClientMessage('{"type":"move","ax":1,"az":0,"run":false}');
  assert.equal(oldMove.ok, true);
});

test('here is clamped near the dog and stale companions drop off the snapshot', () => {
  const dog = { x: 0, z: 0 };
  const far = clampNearDog(80, 0, dog);
  assert.ok(Math.hypot(far.x, far.z) <= COMPANION_RADIUS + 1e-6);
  const map = applyHere({}, 'aaa', 80, 0, dog, T0);
  assert.ok(Math.hypot(map.aaa.x, map.aaa.z) <= COMPANION_RADIUS + 0.05);
  const live = publicCompanions(map, dog, T0 + 20_000);
  assert.equal(live.length, 0);
});

test('emote rate limit is per visitor', () => {
  const first = takeEmoteRate(undefined, T0);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error('expected first emote');
  const burst = takeEmoteRate(first.bucket, T0 + 200);
  assert.equal(burst.ok, false);
  if (burst.ok) throw new Error('expected gap');
  let bucket = first.bucket;
  for (let i = 1; i < EMOTE_MAX_PER_WINDOW; i += 1) {
    const next = takeEmoteRate(bucket, T0 + i * (EMOTE_GAP_MS + 10));
    assert.equal(next.ok, true);
    if (!next.ok) throw new Error('expected window room');
    bucket = next.bucket;
  }
  const capped = takeEmoteRate(bucket, T0 + EMOTE_MAX_PER_WINDOW * (EMOTE_GAP_MS + 10));
  assert.equal(capped.ok, false);
});

test('busy visitors join a FIFO queue and release hands the leash to the next', () => {
  const a = tryAcquireLeash(createYard(T0), 'alice', '10.0.0.1', T0);
  assert.equal(a.ok, true);
  if (!a.ok) throw new Error('alice');
  const b = tryAcquireLeash(a.yard, 'bob', '10.0.0.2', T0 + 100);
  assert.equal(b.ok, false);
  assert.equal(b.yard.leash.queue.map((wait) => wait.id).join(','), 'bob');
  const c = tryAcquireLeash(b.yard, 'cara', '10.0.0.3', T0 + 200);
  assert.equal(c.yard.leash.queue.map((wait) => wait.id).join(','), 'bob,cara');
  const handed = releaseLeash(c.yard, T0 + 300);
  assert.equal(handed.leash.holderId, 'bob');
  assert.equal(handed.leash.queue.map((wait) => wait.id).join(','), 'cara');
  const snap = snapshot({ ...createRoom(T0), yard: handed }, T0 + 300, 3);
  assert.equal(snap.leash?.holderId, 'bob');
  assert.deepEqual(snap.leash?.queue, ['cara']);
  assert.equal(snap.leash?.nextId, 'cara');
});

test('idle expiry still handoffs to the queued visitor, not a later press', () => {
  const room = createRoom(T0);
  const alice = applyVisitorMove(room, 'alice', '10.0.0.1', 1, 0, false, 0.1, T0);
  const bob = applyVisitorMove(alice.room, 'bob', '10.0.0.2', 0, 1, false, 0.1, T0 + 200);
  assert.equal(bob.acquired, false);
  assert.deepEqual(bob.room.yard?.leash.queue.map((wait) => wait.id), ['bob']);
  const later = applyVisitorMove(bob.room, 'cara', '10.0.0.3', 1, 0, false, 0.1, T0 + 200 + LEASH_IDLE_MS);
  assert.equal(later.acquired, false);
  assert.equal(later.room.yard?.leash.holderId, 'bob');
});

test('companions are additive and older snapshots without them still parse', () => {
  const room = welcomeCompanion(createRoom(T0), 'alice', T0);
  const here = applyCompanionHere(room, 'bob', 2, 1, T0 + 50);
  const waved = applyCompanionEmote(here, 'bob', 'wave', T0 + 80);
  const snap = snapshot(waved, T0 + 80, 2);
  assert.ok(Array.isArray(snap.companions));
  assert.ok(snap.companions?.some((guest) => guest.id === 'bob' && guest.emote === 'wave'));
  const forgotten = forgetVisitor(waved, 'bob', T0 + 90, ['alice']);
  const after = snapshot(forgotten, T0 + 90, 1);
  assert.equal(after.companions?.some((guest) => guest.id === 'bob'), false);
  const legacy = snapshot({ ...createRoom(T0), companions: undefined }, T0, 1);
  assert.ok(legacy.leash);
  assert.ok('companions' in legacy);
  assert.equal(legacy.location === undefined || typeof legacy.location.mode === 'string', true);
});

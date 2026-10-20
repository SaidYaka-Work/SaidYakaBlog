import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CATCH_MIN_SCORE,
  FEED_EVERY_MS,
  FEED_MIN_GAP_MS,
  LOW_HAPPINESS,
  PROFILES,
  RUNAWAY_AFTER_MS,
  STAGE_AT_MS,
  WALK_EVERY_MS,
  applyCare,
  applyCatch,
  applyDecay,
  applyPet,
  canStartCare,
  canStartCatch,
  careFor,
  careView,
  createDog,
  createRoom,
  dogStage,
  fanout,
  listHistory,
  originAllowed,
  parseClientMessage,
  pickProfile,
  takeConnectionGap,
  takeRate,
  toRecord,
  validateFinish,
} from '../src/logic.ts';

const T0 = Date.parse('2026-10-20T12:00:00Z');

test('createRoom starts with Biscuit at home and clocks at now', () => {
  const room = createRoom(T0);
  assert.equal(room.dog?.profile.name, 'Biscuit');
  assert.equal(room.dog?.lastFedAt, T0);
  assert.equal(room.dog?.lastWalkedAt, T0);
  assert.equal(room.memorial, null);
});

test('feed becomes overdue after an hour and walk after three', () => {
  const dog = createDog(PROFILES[0], T0);
  const hour = careView(dog, T0 + FEED_EVERY_MS);
  assert.equal(hour.feedOverdue, true);
  assert.equal(hour.walkOverdue, false);
  const later = careView(dog, T0 + WALK_EVERY_MS);
  assert.equal(later.walkOverdue, true);
  assert.ok(later.hunger > 70);
  assert.ok(later.walkNeed > 50);
});

test('neglect drops happiness faster when meals and walks are late', () => {
  const room = createRoom(T0);
  const neglected = applyDecay(room, T0 + 5 * 60 * 60 * 1000);
  const fed = applyDecay(
    {
      ...room,
      dog: room.dog
        ? { ...room.dog, lastFedAt: T0 + 4.5 * 60 * 60 * 1000, lastWalkedAt: T0 + 4.5 * 60 * 60 * 1000 }
        : null,
    },
    T0 + 5 * 60 * 60 * 1000,
  );
  assert.ok(neglected.dog);
  assert.ok(fed.dog);
  assert.ok(neglected.dog.happiness < fed.dog.happiness);
});

test('happiness staying low for three days makes the dog run away', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.happiness = LOW_HAPPINESS - 1;
  room.dog.lowSince = T0;
  const almost = applyDecay(room, T0 + RUNAWAY_AFTER_MS - 1000);
  assert.ok(almost.dog, 'still home an hour before the deadline');
  const gone = applyDecay(almost, T0 + RUNAWAY_AFTER_MS);
  assert.equal(gone.dog, null);
  assert.ok(gone.memorial);
  assert.equal(gone.memorial?.profile.name, 'Biscuit');
  assert.equal(gone.history.length, 1);
  assert.equal(gone.history[0].daysSurvived, 3);
});

test('recovering happiness clears the runaway clock', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.happiness = 10;
  room.dog.lowSince = T0;
  const afterFeed = applyCare(room, 'feed', 90, T0 + FEED_MIN_GAP_MS);
  assert.equal(afterFeed.ok, true);
  if (!afterFeed.ok || !afterFeed.room.dog) throw new Error('expected dog');
  assert.equal(afterFeed.room.dog.lowSince, null);
  const later = applyDecay(afterFeed.room, T0 + RUNAWAY_AFTER_MS + 60_000);
  assert.ok(later.dog, 'a cared-for dog does not run away');
});

test('catching requires a plausible score and births a new dog', () => {
  let room = createRoom(T0);
  assert.ok(room.dog);
  room = {
    dog: null,
    memorial: toRecord(room.dog, T0 + RUNAWAY_AFTER_MS, 'ran_away'),
    history: [toRecord(room.dog, T0 + RUNAWAY_AFTER_MS, 'ran_away')],
    lastCatchAt: 0,
  };
  const miss = applyCatch(room, CATCH_MIN_SCORE - 1, T0 + 1_000);
  assert.equal(miss.ok, false);
  if (miss.ok) throw new Error('expected miss');
  assert.equal(miss.code, 'missed');

  const caught = applyCatch(room, 80, T0 + 20_000, () => 0);
  assert.equal(caught.ok, true);
  if (!caught.ok) throw new Error('expected catch');
  assert.ok(caught.room.dog);
  assert.notEqual(caught.room.dog.profile.id, 'biscuit');
  assert.equal(caught.room.memorial, null);
});

test('cannot start a walk while the dog is gone or asleep', () => {
  const empty = { dog: null, memorial: null, history: [], lastCatchAt: 0 };
  const gone = canStartCare(empty, 'walk', T0);
  assert.equal(gone.ok, false);

  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.asleep = true;
  room.dog.energy = 20;
  const asleep = canStartCare(room, 'walk', T0 + 10 * 60 * 1000);
  assert.equal(asleep.ok, false);
  if (asleep.ok) throw new Error('expected asleep');
  assert.equal(asleep.code, 'asleep');
});

test('catch is rejected while a dog is still home', () => {
  const result = canStartCatch(createRoom(T0), T0);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected home');
  assert.equal(result.code, 'home');
});

test('petting is a simple cooldown-gated action', () => {
  const room = createRoom(T0);
  const first = applyPet(room, T0);
  assert.equal(first.ok, true);
  const again = applyPet(first.ok ? first.room : room, T0 + 500);
  assert.equal(again.ok, false);
  if (again.ok) throw new Error('expected cooldown');
  assert.equal(again.code, 'cooldown');
});

test('care games reject instant or overlong finishes', () => {
  assert.equal(validateFinish('feed', T0, 80, T0 + 1_000), 'invalid');
  assert.equal(validateFinish('walk', T0, 80, T0 + 9_000), null);
  assert.equal(validateFinish('catch', T0, 101, T0 + 10_000), 'invalid');
  assert.equal(validateFinish('feed', T0, 50, T0 + 8_000), null);
});

test('better walk scores grant more miles and happiness', () => {
  const room = createRoom(T0);
  const weak = applyCare(room, 'walk', 10, T0 + WALK_EVERY_MS);
  const strong = applyCare(room, 'walk', 100, T0 + WALK_EVERY_MS);
  assert.ok(weak.ok && strong.ok && weak.room.dog && strong.room.dog);
  assert.ok(strong.room.dog.totals.miles > weak.room.dog.totals.miles);
  assert.ok(strong.room.dog.happiness > weak.room.dog.happiness);
});

test('rate limits: connection gap and per-IP window', () => {
  const gap = takeConnectionGap(T0, T0 + 200);
  assert.equal(gap.ok, false);
  const ok = takeConnectionGap(T0, T0 + 1_300);
  assert.equal(ok.ok, true);

  let bucket;
  for (let i = 0; i < 20; i += 1) {
    const taken = takeRate(bucket, T0 + i * 1_500);
    assert.equal(taken.ok, true);
    bucket = taken.bucket;
  }
  const blocked = takeRate(bucket, T0 + 21 * 1_500);
  assert.equal(blocked.ok, false);
});

test('messages allow only fixed actions, no free text', () => {
  assert.equal(parseClientMessage('{"type":"hello"}').ok, true);
  assert.equal(parseClientMessage('{"type":"action","action":"pet"}').ok, true);
  assert.equal(parseClientMessage('{"type":"start","game":"feed"}').ok, true);
  assert.equal(parseClientMessage('{"type":"finish","playId":"abc-123-def","score":40}').ok, true);
  assert.equal(parseClientMessage('{"type":"action","action":"pet","note":"hi"}').ok, false);
  assert.equal(parseClientMessage('{"type":"chat","text":"hello dog"}').ok, false);
});

test('broadcast fans the same payload to every client', () => {
  const inbox: string[] = [];
  const payload = { type: 'event', text: 'Someone just petted Biscuit.' };
  fanout([{ send: (data) => inbox.push(data) }, { send: (data) => inbox.push(data) }], payload);
  assert.equal(inbox.length, 2);
  assert.equal(inbox[0], inbox[1]);
  assert.equal(JSON.parse(inbox[0]).text, payload.text);
});

test('CORS allowlist is limited to the site and localhost', () => {
  assert.equal(originAllowed('https://saidyaka.com'), true);
  assert.equal(originAllowed('http://localhost:3000'), true);
  assert.equal(originAllowed('https://evil.example'), false);
  assert.equal(originAllowed(null), false);
});

test('pickProfile can avoid the previous dog', () => {
  const next = pickProfile('biscuit', () => 0);
  assert.notEqual(next.id, 'biscuit');
});

function keepCared(room: ReturnType<typeof createRoom>, now: number) {
  if (!room.dog) return room;
  return {
    ...room,
    dog: {
      ...room.dog,
      lastFedAt: now - 60_000,
      lastWalkedAt: now - 60_000,
      happiness: 80,
    },
  };
}

test('dogs start as puppies and grow through stages with injectable time', () => {
  const room = createRoom(T0);
  assert.equal(dogStage(room.dog!), 'puppy');
  const aged = {
    ...room,
    dog: { ...room.dog!, biologicalAgeMs: STAGE_AT_MS.young - 500 },
  };
  const t1 = T0 + 2_000;
  const young = applyDecay(keepCared(aged, t1), t1);
  assert.equal(dogStage(young.dog!), 'young');
  assert.equal(young.dog?.furthestStage, 'young');
  young.dog!.biologicalAgeMs = STAGE_AT_MS.adult;
  assert.equal(dogStage(young.dog!), 'adult');
  young.dog!.biologicalAgeMs = STAGE_AT_MS.senior;
  assert.equal(dogStage(young.dog!), 'senior');
});

test('good care grows a dog faster than neglect', () => {
  const room = createRoom(T0);
  const later = T0 + 36 * 60 * 60 * 1000;
  const neglected = applyDecay(room, later);
  const cared = applyDecay(
    {
      ...room,
      dog: room.dog
        ? {
            ...room.dog,
            lastFedAt: later - 10 * 60 * 1000,
            lastWalkedAt: later - 10 * 60 * 1000,
            happiness: 80,
          }
        : null,
    },
    later,
  );
  assert.ok(cared.dog && neglected.dog);
  assert.ok(cared.dog.biologicalAgeMs > neglected.dog.biologicalAgeMs);
});

test('care cadence is shorter for puppies than seniors', () => {
  const puppy = createDog(PROFILES[0], T0);
  const senior = { ...puppy, biologicalAgeMs: STAGE_AT_MS.senior, furthestStage: 'senior' as const };
  const puppyCare = careView(puppy, T0);
  const seniorCare = careView(senior, T0);
  assert.ok(careFor('puppy').walkEveryMs < careFor('adult').walkEveryMs);
  assert.ok(careFor('puppy').feedEveryMs < careFor('senior').feedEveryMs);
  assert.ok(careFor('young').walkSpeed > careFor('senior').walkSpeed);
  assert.equal(puppyCare.walkHint.includes('Puppies'), true);
  assert.equal(seniorCare.walkHint.includes('Seniors'), true);
  assert.equal(careView(puppy, T0 + careFor('puppy').walkEveryMs).walkOverdue, true);
  assert.equal(careView(senior, T0 + careFor('puppy').walkEveryMs).walkOverdue, false);
});

test('over-walking a senior costs energy and happiness', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.biologicalAgeMs = STAGE_AT_MS.senior;
  room.dog.furthestStage = 'senior';
  room.dog.lastWalkedAt = T0 - 30 * 60 * 1000;
  const before = room.dog.happiness;
  const result = applyCare(room, 'walk', 95, T0 + careFor('senior').walkMinGapMs);
  assert.equal(result.ok, true);
  if (!result.ok || !result.room.dog) throw new Error('expected walk');
  assert.ok(result.room.dog.happiness < before);
  assert.match(result.event.text, /too much|tired/i);
});

test('history records persist stage, peaks, and how they left', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.happiness = 10;
  room.dog.lowSince = T0;
  room.dog.biologicalAgeMs = STAGE_AT_MS.young;
  room.dog.furthestStage = 'young';
  room.dog.totals.walks = 4;
  room.dog.totals.miles = 1.2;
  room.dog.peakHappiness = 91;
  const gone = applyDecay(room, T0 + RUNAWAY_AFTER_MS);
  assert.equal(gone.history.length, 1);
  const record = gone.history[0];
  assert.equal(record.departed, 'ran_away');
  assert.equal(record.furthestStage, 'young');
  assert.equal(record.peakHappiness, 91);
  assert.equal(record.totals.walks, 4);
  assert.equal(record.leftAt, T0 + RUNAWAY_AFTER_MS);
  const page = listHistory(gone, 0, 10);
  assert.equal(page.total, 1);
  assert.equal(page.leaders.mostWalked?.profile.name, 'Biscuit');
  assert.equal(page.leaders.longestLived?.daysSurvived, 3);
});


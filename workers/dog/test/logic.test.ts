import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BISCUIT_PERSONALITY,
  BISCUIT_SEED,
  CATCH_MIN_SCORE,
  DOG_NAMES,
  FEED_EVERY_MS,
  FEED_MIN_GAP_MS,
  LOW_HAPPINESS,
  NAME_WINDOW_MS,
  PROFILES,
  RUNAWAY_AFTER_MS,
  STAGE_AT_MS,
  STAGES,
  WALK_EVERY_MS,
  WALK_GAME,
  applyCare,
  applyCatch,
  applyDecay,
  applyName,
  applyPet,
  canStartCare,
  canStartCatch,
  careFor,
  careView,
  createDog,
  createRoom,
  dailyMeals,
  dailyWalkGameMs,
  dogStage,
  fanout,
  generateGenome,
  listHistory,
  migrateRoom,
  nameById,
  originAllowed,
  parseClientMessage,
  snapshot,
  takeConnectionGap,
  takeRate,
  toRecord,
  validateFinish,
  walkNeedFrom,
} from '../src/logic.ts';

const T0 = Date.parse('2026-10-20T12:00:00Z');

test('createRoom starts with Biscuit at home and clocks at now', () => {
  const room = createRoom(T0);
  assert.equal(room.dog?.profile.name, 'Biscuit');
  assert.equal(room.dog?.lastFedAt, T0);
  assert.equal(room.dog?.lastWalkedAt, T0);
  assert.equal(room.memorial, null);
});

test('a new puppy is overdue on the puppy meal and walk clocks', () => {
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
    pendingName: null,
  };
  const miss = applyCatch(room, CATCH_MIN_SCORE - 1, T0 + 1_000);
  assert.equal(miss.ok, false);
  if (miss.ok) throw new Error('expected miss');
  assert.equal(miss.code, 'missed');

  const caught = applyCatch(room, 80, T0 + 20_000, () => 0);
  assert.equal(caught.ok, true);
  if (!caught.ok) throw new Error('expected catch');
  assert.ok(caught.room.dog);
  assert.equal(caught.room.dog.profile.name, '');
  assert.ok(caught.room.dog.genome);
  assert.ok(caught.room.pendingName);
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
  assert.equal(validateFinish('walk', T0, 80, T0 + 5_000), null);
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

test('messages allow a list name id and reject free-text names', () => {
  assert.equal(parseClientMessage('{"type":"name","nameId":"biscuit"}').ok, true);
  assert.equal(parseClientMessage('{"type":"name","name":"Biscuit"}').ok, false);
  assert.equal(parseClientMessage('{"type":"name","nameId":"biscuit","note":"hi"}').ok, false);
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

test('care cadence and walk feel come from one stage config', () => {
  const puppy = createDog(PROFILES[0], T0);
  const senior = { ...puppy, biologicalAgeMs: STAGE_AT_MS.senior, furthestStage: 'senior' as const };
  const puppyCare = careView(puppy, T0);
  const seniorCare = careView(senior, T0);

  assert.ok(careFor('puppy').walkEveryMs < careFor('adult').walkEveryMs);
  assert.ok(careFor('puppy').feedEveryMs < careFor('senior').feedEveryMs);
  assert.ok(careFor('puppy').walkGameMs < careFor('young').walkGameMs);
  assert.ok(careFor('senior').walkGameMs < careFor('adult').walkGameMs);
  assert.ok(careFor('young').walkSpeed > careFor('senior').walkSpeed);
  assert.ok(careFor('young').walkRockChance > careFor('senior').walkRockChance);
  assert.ok(careFor('young').walkSpawnMs < careFor('puppy').walkSpawnMs);
  assert.ok(careFor('puppy').feedDrops < careFor('adult').feedDrops);
  assert.equal(puppyCare.walkHint.includes('Puppies'), true);
  assert.equal(seniorCare.walkHint.includes('Seniors'), true);
  assert.match(puppyCare.ageNote, /Puppies need short walks often/);
  assert.match(seniorCare.ageNote, /Seniors need fewer/);
  assert.equal(puppyCare.walkGameMs, careFor('puppy').walkGameMs);
  assert.equal(puppyCare.walkSpeed, careFor('puppy').walkSpeed);
  assert.equal(puppyCare.walkSpawnMs, careFor('puppy').walkSpawnMs);
  assert.equal(puppyCare.feedDrops, careFor('puppy').feedDrops);
  assert.equal(careView(puppy, T0 + careFor('puppy').walkEveryMs).walkOverdue, true);
  assert.equal(careView(senior, T0 + careFor('puppy').walkEveryMs).walkOverdue, false);
});

test('young and adult dogs ask for the most total exercise', () => {
  assert.ok(dailyWalkGameMs('young') > dailyWalkGameMs('adult'));
  assert.ok(dailyWalkGameMs('adult') > dailyWalkGameMs('puppy'));
  assert.ok(dailyWalkGameMs('puppy') > dailyWalkGameMs('senior'));
  assert.ok(dailyMeals('puppy') > dailyMeals('adult'));
  assert.ok(dailyMeals('adult') > dailyMeals('senior'));
  assert.ok(careFor('young').walkEnergyDrainPerHour > careFor('adult').walkEnergyDrainPerHour);
  assert.ok(careFor('adult').walkEnergyDrainPerHour > careFor('puppy').walkEnergyDrainPerHour);
  assert.ok(careFor('puppy').walkEnergyDrainPerHour > careFor('senior').walkEnergyDrainPerHour);
});

test('puppy walk need rises faster than a senior on the same clock', () => {
  const puppy = createDog(PROFILES[0], T0);
  const senior = { ...puppy, biologicalAgeMs: STAGE_AT_MS.senior, furthestStage: 'senior' as const };
  const later = T0 + careFor('puppy').walkEveryMs;
  assert.ok(walkNeedFrom(puppy, later) > walkNeedFrom(senior, later));
});

test('young dogs lose waking energy faster than seniors', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  const later = T0 + 3 * 60 * 60 * 1000;
  const young = applyDecay(
    {
      ...room,
      dog: { ...room.dog, biologicalAgeMs: STAGE_AT_MS.young, furthestStage: 'young', energy: 80, asleep: false },
    },
    later,
  );
  const senior = applyDecay(
    {
      ...room,
      dog: { ...room.dog, biologicalAgeMs: STAGE_AT_MS.senior, furthestStage: 'senior', energy: 80, asleep: false },
    },
    later,
  );
  assert.ok(young.dog && senior.dog);
  assert.ok(young.dog.energy < senior.dog.energy);
});

test('over-walking a senior costs energy and happiness even when a walk is due', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.biologicalAgeMs = STAGE_AT_MS.senior;
  room.dog.furthestStage = 'senior';
  room.dog.lastWalkedAt = T0 - careFor('senior').walkEveryMs;
  const before = { happiness: room.dog.happiness, energy: room.dog.energy };
  const result = applyCare(room, 'walk', 95, T0);
  assert.equal(result.ok, true);
  if (!result.ok || !result.room.dog) throw new Error('expected walk');
  assert.ok(result.room.dog.happiness < before.happiness);
  assert.ok(result.room.dog.energy < before.energy);
  assert.match(result.event.text, /too much|tired/i);
});

test('a gentle senior walk still helps', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.biologicalAgeMs = STAGE_AT_MS.senior;
  room.dog.furthestStage = 'senior';
  room.dog.lastWalkedAt = T0 - careFor('senior').walkEveryMs;
  const before = room.dog.happiness;
  const result = applyCare(room, 'walk', 40, T0);
  assert.equal(result.ok, true);
  if (!result.ok || !result.room.dog) throw new Error('expected walk');
  assert.ok(result.room.dog.happiness > before);
});

test('a hard young walk does not count as over-walking', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.biologicalAgeMs = STAGE_AT_MS.young;
  room.dog.furthestStage = 'young';
  room.dog.lastWalkedAt = T0 - careFor('young').walkEveryMs;
  const before = room.dog.happiness;
  const result = applyCare(room, 'walk', 100, T0);
  assert.equal(result.ok, true);
  if (!result.ok || !result.room.dog) throw new Error('expected walk');
  assert.ok(result.room.dog.happiness > before);
});

test('every stage walk fits the finish window and exposes UI copy', () => {
  for (const stage of STAGES) {
    const care = careFor(stage);
    assert.ok(care.walkGameMs >= WALK_GAME.minMs);
    assert.ok(care.walkGameMs <= WALK_GAME.maxMs);
    assert.ok(care.walkHint.length > 0);
    assert.ok(care.mealHint.length > 0);
    assert.ok(care.ageNote.length > 0);
    assert.ok(care.walkCaption.length > 0);
  }
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
  assert.ok(record.genome);
  assert.equal(record.namedByCatcher, false);
});

test('Biscuit migration keeps name and personality and adds a stable genome', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  const stripped = {
    ...room,
    dog: { ...room.dog, genome: undefined as never, namedByCatcher: undefined as never },
  };
  const first = migrateRoom(stripped);
  const second = migrateRoom(first);
  assert.ok(first.dog);
  assert.equal(first.dog.profile.name, 'Biscuit');
  assert.equal(first.dog.profile.personality, BISCUIT_PERSONALITY);
  assert.deepEqual(first.dog.genome, generateGenome(BISCUIT_SEED));
  assert.deepEqual(second.dog?.genome, first.dog.genome);
  assert.equal(first.dog.namedByCatcher, false);
});

test('catcher can name from the list; others and unknown ids are rejected', () => {
  let room = createRoom(T0);
  assert.ok(room.dog);
  room = {
    dog: null,
    memorial: toRecord(room.dog, T0, 'ran_away'),
    history: [toRecord(room.dog, T0, 'ran_away')],
    lastCatchAt: 0,
    pendingName: null,
  };
  const caught = applyCatch(room, 90, T0 + 20_000, () => 0.2);
  assert.equal(caught.ok, true);
  if (!caught.ok) throw new Error('expected catch');
  const token = caught.nameToken;
  const publicState = snapshot(caught.room, T0 + 20_000, 2);
  assert.equal(publicState.awaitingName, true);
  assert.equal(JSON.stringify(publicState).includes(token), false);
  assert.ok(publicState.usedNameIds.includes('biscuit'));

  const stranger = applyName(caught.room, 'maple', 'wrong-token', T0 + 21_000);
  assert.equal(stranger.ok, false);
  if (stranger.ok) throw new Error('expected not_catcher');
  assert.equal(stranger.code, 'not_catcher');

  const missing = applyName(caught.room, 'not-a-real-dog-name-xx', token, T0 + 21_000);
  assert.equal(missing.ok, false);
  if (missing.ok) throw new Error('expected invalid');
  assert.equal(missing.code, 'invalid');
  assert.ok(missing.room.pendingName);

  const reused = applyName(caught.room, 'biscuit', token, T0 + 21_000);
  assert.equal(reused.ok, false);
  if (reused.ok) throw new Error('expected invalid reused name');
  assert.equal(reused.code, 'invalid');
  assert.ok(reused.room.pendingName);

  const named = applyName(caught.room, 'maple', token, T0 + 21_000);
  assert.equal(named.ok, true);
  if (!named.ok || !named.room.dog) throw new Error('expected name');
  assert.equal(named.room.dog.profile.name, nameById('maple')?.label);
  assert.equal(named.room.dog.namedByCatcher, true);
  assert.equal(named.room.pendingName, null);
  assert.match(named.event.text, /named him Maple/i);

  const again = applyName(named.room, 'pebble', token, T0 + 22_000);
  assert.equal(again.ok, false);
  if (again.ok) throw new Error('expected named');
  assert.equal(again.code, 'named');
});

test('naming timeout falls back to a random list name', () => {
  let room = createRoom(T0);
  assert.ok(room.dog);
  room = {
    dog: null,
    memorial: toRecord(room.dog, T0, 'ran_away'),
    history: [toRecord(room.dog, T0, 'ran_away')],
    lastCatchAt: 0,
    pendingName: null,
  };
  const caught = applyCatch(room, 90, T0 + 20_000, () => 0.4);
  assert.equal(caught.ok, true);
  if (!caught.ok) throw new Error('expected catch');
  const later = applyDecay(caught.room, T0 + 20_000 + NAME_WINDOW_MS);
  assert.ok(later.dog);
  assert.ok(later.dog.profile.name);
  assert.ok(DOG_NAMES.some((name) => name.label === later.dog?.profile.name));
  assert.notEqual(later.dog.profile.id, 'biscuit');
  assert.equal(later.dog.namedByCatcher, false);
  assert.equal(later.pendingName, null);
  const late = applyName(caught.room, 'maple', caught.nameToken, T0 + 20_000 + NAME_WINDOW_MS);
  assert.equal(late.ok, false);
  if (late.ok) throw new Error('expected too_late');
  assert.equal(late.code, 'too_late');
  assert.ok(late.room.dog?.profile.name);
});



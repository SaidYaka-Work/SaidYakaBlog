import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyBowlAction,
  applyCatch,
  applyCompanionEmote,
  applyCompanionHere,
  applyName,
  applyPet,
  applyWorldAction,
  createRoom,
  toRecord,
  welcomeCompanion,
} from '../src/logic.ts';
import {
  FAST_ALARM_MS,
  IDLE_ALARM_MS,
  PERSIST_MIN_MS,
  RoomSession,
  WRITE_BUDGET_MAX_ROWS,
  flushIfNeeded,
  persistReason,
  scheduleAlarm,
  shouldReplaceAlarm,
  shouldWrite,
  type PersistStorage,
} from '../src/persist.ts';
import { RUNAWAY_AFTER_MS } from '../src/logic.ts';

const T0 = Date.parse('2026-10-20T12:00:00Z');
const DAY_MS = 86_400_000;

class MemoryStorage implements PersistStorage {
  map = new Map<string, unknown>();
  rows = 0;
  puts = 0;
  alarms = 0;
  alarmAt: number | null = null;

  async get<T>(key: string) {
    return this.map.get(key) as T | undefined;
  }

  async put(entries: Record<string, unknown>) {
    this.puts += 1;
    for (const [key, value] of Object.entries(entries)) {
      this.map.set(key, value);
      this.rows += 1;
    }
  }

  async getAlarm() {
    return this.alarmAt;
  }

  async setAlarm(at: number) {
    this.alarms += 1;
    this.alarmAt = at;
  }
}

test('persistReason only flags meaningful care, life, and travel events', () => {
  const room = createRoom(T0);
  assert.equal(persistReason(room, room), null);
  assert.equal(persistReason(room, { ...room, yard: { ...room.yard!, pose: { ...room.yard!.pose, x: 1 } } }), null);

  const fed = { ...room, dog: { ...room.dog!, lastFedAt: T0 + 1, totals: { ...room.dog!.totals, feeds: 1 } } };
  assert.equal(persistReason(room, fed), 'feed');

  const pet = {
    ...room,
    dog: { ...room.dog!, lastPettedAt: T0 + 1, totals: { ...room.dog!.totals, pets: 1 } },
  };
  assert.equal(persistReason(room, pet), 'pet');

  const walked = { ...room, dog: { ...room.dog!, lastWalkedAt: T0 + 1, totals: { ...room.dog!.totals, walks: 1 } } };
  assert.equal(persistReason(room, walked), 'walk');

  const grown = { ...room, dog: { ...room.dog!, furthestStage: 'young' as const } };
  assert.equal(persistReason(room, grown), 'stage');

  const gone = { ...room, dog: null, memorial: toRecord(room.dog!, T0, 'ran_away'), history: [] };
  assert.equal(persistReason(room, gone), 'runaway');
  assert.equal(persistReason(gone, room), 'catch');

  const named = { ...room, dog: { ...room.dog!, profile: { ...room.dog!.profile, name: 'Mochi' } } };
  assert.equal(persistReason(room, named), 'name');
});

test('reads and connects never write unless a meaningful life event happened', () => {
  assert.equal(
    shouldWrite({ reason: null, dirty: true, lastPersistAt: T0, now: T0 + PERSIST_MIN_MS + 10, kind: 'read' }),
    false,
  );
  assert.equal(
    shouldWrite({ reason: null, dirty: true, lastPersistAt: T0, now: T0 + PERSIST_MIN_MS + 10, kind: 'connect' }),
    false,
  );
  assert.equal(
    shouldWrite({ reason: 'runaway', dirty: true, lastPersistAt: T0, now: T0 + 10, kind: 'read' }),
    true,
  );
  assert.equal(
    shouldWrite({ reason: null, dirty: true, lastPersistAt: T0, now: T0 + PERSIST_MIN_MS + 10, kind: 'tick' }),
    true,
  );
});

test('booting from existing storage does not rewrite the room', async () => {
  const storage = new MemoryStorage();
  const original = createRoom(T0);
  storage.map.set('room', original);
  const session = await RoomSession.boot(storage, T0 + 5_000);
  assert.equal(storage.rows, 0);
  assert.equal(session.room.dog?.id, original.dog?.id);
  const read = session.decay(T0 + 5_000, 'read');
  await flushIfNeeded(storage, session, read);
  assert.equal(storage.rows, 0);
});

test('moves, ticks, and connects stay in memory; feed/pet/catch/name/travel persist once', async () => {
  const storage = new MemoryStorage();
  const session = await RoomSession.boot(storage, T0);
  assert.equal(storage.rows, 1);

  const moved = session.move('aaa', '1.1.1.1', 1, 0, true, 0.08, T0 + 80);
  await flushIfNeeded(storage, session, moved);
  assert.equal(storage.rows, 1);
  assert.ok((session.room.yard?.pose.x ?? 0) !== 0);

  const ticked = session.tick(T0 + 330, 2);
  await flushIfNeeded(storage, session, ticked);
  assert.equal(storage.rows, 1);

  const connected = session.decay(T0 + 400, 'connect');
  await flushIfNeeded(storage, session, connected);
  assert.equal(storage.rows, 1);

  const seated = welcomeCompanion(session.room, 'aaa', T0 + 420);
  await flushIfNeeded(storage, session, session.adopt(seated, T0 + 420, 'connect'));
  const here = applyCompanionHere(session.room, 'aaa', 0.4, -0.2, T0 + 540);
  await flushIfNeeded(storage, session, session.adopt(here, T0 + 540, 'action'));
  const emote = applyCompanionEmote(session.room, 'aaa', 'wave', T0 + 2_600);
  await flushIfNeeded(storage, session, session.adopt(emote, T0 + 2_600, 'action'));
  assert.equal(storage.rows, 1);

  const petted = applyPet(session.room, T0 + 5_000);
  const petWrite = session.adopt(petted.room, T0 + 5_000, 'action');
  await flushIfNeeded(storage, session, petWrite);
  assert.equal(petWrite.wrote, true);
  assert.equal(storage.rows, 2);

  session.room.dog = session.room.dog
    ? { ...session.room.dog, lastFedAt: T0 - 20 * 60 * 1000 }
    : null;
  session.room.yard = {
    ...session.room.yard!,
    pose: {
      ...session.room.yard!.pose,
      x: session.room.yard!.feeder.x ?? 0,
      z: session.room.yard!.feeder.z ?? 0,
    },
  };
  const bowl = applyBowlAction(session.room, T0 + 6_000);
  const bowlWrite = session.adopt(bowl.room, T0 + 6_000, 'action');
  await flushIfNeeded(storage, session, bowlWrite);
  assert.equal(bowlWrite.reason, 'feed');
  assert.equal(storage.rows, 3);

  const traveled = applyWorldAction(session.room, 'aaa', '1.1.1.1', T0 + 7_000, 'travel', 'shibuya');
  const travelWrite = session.adopt(traveled.room, T0 + 7_000, 'action');
  await flushIfNeeded(storage, session, travelWrite);
  assert.equal(travelWrite.reason, 'travel');
  assert.equal(storage.rows, 4);

  const held = session.room;
  assert.ok(held.yard?.leash.holderId);
  const parked = {
    ...held,
    yard: { ...held.yard!, leash: { ...held.yard!.leash, holderId: null, holderIp: null } },
  };
  const parkWrite = session.adopt(parked, T0 + 40_000, 'action');
  await flushIfNeeded(storage, session, parkWrite);
  assert.equal(parkWrite.reason, 'park');
  assert.equal(storage.rows, 5);

  const empty = {
    ...session.room,
    dog: null,
    memorial: session.room.dog ? toRecord(session.room.dog, T0, 'ran_away') : null,
    history: session.room.history,
    lastCatchAt: 0,
    pendingName: null,
  };
  session.adopt(empty, T0 + 41_000, 'action');
  const caught = applyCatch(session.room, 80, T0 + 50_000, () => 0);
  assert.equal(caught.ok, true);
  if (!caught.ok) throw new Error('expected catch');
  const catchWrite = session.adopt(caught.room, T0 + 50_000, 'action');
  await flushIfNeeded(storage, session, catchWrite);
  assert.equal(catchWrite.reason, 'catch');
  const named = applyName(session.room, 'maple', caught.nameToken, T0 + 51_000);
  assert.equal(named.ok, true);
  const nameWrite = session.adopt(named.room, T0 + 51_000, 'action');
  await flushIfNeeded(storage, session, nameWrite);
  assert.equal(nameWrite.reason, 'name');
  assert.ok(storage.rows <= 8);
});

test('dirty pose flushes at most once every 60s; idle ticks only decay', async () => {
  const storage = new MemoryStorage();
  const session = await RoomSession.boot(storage, T0);
  session.move('aaa', '1.1.1.1', 1, 0, true, 0.08, T0 + 80);
  const early = session.tick(T0 + 20_000, 1);
  await flushIfNeeded(storage, session, early);
  assert.equal(early.wrote, false);

  const later = session.tick(T0 + PERSIST_MIN_MS + 100, 1);
  await flushIfNeeded(storage, session, later);
  assert.equal(later.wrote, true);
  assert.equal(later.reason, 'dirty');

  const before = session.room.dog?.happiness ?? 0;
  const idle = session.tick(T0 + PERSIST_MIN_MS + 100 + IDLE_ALARM_MS, 0);
  assert.ok((session.room.dog?.lastDecayAt ?? 0) >= T0 + PERSIST_MIN_MS);
  assert.ok((session.room.dog?.happiness ?? 0) <= before);
  await flushIfNeeded(storage, session, idle);
});

test('alarms are fast only while sockets are connected and are not rewritten if soon enough', () => {
  assert.equal(shouldReplaceAlarm(null, T0, FAST_ALARM_MS), true);
  assert.equal(shouldReplaceAlarm(T0 + FAST_ALARM_MS, T0, FAST_ALARM_MS), false);
  assert.equal(shouldReplaceAlarm(T0 + IDLE_ALARM_MS, T0, FAST_ALARM_MS), true);
  assert.equal(shouldReplaceAlarm(T0 + 10, T0, IDLE_ALARM_MS), false);
});

test('write budget stays under 20k rows across a busy day of movers plus idle', { timeout: 180_000 }, async () => {
  const storage = new MemoryStorage();
  const session = await RoomSession.boot(storage, T0);
  let now = T0;
  const clients = [
    { id: 'ada', ip: '10.0.0.1' },
    { id: 'bea', ip: '10.0.0.2' },
    { id: 'cam', ip: '10.0.0.3' },
  ];

  const stepConnected = async (durationMs: number) => {
    const end = now + durationMs;
    let lastTick = now;
    let lastMove = now;
    let nextPet = now + 12 * 60_000;
    let nextFeed = now + 18 * 60_000;
    while (now < end) {
      now += 80;
      if (now - lastMove >= 80) {
        lastMove = now;
        for (const [index, client] of clients.entries()) {
          const ax = Math.sin(now / 400 + index);
          const az = Math.cos(now / 350 + index);
          const moved = session.move(client.id, client.ip, ax, az, index === 0, 0.08, now);
          await flushIfNeeded(storage, session, moved);
          const here = applyCompanionHere(session.room, client.id, ax, az, now);
          await flushIfNeeded(storage, session, session.adopt(here, now, 'action'));
          if (Math.floor(now / 2_000) !== Math.floor((now - 80) / 2_000)) {
            const emote = applyCompanionEmote(session.room, client.id, 'heart', now);
            await flushIfNeeded(storage, session, session.adopt(emote, now, 'action'));
          }
        }
      }
      if (now - lastTick >= FAST_ALARM_MS) {
        lastTick = now;
        const ticked = session.tick(now, clients.length);
        await flushIfNeeded(storage, session, ticked);
        await scheduleAlarm(storage, now, clients.length);
      }
      if (now >= nextPet) {
        const result = applyPet(session.room, now);
        await flushIfNeeded(storage, session, session.adopt(result.room, now, 'action'));
        nextPet += 12 * 60_000;
      }
      if (now >= nextFeed && session.room.dog) {
        session.room.dog = { ...session.room.dog, lastFedAt: now - 20 * 60_000 };
        const bowl = applyBowlAction(
          {
            ...session.room,
            yard: {
              ...session.room.yard!,
              pose: { ...session.room.yard!.pose, x: -1.5, z: 1.38 },
            },
          },
          now,
        );
        await flushIfNeeded(storage, session, session.adopt(bowl.room, now, 'action'));
        nextFeed += 18 * 60_000;
      }
    }
  };

  const stepIdle = async (durationMs: number) => {
    const end = now + durationMs;
    while (now < end) {
      now += IDLE_ALARM_MS;
      const ticked = session.tick(now, 0);
      await flushIfNeeded(storage, session, ticked);
      await scheduleAlarm(storage, now, 0);
    }
  };

  await stepConnected(8 * 3_600_000);
  await stepIdle(4 * 3_600_000);
  await stepConnected(8 * 3_600_000);
  await stepIdle(4 * 3_600_000);

  assert.ok(now - T0 >= DAY_MS - IDLE_ALARM_MS, `simulated ${now - T0}ms`);
  assert.ok(
    storage.rows < WRITE_BUDGET_MAX_ROWS,
    `rows/day ${storage.rows} should stay under ${WRITE_BUDGET_MAX_ROWS}`,
  );
  assert.ok(storage.rows > 200, `expected some persists, got ${storage.rows}`);
  console.log(`write-budget rows/day=${storage.rows} puts=${storage.puts} alarms=${storage.alarms}`);
});

test('runaway discovered on an idle tick persists once and catch/name still work', async () => {
  const storage = new MemoryStorage();
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.happiness = 10;
  room.dog.lowSince = T0;
  room.dog.lastDecayAt = T0;
  storage.map.set('room', room);
  const session = await RoomSession.boot(storage, T0);
  const gone = session.tick(T0 + RUNAWAY_AFTER_MS, 0);
  await flushIfNeeded(storage, session, gone);
  assert.equal(gone.reason, 'runaway');
  assert.equal(session.room.dog, null);
  assert.equal(gone.wrote, true);

  const caught = applyCatch(session.room, 90, T0 + RUNAWAY_AFTER_MS + 20_000, () => 0);
  assert.equal(caught.ok, true);
  if (!caught.ok) throw new Error('expected catch');
  await flushIfNeeded(storage, session, session.adopt(caught.room, T0 + RUNAWAY_AFTER_MS + 20_000, 'action'));
  const named = applyName(session.room, 'maple', caught.nameToken, T0 + RUNAWAY_AFTER_MS + 21_000);
  assert.equal(named.ok, true);
  await flushIfNeeded(storage, session, session.adopt(named.room, T0 + RUNAWAY_AFTER_MS + 21_000, 'action'));
  assert.equal(session.room.dog?.profile.name, 'Maple');
});

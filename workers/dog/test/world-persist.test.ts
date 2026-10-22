import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCatch, applyVisitorMove, createRoom, migrateRoom, snapshot } from '../src/logic.ts';
import { HOME_PLACE, createLocation, migrateLocation, settleWorldYard } from '../src/world.ts';
import { createYard, releaseLeash } from '../src/room.ts';
import {
  READ_RETRY_MIN_MS,
  RoomSession,
  firstState,
  flushIfNeeded,
  persistReason,
  runOrNap,
  type PersistStorage,
} from '../src/persist.ts';

const T0 = Date.parse('2026-10-21T16:00:00Z');

class MemoryStorage implements PersistStorage {
  map = new Map<string, unknown>();
  rows = 0;

  async get<T>(key: string) {
    return this.map.get(key) as T | undefined;
  }

  async put(entries: Record<string, unknown>) {
    for (const [key, value] of Object.entries(entries)) {
      this.map.set(key, value);
      this.rows += 1;
    }
  }

  async getAlarm() {
    return null;
  }

  async setAlarm() {
    return undefined;
  }
}

test('first GET /state on empty-storage DO boots a world room and never throws', async () => {
  const storage = new MemoryStorage();
  assert.equal(await storage.get('room'), undefined);

  const session = await RoomSession.boot(storage, T0);
  assert.equal(session.loadedFromStorage, true);
  assert.ok(session.room?.dog);
  assert.equal(session.room?.yard?.location?.mode, 'world');
  assert.ok(session.room?.yard?.location?.lat);
  assert.ok(Array.isArray(session.room?.history));
  assert.equal(typeof session.room?.companions, 'object');
  const snap = snapshot(session.room!, T0, 0);
  assert.equal(snap.type, 'state');
  assert.equal(snap.location?.mode, 'world');
  assert.ok(snap.pose);
  assert.ok(Array.isArray(snap.companions));

  const again = await firstState(new MemoryStorage(), T0, 0);
  assert.equal(again.status, 200);
  if (again.status === 200) {
    assert.equal(again.body.type, 'state');
    assert.equal(again.body.location?.placeId, HOME_PLACE.id);
  }
});

test('failing storage.get stays napping, never puts, and recovers the original dog', async () => {
  const saved = migrateRoom(createRoom(T0), T0);
  assert.ok(saved.dog);
  saved.dog = { ...saved.dog, profile: { ...saved.dog.profile, name: 'Maple' } };

  let failRead = true;
  let puts = 0;
  const storage: PersistStorage = {
    async get<T>(key: string) {
      if (failRead) throw new Error('sqlite not ready');
      if (key === 'room') return saved as T;
      return undefined;
    },
    async put() {
      puts += 1;
      throw new Error('should not persist while napping');
    },
    async getAlarm() {
      return null;
    },
    async setAlarm() {
      return undefined;
    },
  };

  const session = await RoomSession.boot(storage, T0);
  assert.equal(session.loadedFromStorage, false);
  assert.equal(session.mayPersist, false);
  assert.equal(session.room, null);
  assert.equal(puts, 0);

  const first = await firstState(storage, T0, 0);
  assert.equal(first.status, 503);
  if (first.status === 503) assert.equal(first.body, 'napping');
  assert.equal(puts, 0);

  const moved = session.adopt(migrateRoom(createRoom(T0 + 1), T0 + 1), T0 + 1, 'action');
  assert.equal(moved.wrote, false);
  await flushIfNeeded(storage, session, { wrote: true, reason: 'feed' });
  assert.equal(puts, 0);

  failRead = false;
  const tooSoon = await session.retryLoad(storage, T0 + 10);
  assert.equal(tooSoon, false);
  assert.equal(session.mayPersist, false);

  const recovered = await session.retryLoad(storage, T0 + 10 + READ_RETRY_MIN_MS);
  assert.equal(recovered, true);
  assert.equal(session.loadedFromStorage, true);
  assert.equal(session.mayPersist, true);
  assert.equal(session.room?.dog?.profile.name, 'Maple');
  assert.equal(session.room?.dog?.id, saved.dog?.id);

  const napping = await runOrNap(async () => {
    throw new Error('uncaught init');
  });
  assert.equal(napping.status, 503);
  if (napping.status === 503) assert.equal(napping.body, 'napping');

  const room = migrateRoom(undefined, T0);
  assert.equal(room.yard?.location?.mode, 'world');
  const partial = migrateRoom({} as never, T0);
  assert.ok(Array.isArray(partial.history));
  assert.equal(partial.companions && typeof partial.companions, 'object');
  assert.equal(partial.yard?.location?.mode, 'world');
});

test('home and yard rooms migrate to world at last lat/lng', () => {
  const home = migrateLocation(
    {
      mode: 'home' as never,
      lat: 40.758,
      lng: -73.9855,
      heading: 1.1,
      originLat: 40.758,
      originLng: -73.9855,
      placeId: 'times-square',
      lastTravelAt: T0,
      lastWorldInputAt: T0,
    },
    T0,
  );
  assert.equal(home.mode, 'world');
  assert.equal(home.placeId, 'times-square');
  assert.equal(home.lat, 40.758);
  assert.equal(home.heading, 1.1);

  const yardOnly = migrateLocation({ mode: 'yard' as never } as never, T0);
  assert.equal(yardOnly.mode, 'world');
  assert.equal(yardOnly.placeId, HOME_PLACE.id);
  assert.equal(yardOnly.lat, HOME_PLACE.lat);

  const settled = settleWorldYard(
    {
      ...createYard(T0),
      pose: { x: 2, z: -1, yaw: 0.4, vx: 0.8, vz: 0, gait: 'walk' },
      location: {
        mode: 'home' as never,
        lat: HOME_PLACE.lat,
        lng: HOME_PLACE.lng,
        heading: 0.4,
        originLat: HOME_PLACE.lat,
        originLng: HOME_PLACE.lng,
        placeId: HOME_PLACE.id,
        lastTravelAt: 0,
        lastWorldInputAt: T0,
      },
    },
    T0,
  );
  assert.equal(settled.location?.mode, 'world');
  assert.ok(Math.abs(settled.pose.x) < 0.05 && Math.abs(settled.pose.z) < 0.05);
  assert.equal(settled.pose.vx, 0);
});

test('parked world position survives a RoomSession restart', async () => {
  const storage = new MemoryStorage();
  const session = await RoomSession.boot(storage, T0);
  assert.ok(session.room);
  const walked = applyVisitorMove(session.room, 'aaa', '1.1.1.1', 1, 0, true, 0.12, T0 + 80);
  session.adopt(walked.room, T0 + 80, 'action');
  const released = {
    ...session.room,
    yard: releaseLeash(session.room.yard!, T0 + 200),
  };
  const parked = session.adopt(released, T0 + 200, 'action');
  assert.equal(parked.reason, 'park');
  assert.equal(parked.wrote, true);
  await flushIfNeeded(storage, session, parked);

  const lat = session.room.yard!.location!.lat;
  const lng = session.room.yard!.location!.lng;
  const heading = session.room.yard!.location!.heading;
  assert.ok(lat !== HOME_PLACE.lat || lng !== HOME_PLACE.lng || session.room.yard!.pose.x !== 0);

  const again = await RoomSession.boot(storage, T0 + 5_000);
  assert.ok(again.room);
  assert.equal(again.room.yard!.location!.mode, 'world');
  assert.equal(again.room.yard!.location!.lat, lat);
  assert.equal(again.room.yard!.location!.lng, lng);
  assert.equal(again.room.yard!.location!.heading, heading);
  assert.equal(persistReason(session.room!, again.room), null);
});

test('catch keeps a saved world position and defaults to WSP only when missing', () => {
  const parked = createRoom(T0);
  parked.yard = {
    ...parked.yard!,
    pose: { x: 8, z: -3, yaw: 2, vx: 0, vz: 0, gait: 'idle' },
    location: {
      ...createLocation(T0, HOME_PLACE),
      lat: 40.758,
      lng: -73.9855,
      heading: 2,
      originLat: 40.758,
      originLng: -73.9855,
      placeId: 'times-square',
    },
  };
  const gone = { ...parked, dog: null, memorial: parked.dog ? undefined : null };
  const caught = applyCatch({ ...gone, dog: null, memorial: null, lastCatchAt: 0 }, 80, T0 + 1_000);
  assert.equal(caught.ok, true);
  if (caught.ok) {
    assert.equal(caught.room.yard?.location?.placeId, 'times-square');
    assert.equal(caught.room.yard?.location?.lat, 40.758);
  }

  const fresh = applyCatch({ ...createRoom(T0), dog: null, yard: undefined as never, lastCatchAt: 0 }, 80, T0 + 2_000);
  assert.equal(fresh.ok, true);
  if (fresh.ok) {
    const snap = snapshot(migrateRoom(fresh.room, T0 + 2_000), T0 + 2_000, 1);
    assert.equal(snap.location?.placeId, HOME_PLACE.id);
    assert.equal(snap.location?.mode, 'world');
  }
});

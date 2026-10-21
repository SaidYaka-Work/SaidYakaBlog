import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyBowlAction,
  applyVisitorMove,
  applyWorldAction,
  createRoom,
  parseClientMessage,
  snapshot,
} from '../src/logic.ts';
import {
  HOME_PLACE,
  PLACES,
  applyTravel,
  haversineMeters,
  lngLatToLocal,
  localToLngLat,
  pointInRing,
  applyWorldDrive,
  pushCircleOut,
  stayOnPavement,
  sunDirection,
  tileXY,
} from '../src/world.ts';
import { RUN_SPEED, WALK_SPEED, createYard } from '../src/room.ts';

const T0 = Date.parse('2026-10-21T12:00:00Z');

test('old clients still parse move and extra world keys are allowed', () => {
  assert.equal(parseClientMessage('{"type":"move","ax":1,"az":0,"run":false}').ok, true);
  assert.equal(parseClientMessage('{"type":"leave"}').ok, true);
  assert.equal(parseClientMessage('{"type":"home"}').ok, true);
  assert.equal(parseClientMessage('{"type":"travel","placeId":"shibuya"}').ok, true);
  assert.equal(parseClientMessage('{"type":"travel","placeId":"not-a-place"}').ok, true);
  assert.equal(parseClientMessage('{"type":"move","ax":0,"az":-1,"wx":2,"wz":3}').ok, true);
  assert.equal(parseClientMessage('{"type":"travel","placeId":"../etc"}').ok, false);
});

test('snapshot always includes a public location so clients can feature-detect', () => {
  const snap = snapshot(createRoom(T0), T0, 1);
  assert.ok(snap.location);
  assert.equal(snap.location?.mode, 'world');
  assert.equal(snap.location?.placeId, HOME_PLACE.id);
  assert.equal(snap.location?.country, HOME_PLACE.country);
});

test('travel only accepts the preset list and enforces cooldown', () => {
  const yard = createYard(T0);
  const bad = applyTravel(yard, 'said-house', T0);
  assert.equal(bad.ok, false);
  const ok = applyTravel(yard, 'shibuya', T0);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.yard.location?.mode, 'world');
    assert.equal(ok.yard.location?.placeId, 'shibuya');
    const again = applyTravel(ok.yard, 'tuileries', T0 + 1000);
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.code, 'too_soon');
  }
  assert.ok(PLACES.length >= 30);
});

test('world movement is speed-capped in meters and proposed teleports are rejected', () => {
  let room = createRoom(T0);
  assert.equal(room.yard?.location?.mode ?? snapshot(room, T0, 1).location?.mode, 'world');
  const leave = applyWorldAction(room, 'aaa', '1.1.1.1', T0, 'leave');
  assert.equal(leave.acquired, true);
  room = leave.room;
  assert.equal(room.yard?.location?.mode, 'world');
  const step = applyVisitorMove(room, 'aaa', '1.1.1.1', 0, -1, true, 0.1, T0 + 80);
  const moved = haversineMeters(
    room.yard!.location!.lat,
    room.yard!.location!.lng,
    step.room.yard!.location!.lat,
    step.room.yard!.location!.lng,
  );
  assert.ok(moved <= RUN_SPEED * 0.1 + 1.6, `moved ${moved}`);
  const tele = applyVisitorMove(step.room, 'aaa', '1.1.1.1', 0, -1, true, 0.1, T0 + 160, { x: 400, z: 400 });
  const jump = Math.hypot(tele.room.yard!.pose.x - step.room.yard!.pose.x, tele.room.yard!.pose.z - step.room.yard!.pose.z);
  assert.ok(jump < 3, `teleport ${jump}`);
});

test('feeding works at the portable bowl in the world and walking still credits the leash', () => {
  const start = createRoom(T0);
  start.yard = { ...start.yard!, pose: { ...start.yard!.pose, yaw: Math.PI } };
  const leashed = applyWorldAction(start, 'aaa', '1.1.1.1', T0, 'leave').room;
  const walked = applyVisitorMove(leashed, 'aaa', '1.1.1.1', 0, -1, false, 0.1, T0 + 80);
  assert.ok((walked.room.yard?.leash.sessionMeters ?? 0) > 0);

  const far = applyBowlAction(leashed, T0 + 20);
  assert.equal(far.code, 'too_far');
  const bowl = leashed.yard!.feeder;
  const atBowl = {
    ...leashed,
    dog: leashed.dog ? { ...leashed.dog, lastFedAt: T0 - 20 * 60 * 1000 } : null,
    yard: {
      ...leashed.yard!,
      pose: { ...leashed.yard!.pose, x: bowl.x ?? 0, z: bowl.z ?? 0 },
    },
  };
  const dinner = applyBowlAction(atBowl, T0 + 40);
  assert.equal(dinner.code, undefined);
});

test('second visitor cannot travel while the first holds the leash', () => {
  let room = createRoom(T0);
  room = applyWorldAction(room, 'aaa', '1.1.1.1', T0, 'leave').room;
  const busy = applyWorldAction(room, 'bbb', '2.2.2.2', T0 + 200, 'travel', 'tuileries');
  assert.equal(busy.acquired, false);
  assert.equal(busy.code, 'busy');
});

test('walking W in local space increases latitude (north)', () => {
  const origin = HOME_PLACE;
  const local = lngLatToLocal(origin.lat, origin.lng, origin.lat, origin.lng);
  assert.ok(Math.abs(local.x) < 1e-6 && Math.abs(local.z) < 1e-6);
  const north = localToLngLat(0, -10, origin.lat, origin.lng);
  assert.ok(north.lat > origin.lat);
  const tile = tileXY(origin.lat, origin.lng);
  assert.equal(tile.z, 14);
  const noon = sunDirection(origin.lat, origin.lng, Date.parse('2026-06-21T16:00:00Z'));
  const midnight = sunDirection(origin.lat, origin.lng, Date.parse('2026-06-21T04:00:00Z'));
  assert.equal(noon.night, false);
  assert.equal(midnight.night, true);
});

test('world drive eases in and slides off building walls onto nearby pavement', () => {
  const yard = { ...createYard(T0), pose: { ...createYard(T0).pose, yaw: Math.PI } };
  const first = applyWorldDrive(yard, 0, -1, false, 0.05, T0 + 50);
  const speed = Math.hypot(first.pose.vx, first.pose.vz);
  assert.ok(speed > 0.05 && speed < WALK_SPEED, `eased speed ${speed}`);
  const still = applyWorldDrive(first, 0, 0, false, 0.05, T0 + 100);
  assert.ok(Math.hypot(still.pose.vx, still.pose.vz) < speed, 'decelerates instead of stopping cold');

  const park: { x: number; z: number }[] = [
    { x: -6, z: -6 },
    { x: 6, z: -6 },
    { x: 6, z: 6 },
    { x: -6, z: 6 },
  ];
  const road: { x: number; z: number }[] = [
    { x: 20, z: 0 },
    { x: 30, z: 0 },
  ];
  const inPark = stayOnPavement(0, 0, [road], [park]);
  assert.ok(Math.abs(inPark.x) < 0.01 && Math.abs(inPark.z) < 0.01);

  const street: { x: number; z: number }[] = [
    { x: 0, z: 0 },
    { x: 0, z: 12 },
  ];
  const pulled = stayOnPavement(2.2, 6, [street], []);
  assert.ok(pulled.x < 2.2);
});

test('circle-vs-polygon push-out keeps the dog outside building footprints', () => {
  const square: { x: number; z: number }[] = [
    { x: -1, z: -1 },
    { x: 1, z: -1 },
    { x: 1, z: 1 },
    { x: -1, z: 1 },
  ];
  assert.equal(pointInRing(0, 0, square), true);
  const out = pushCircleOut(0, 0, 0.3, [square]);
  assert.equal(pointInRing(out.x, out.z, square), false);
  assert.ok(Math.hypot(out.x, out.z) >= 1);
});

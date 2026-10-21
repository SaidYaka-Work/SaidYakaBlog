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
  pushCircleOut,
  sunDirection,
  tileXY,
} from '../src/world.ts';
import { RUN_SPEED, createYard } from '../src/room.ts';

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
  assert.equal(snap.location?.mode, 'home');
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
  const leave = applyWorldAction(room, 'aaa', '1.1.1.1', T0, 'leave');
  assert.equal(leave.acquired, true);
  room = leave.room;
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

test('feeding is home-only and walking through the world still credits the leash', () => {
  let room = createRoom(T0);
  room = applyWorldAction(room, 'aaa', '1.1.1.1', T0, 'leave').room;
  const bowl = applyBowlAction(room, T0 + 20);
  assert.equal(bowl.code, 'too_far');
  const walked = applyVisitorMove(room, 'aaa', '1.1.1.1', 0, -1, false, 0.1, T0 + 80);
  assert.ok((walked.room.yard?.leash.sessionMeters ?? 0) > 0);
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

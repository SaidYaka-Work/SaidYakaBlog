import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyBowlAction, applyVisitorMove, applyWorldAction, createRoom, forgetVisitor, parseClientMessage } from '../src/logic.ts';
import {
  BED,
  BLOCKERS,
  FEEDER,
  LEASH_COOLDOWN_MS,
  LEASH_IDLE_MS,
  LEASH_MAX_MS,
  ROOM_HALF,
  RUN_SPEED,
  WALK_CAP_HOUR_M,
  WALK_CAP_SESSION_M,
  WALK_CREDIT_M,
  applyDrive,
  clampTeleport,
  collide,
  createYard,
  integratePose,
  nearFeeder,
  releaseLeash,
  slide,
  tickYardAi,
  tryAcquireLeash,
  walkCreditPending,
} from '../src/room.ts';

const T0 = Date.parse('2026-10-20T12:00:00Z');

test('parseClientMessage accepts move and bowl and still rejects extra keys', () => {
  assert.equal(parseClientMessage('{"type":"move","ax":1,"az":0,"run":true}').ok, true);
  assert.equal(parseClientMessage('{"type":"bowl"}').ok, true);
  assert.equal(parseClientMessage('{"type":"move","ax":1,"az":0,"note":"no"}').ok, false);
  assert.equal(parseClientMessage('{"type":"hello"}').ok, true);
});

test('first visitor to press a movement key takes the leash; the second is busy', () => {
  const yard = createYard(T0);
  const a = tryAcquireLeash(yard, 'aaa', '1.1.1.1', T0);
  assert.equal(a.ok, true);
  if (!a.ok) throw new Error('expected acquire');
  assert.equal(a.yard.leash.holderId, 'aaa');

  const b = tryAcquireLeash(a.yard, 'bbb', '2.2.2.2', T0 + 200);
  assert.equal(b.ok, false);
  if (b.ok) throw new Error('expected busy');
  assert.equal(b.code, 'busy');
});

test('leash auto-releases after idle and after the max hold, then the same IP is on cooldown', () => {
  const held = tryAcquireLeash(createYard(T0), 'aaa', '1.1.1.1', T0);
  assert.equal(held.ok, true);
  if (!held.ok) throw new Error('expected acquire');

  const idle = tryAcquireLeash(held.yard, 'bbb', '2.2.2.2', T0 + LEASH_IDLE_MS);
  assert.equal(idle.ok, true);
  if (!idle.ok) throw new Error('expected idle steal');
  assert.equal(idle.yard.leash.holderId, 'bbb');

  const maxed = tryAcquireLeash(held.yard, 'ccc', '3.3.3.3', T0 + LEASH_MAX_MS);
  assert.equal(maxed.ok, true);

  const released = releaseLeash(held.yard, T0 + 10);
  const again = tryAcquireLeash(released, 'aaa', '1.1.1.1', T0 + 20);
  assert.equal(again.ok, false);
  if (again.ok) throw new Error('expected cooldown');
  assert.equal(again.code, 'cooldown');
  assert.ok((again.retryAfterMs ?? 0) > LEASH_COOLDOWN_MS - 50);

  const after = tryAcquireLeash(released, 'aaa', '1.1.1.1', T0 + LEASH_COOLDOWN_MS + 20);
  assert.equal(after.ok, true);
});

test('collision keeps the dog inside the fence and slides along walls and props', () => {
  const out = collide(ROOM_HALF + 2, 0);
  assert.ok(out.x <= ROOM_HALF - 0.2);
  const slid = slide(ROOM_HALF - 0.3, 0, ROOM_HALF + 1, 0.4);
  assert.ok(slid.x <= ROOM_HALF - 0.2);
  assert.ok(slid.z > 0.1);
  const prop = BLOCKERS[0];
  const into = collide(prop.x, prop.z);
  assert.ok(Math.hypot(into.x - prop.x, into.z - prop.z) >= prop.radius);
});

test('speed is clamped and teleports are pulled back', () => {
  const start = createYard(T0).pose;
  const step = integratePose(start, 4, 0, true, 0.1);
  assert.ok(Math.hypot(step.pose.vx, step.pose.vz) <= RUN_SPEED + 0.05);
  const jumped = clampTeleport(start, { ...start, x: 3, z: 3 }, 0.08);
  assert.ok(Math.hypot(jumped.x - start.x, jumped.z - start.z) < 1.2);
});

test('feeder only counts as in-radius when the dog is next to the bowl', () => {
  assert.equal(nearFeeder(FEEDER.x, FEEDER.z), true);
  assert.equal(nearFeeder(0, 0), false);
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.lastFedAt = T0 - 20 * 60 * 1000;
  const far = applyBowlAction(room, T0);
  assert.equal(far.code, 'too_far');
  assert.equal(far.room.yard?.feeder.hasFood, true);
  assert.equal(far.fed, undefined);

  const yard = createYard(T0);
  const bowl = yard.feeder;
  const nearRoom = {
    ...room,
    yard: {
      ...yard,
      pose: { x: (bowl.x ?? 0) + 0.2, z: bowl.z ?? 0, yaw: 0, vx: 0, vz: 0, gait: 'idle' as const },
    },
  };
  nearRoom.dog = { ...room.dog, lastFedAt: T0 - 20 * 60 * 1000 };
  const near = applyBowlAction(nearRoom, T0);
  assert.ok(near.fed && near.fed.ok);
  assert.equal(near.room.yard?.pose.gait, 'eat');
  assert.equal(near.room.dog?.totals.feeds, (room.dog?.totals.feeds ?? 0) + 1);
});

test('walk distance while leashed credits care and then hits the session cap', () => {
  const room = createRoom(T0);
  assert.ok(room.dog);
  room.dog.lastWalkedAt = T0 - 40 * 60 * 1000;
  let current = room;
  let now = T0;
  for (let i = 0; i < 220; i += 1) {
    now += 80;
    const ax = Math.sin(i * 0.45);
    const az = Math.cos(i * 0.45);
    const moved = applyVisitorMove(current, 'aaa', '1.1.1.1', ax, az, true, 0.08, now);
    current = moved.room;
  }
  const leash = current.yard?.leash;
  assert.ok(leash);
  assert.ok(leash.sessionMeters > WALK_CREDIT_M);
  assert.ok((current.dog?.totals.walks ?? 0) >= 1);

  assert.ok(current.yard);
  current.yard.leash.sessionMeters = WALK_CAP_SESSION_M + 8;
  current.yard.leash.hourMeters = WALK_CAP_HOUR_M - 1;
  const capped = applyDrive(current.yard, 1, 0, true, 0.1, now + 80);
  assert.ok(capped.leash.sessionMeters <= WALK_CAP_SESSION_M + 0.05);
  assert.ok(capped.leash.hourMeters <= WALK_CAP_HOUR_M + 0.05);
  assert.ok(walkCreditPending(capped.leash) < WALK_CREDIT_M || capped.leash.sessionMeters >= WALK_CAP_SESSION_M);
});

test('two clients: holder drives, the other sees the same position, then idle hands the leash over', () => {
  const room = createRoom(T0);
  const first = applyVisitorMove(room, 'alice', '10.0.0.1', 1, 0, false, 0.1, T0);
  assert.equal(first.acquired, true);
  assert.equal(first.room.yard?.leash.holderId, 'alice');
  const startX = first.room.yard?.pose.x ?? 0;

  const denied = applyVisitorMove(first.room, 'bob', '10.0.0.2', -1, 0, false, 0.1, T0 + 200);
  assert.equal(denied.acquired, false);
  assert.equal(denied.room.yard?.leash.holderId, 'alice');
  assert.equal(denied.room.yard?.pose.x, first.room.yard?.pose.x);

  const walked = applyVisitorMove(first.room, 'alice', '10.0.0.1', 1, 0, false, 0.1, T0 + 300);
  assert.ok((walked.room.yard?.pose.x ?? 0) > startX);

  const afterIdle = applyVisitorMove(walked.room, 'bob', '10.0.0.2', 0, 1, false, 0.1, T0 + 300 + LEASH_IDLE_MS);
  assert.equal(afterIdle.acquired, true);
  assert.equal(afterIdle.room.yard?.leash.holderId, 'bob');
});

test('drive faces the input and stays inside the fence without heading snaps', () => {
  let pose = createYard(T0).pose;
  let lastYaw = pose.yaw;
  for (let i = 0; i < 30; i += 1) {
    const next = integratePose(pose, 0, -1, false, 0.05);
    const turn = Math.abs(((next.pose.yaw - lastYaw + Math.PI) % (Math.PI * 2)) - Math.PI);
    assert.ok(turn <= 4.6 * 0.05 + 0.01, `heading snap ${turn}`);
    assert.ok(Math.abs(next.pose.x) < ROOM_HALF && Math.abs(next.pose.z) < ROOM_HALF);
    lastYaw = next.pose.yaw;
    pose = next.pose;
  }
  assert.ok(Math.abs(pose.yaw) > 2.2 || Math.abs(pose.yaw) < 0.6);
});

test('unleashed dog wanders toward the bed when tired and the feeder when hungry food is waiting', () => {
  const tired = tickYardAi(createYard(T0), T0 + 3_000, 0.2, { tired: true });
  assert.equal(tired.ai.mode, 'bed');
  assert.equal(tired.ai.tx, BED.x);

  const stocked = fillAndTick();
  assert.equal(stocked.ai.mode === 'feeder' || stocked.pose.gait === 'eat', true);
});

test('continuous walking past the old max hold keeps the leash; idle is what expires it', () => {
  const room = createRoom(T0);
  let current = applyVisitorMove(room, 'alice', '10.0.0.1', 1, 0, false, 0.1, T0).room;
  assert.equal(current.yard?.leash.holderId, 'alice');
  let now = T0;
  for (let i = 0; i < 110; i += 1) {
    now += 1_000;
    current = applyVisitorMove(current, 'alice', '10.0.0.1', 0.8, 0.2, false, 0.1, now).room;
  }
  assert.ok(now - T0 > LEASH_MAX_MS, 'walked longer than the old max hold');
  assert.equal(current.yard?.leash.holderId, 'alice', 'movement refreshes the hold');
  const stealDuringWalk = applyVisitorMove(current, 'bob', '10.0.0.2', 1, 0, false, 0.1, now + 200);
  assert.equal(stealDuringWalk.acquired, false);
  assert.equal(stealDuringWalk.room.yard?.leash.holderId, 'alice');

  const afterIdle = applyVisitorMove(current, 'bob', '10.0.0.2', 1, 0, false, 0.1, now + LEASH_IDLE_MS);
  assert.equal(afterIdle.acquired, true);
  assert.equal(afterIdle.room.yard?.leash.holderId, 'bob');
});

test('zero-input heartbeat from the holder does not refresh lastInputAt', () => {
  const held = tryAcquireLeash(createYard(T0), 'alice', '10.0.0.1', T0);
  assert.equal(held.ok, true);
  if (!held.ok) throw new Error('expected acquire');
  const beat = applyDrive(held.yard, 0, 0, false, 0.08, T0 + 4_000);
  assert.equal(beat.leash.lastInputAt, T0);
  assert.equal(beat.leash.holderId, 'alice');
  const stillHeld = tryAcquireLeash(beat, 'bob', '10.0.0.2', T0 + 4_000);
  assert.equal(stillHeld.ok, false);
  const afterIdle = applyVisitorMove(beat, 'bob', '10.0.0.2', 1, 0, false, 0.1, T0 + LEASH_IDLE_MS);
  assert.equal(afterIdle.acquired, true);
  assert.equal(afterIdle.room.yard?.leash.holderId, 'bob');
});

test('simulated 120s of 80ms moves keeps the leash; idle then releases; retake is immediate', () => {
  const room = createRoom(T0);
  let current = applyVisitorMove(room, 'alice', '10.0.0.1', 1, 0, false, 0.08, T0).room;
  assert.equal(current.yard?.leash.holderId, 'alice');
  let now = T0;
  const steps = Math.ceil(120_000 / 80);
  for (let i = 0; i < steps; i += 1) {
    now += 80;
    current = applyVisitorMove(current, 'alice', '10.0.0.1', 0.8, 0.1, false, 0.08, now).room;
  }
  assert.ok(now - T0 >= 120_000);
  assert.equal(current.yard?.leash.holderId, 'alice', 'moves every 80ms keep the hold past 120s');
  assert.ok((current.yard?.leash.lastInputAt ?? 0) >= now - 80);

  let parked = current;
  for (let t = 2_000; t < LEASH_IDLE_MS; t += 2_000) {
    parked = applyVisitorMove(parked, 'alice', '10.0.0.1', 0, 0, false, 0.08, now + t).room;
    assert.equal(parked.yard?.leash.holderId, 'alice', 'zero-input must not steal or refresh');
    assert.equal(parked.yard?.leash.lastInputAt, current.yard?.leash.lastInputAt);
  }

  const stealEarly = applyVisitorMove(parked, 'bob', '10.0.0.2', 1, 0, false, 0.08, now + 200);
  assert.equal(stealEarly.acquired, false);

  const released = applyVisitorMove(parked, 'alice', '10.0.0.1', 0, 0, false, 0.08, now + LEASH_IDLE_MS);
  assert.equal(released.room.yard?.leash.holderId, null, 'idle after last real move releases');

  const again = applyVisitorMove(released.room, 'alice', '10.0.0.1', 0, 0.18, false, 0.08, now + LEASH_IDLE_MS + 20);
  assert.equal(again.acquired, true, 're-take after idle release succeeds immediately');
  assert.equal(again.room.yard?.leash.holderId, 'alice');
});

test('leave or disconnect while holding releases without cooldown; same client reclaims immediately', () => {
  let room = createRoom(T0);
  room = applyVisitorMove(room, 'alice', '10.0.0.1', 1, 0, false, 0.08, T0).room;
  assert.equal(room.yard?.leash.holderId, 'alice');
  const left = applyWorldAction(room, 'alice', '10.0.0.1', T0 + 400, 'leave');
  assert.equal(left.room.yard?.leash.holderId, null, 'leave drops the hold');
  const again = tryAcquireLeash(left.room.yard!, 'alice', '10.0.0.1', T0 + 420);
  assert.equal(again.ok, true, 'same client reclaims after leave without the 20s cooldown');

  let held = applyVisitorMove(createRoom(T0), 'alice', '10.0.0.1', 1, 0, false, 0.08, T0).room;
  const gone = forgetVisitor(held, 'alice', T0 + 500);
  assert.equal(gone.yard?.leash.holderId, null, 'disconnect drops the hold');
  const reclaim = tryAcquireLeash(gone.yard!, 'alice', '10.0.0.1', T0 + 520);
  assert.equal(reclaim.ok, true, 'same client id reclaims after a pagehide disconnect');
});

test('after an idle drop the same walker can take the leash again without cooldown', () => {
  const held = tryAcquireLeash(createYard(T0), 'alice', '10.0.0.1', T0);
  assert.equal(held.ok, true);
  if (!held.ok) throw new Error('expected acquire');
  const dropped = releaseLeash(held.yard, T0 + LEASH_IDLE_MS, undefined, 'idle');
  assert.equal(dropped.leash.holderId, null);
  const again = tryAcquireLeash(dropped, 'alice', '10.0.0.1', T0 + LEASH_IDLE_MS + 20);
  assert.equal(again.ok, true, 'idle expiry must not put the walker on cooldown');
  if (!again.ok) throw new Error('expected retake');
  assert.equal(again.yard.leash.holderId, 'alice');
});

function fillAndTick() {
  const yard = applyDrive(createYard(T0), 0, 0, false, 0.01, T0);
  yard.feeder.hasFood = true;
  return tickYardAi(yard, T0 + 4_000, 0.2, { hungry: true });
}

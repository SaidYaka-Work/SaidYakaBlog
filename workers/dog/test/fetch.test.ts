import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyThrow,
  applyVisitorMove,
  createRoom,
  parseClientMessage,
  snapshot,
} from '../src/logic.ts';
import {
  FETCH_TTL_MS,
  THROW_COOLDOWN_MS,
  THROW_MAX_M,
  airDuration,
  ballVisual,
  clampThrowTarget,
  fetchPose,
  isBallLive,
  makeBall,
  tickFetch,
} from '../src/fetch.ts';
import { persistReason, RoomSession } from '../src/persist.ts';
import { RUN_SPEED } from '../src/room.ts';

const T0 = Date.parse('2026-10-20T12:00:00Z');

function holdLeash(now = T0, clientId = 'alice') {
  const moved = applyVisitorMove(createRoom(now), clientId, '1.1.1.1', 0, 1, false, 0.1, now);
  assert.equal(moved.acquired, true);
  return moved.room;
}

test('parseClientMessage accepts throw xz and rejects extras', () => {
  const ok = parseClientMessage('{"type":"throw","x":8.2,"z":-3}');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.kind, 'throw');
    if (ok.kind === 'throw') {
      assert.equal(ok.x, 8.2);
      assert.equal(ok.z, -3);
    }
  }
  assert.equal(parseClientMessage('{"type":"throw","x":1,"z":2,"note":"no"}').ok, false);
  assert.equal(parseClientMessage('{"type":"throw","x":null,"z":1}').ok, false);
  assert.equal(parseClientMessage('{"type":"throw","x":1}').ok, false);
  assert.equal(parseClientMessage('{"type":"throw","x":1e9,"z":0}').ok, false);
});

test('clampThrowTarget caps at 30m and fills a too-short tap along yaw', () => {
  const far = clampThrowTarget(0, 0, 80, 0);
  assert.equal(far.dist, THROW_MAX_M);
  assert.ok(Math.abs(far.x - THROW_MAX_M) < 1e-6);
  assert.ok(Math.abs(far.z) < 1e-6);

  const ahead = clampThrowTarget(2, 3, 2.1, 3.05, 0);
  assert.ok(ahead.dist > 10);
  assert.ok(Math.abs(ahead.x - 2) < 1e-6);
  assert.ok(ahead.z > 3);
});

test('only the leash holder can throw, and the target is clamped', () => {
  const held = holdLeash();
  const stranger = applyThrow(held, 'bob', 12, 0, T0);
  assert.equal(stranger.ok, false);
  if (!stranger.ok) assert.equal(stranger.code, 'busy');

  const thrown = applyThrow(held, 'alice', 80, 0, T0);
  assert.equal(thrown.ok, true);
  if (!thrown.ok) throw new Error('expected throw');
  assert.ok(thrown.room.yard?.ball);
  const ball = thrown.room.yard!.ball!;
  assert.ok(Math.hypot(ball.toX - ball.fromX, ball.toZ - ball.fromZ) <= THROW_MAX_M + 1e-6);
  assert.equal(ball.throwerId, 'alice');
  assert.ok(isBallLive(ball, T0));
  assert.equal(snapshot(thrown.room, T0, 1).ball?.playId, ball.playId);
});

test('one ball in flight and a 2s cooldown after it lands', () => {
  const held = holdLeash();
  const first = applyThrow(held, 'alice', 10, 4, T0);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error('expected first throw');

  const during = applyThrow(first.room, 'alice', 6, 2, T0 + 200);
  assert.equal(during.ok, false);
  if (!during.ok) assert.equal(during.code, 'busy');

  const doneYard = tickFetch(first.room.yard!, T0 + FETCH_TTL_MS);
  assert.equal(doneYard.ball, undefined);
  const cleared = { ...first.room, yard: doneYard };
  const soon = applyThrow(cleared, 'alice', 8, 0, T0 + 400);
  assert.equal(soon.ok, false);
  if (!soon.ok) {
    assert.equal(soon.code, 'cooldown');
    assert.ok((soon.retryAfterMs ?? 0) > THROW_COOLDOWN_MS - 500);
  }

  const ready = applyThrow(cleared, 'alice', 8, 0, T0 + THROW_COOLDOWN_MS);
  assert.equal(ready.ok, true);
});

test('fetchPose runs out, waits if needed, then returns; ballVisual arcs', () => {
  const ball = makeBall(0, 0, 26, 0, 'alice', T0, 0);
  const outbound = Math.hypot(ball.toX, ball.toZ);
  const runMs = (outbound / RUN_SPEED) * 1000;
  const start = fetchPose(ball, T0);
  assert.ok(Math.hypot(start.x, start.z) < 0.05);
  assert.equal(start.done, false);
  assert.equal(start.gait, 'run');

  const mid = fetchPose(ball, T0 + runMs * 0.5);
  assert.ok(mid.x > 8);
  assert.ok(mid.x < ball.toX);
  assert.equal(mid.carrying, false);

  const atBall = fetchPose(ball, T0 + Math.max(runMs, airDuration(outbound)));
  assert.ok(Math.hypot(atBall.x - ball.toX, atBall.z - ball.toZ) < 0.2);
  assert.equal(atBall.carrying, true);

  const home = fetchPose(ball, T0 + FETCH_TTL_MS);
  assert.equal(home.done, true);
  assert.ok(Math.hypot(home.x - ball.fromX, home.z - ball.fromZ) < 0.2);

  const air = ballVisual(ball, T0 + airDuration(outbound) * 0.5);
  assert.equal(air.visible, true);
  assert.ok(air.y > 0.4);
  const land = ballVisual(ball, T0 + airDuration(outbound) + 20);
  assert.ok(land.y < air.y);
});

test('tickFetch drives the shared pose from the seed and then clears the ball', () => {
  const held = holdLeash();
  const thrown = applyThrow(held, 'alice', 20, 0, T0);
  assert.equal(thrown.ok, true);
  if (!thrown.ok) throw new Error('expected throw');
  const mid = tickFetch(thrown.room.yard!, T0 + 2_000);
  assert.ok(mid.ball);
  assert.ok(Math.hypot(mid.pose.x - thrown.room.yard!.pose.x, mid.pose.z - thrown.room.yard!.pose.z) > 1);
  const done = tickFetch(mid, T0 + FETCH_TTL_MS);
  assert.equal(done.ball, undefined);
  assert.equal(done.pose.gait, 'idle');
});

test('throws do not persist — happiness bump is memory-only', () => {
  const held = holdLeash();
  const thrown = applyThrow(held, 'alice', 12, 3, T0);
  assert.equal(thrown.ok, true);
  if (!thrown.ok) throw new Error('expected throw');
  assert.equal(persistReason(held, thrown.room), null);
  assert.ok((thrown.room.dog?.happiness ?? 0) > (held.dog?.happiness ?? 0));

  const session = new RoomSession(held, T0, T0, true);
  const decision = session.adopt(thrown.room, T0, 'action');
  assert.equal(decision.wrote, false);
  assert.equal(decision.reason, null);
});

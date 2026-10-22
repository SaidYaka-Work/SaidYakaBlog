/**
 * Shared fetch: one ball, leash-holder throws, clients predict from the seed.
 * Throws stay in memory — persistReason does not treat them as a write.
 */

import { RUN_SPEED, WALK_SPEED, headingYaw, type Gait, type YardState } from './room';

export const THROW_MAX_M = 30;
export const THROW_MIN_M = 1.2;
export const THROW_COOLDOWN_MS = 2_000;
export const FETCH_TTL_MS = 28_000;
export const FETCH_PICK_M = 0.7;
export const FETCH_HOME_M = 0.85;
export const FETCH_HAPPINESS = 3;
export const BALL_RADIUS = 0.09;

export type BallState = {
  playId: string;
  thrownAt: number;
  throwerId: string;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
};

export type PublicBall = {
  playId: string;
  thrownAt: number;
  throwerId: string;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
};

export function clampThrowTarget(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  yaw = 0,
): { x: number; z: number; dist: number } {
  let dx = toX - fromX;
  let dz = toZ - fromZ;
  let dist = Math.hypot(dx, dz);
  if (!Number.isFinite(dist) || dist < THROW_MIN_M) {
    dx = Math.sin(yaw);
    dz = Math.cos(yaw);
    dist = Math.hypot(dx, dz) || 1;
    const reach = 14;
    return { x: fromX + (dx / dist) * reach, z: fromZ + (dz / dist) * reach, dist: reach };
  }
  if (dist > THROW_MAX_M) {
    const scale = THROW_MAX_M / dist;
    return { x: fromX + dx * scale, z: fromZ + dz * scale, dist: THROW_MAX_M };
  }
  return { x: toX, z: toZ, dist };
}

export function airDuration(dist: number) {
  return 550 + Math.max(0, dist) * 28;
}

export function airHeight(dist: number) {
  return 0.55 + Math.max(0, dist) * 0.06;
}

export function fetchSpeed(dist: number) {
  return dist > 5 ? RUN_SPEED : WALK_SPEED;
}

function finiteBall(value: unknown): value is BallState {
  if (!value || typeof value !== 'object') return false;
  const ball = value as BallState;
  return (
    typeof ball.playId === 'string' &&
    ball.playId.length > 0 &&
    ball.playId.length < 40 &&
    Number.isFinite(ball.thrownAt) &&
    typeof ball.throwerId === 'string' &&
    Number.isFinite(ball.fromX) &&
    Number.isFinite(ball.fromZ) &&
    Number.isFinite(ball.toX) &&
    Number.isFinite(ball.toZ)
  );
}

export function migrateBall(raw: unknown, now: number): BallState | undefined {
  if (!finiteBall(raw)) return undefined;
  if (now - raw.thrownAt > FETCH_TTL_MS || raw.thrownAt > now + 2_000) return undefined;
  return {
    playId: raw.playId,
    thrownAt: raw.thrownAt,
    throwerId: raw.throwerId,
    fromX: raw.fromX,
    fromZ: raw.fromZ,
    toX: raw.toX,
    toZ: raw.toZ,
  };
}

export function publicBall(ball: BallState | undefined | null, now: number): PublicBall | null {
  const live = migrateBall(ball, now);
  if (!live || fetchPose(live, now).done) return null;
  return {
    playId: live.playId,
    thrownAt: live.thrownAt,
    throwerId: live.throwerId,
    fromX: Math.round(live.fromX * 1000) / 1000,
    fromZ: Math.round(live.fromZ * 1000) / 1000,
    toX: Math.round(live.toX * 1000) / 1000,
    toZ: Math.round(live.toZ * 1000) / 1000,
  };
}

export function isBallLive(ball: BallState | undefined | null, now: number) {
  return publicBall(ball, now) !== null;
}

export function makeBall(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  throwerId: string,
  now: number,
  yaw = 0,
): BallState {
  const target = clampThrowTarget(fromX, fromZ, toX, toZ, yaw);
  return {
    playId: `t${now.toString(36)}`,
    thrownAt: now,
    throwerId,
    fromX,
    fromZ,
    toX: target.x,
    toZ: target.z,
  };
}

export type FetchPose = {
  x: number;
  z: number;
  yaw: number;
  gait: Gait;
  vx: number;
  vz: number;
  carrying: boolean;
  done: boolean;
  outbound: number;
  pickedAt: number;
};

/** Deterministic run-and-return from the throw seed so clients can predict instantly. */
export function fetchPose(ball: BallState, now: number): FetchPose {
  const dx = ball.toX - ball.fromX;
  const dz = ball.toZ - ball.fromZ;
  const outbound = Math.hypot(dx, dz) || THROW_MIN_M;
  const speed = fetchSpeed(outbound);
  const runMs = (outbound / speed) * 1000;
  const airMs = airDuration(outbound);
  const pickedAt = ball.thrownAt + Math.max(runMs, airMs);
  const homeMs = (outbound / speed) * 1000;
  const doneAt = pickedAt + homeMs;
  const outYaw = headingYaw(dx, dz);
  const homeYaw = headingYaw(-dx, -dz);

  if (now - ball.thrownAt > FETCH_TTL_MS || now >= doneAt) {
    return {
      x: ball.fromX,
      z: ball.fromZ,
      yaw: homeYaw,
      gait: 'idle',
      vx: 0,
      vz: 0,
      carrying: false,
      done: true,
      outbound,
      pickedAt,
    };
  }

  if (now < ball.thrownAt + runMs) {
    const t = Math.max(0, Math.min(1, (now - ball.thrownAt) / runMs));
    const gait: Gait = speed >= RUN_SPEED ? 'run' : 'walk';
    return {
      x: ball.fromX + dx * t,
      z: ball.fromZ + dz * t,
      yaw: outYaw,
      gait,
      vx: Math.sin(outYaw) * speed,
      vz: Math.cos(outYaw) * speed,
      carrying: false,
      done: false,
      outbound,
      pickedAt,
    };
  }

  if (now < pickedAt) {
    return {
      x: ball.toX,
      z: ball.toZ,
      yaw: outYaw,
      gait: 'idle',
      vx: 0,
      vz: 0,
      carrying: false,
      done: false,
      outbound,
      pickedAt,
    };
  }

  const back = Math.max(0, Math.min(1, (now - pickedAt) / homeMs));
  const gait: Gait = speed >= RUN_SPEED ? 'run' : 'walk';
  return {
    x: ball.toX + (ball.fromX - ball.toX) * back,
    z: ball.toZ + (ball.fromZ - ball.toZ) * back,
    yaw: homeYaw,
    gait,
    vx: Math.sin(homeYaw) * speed,
    vz: Math.cos(homeYaw) * speed,
    carrying: true,
    done: false,
    outbound,
    pickedAt,
  };
}

export function ballVisual(
  ball: BallState,
  now: number,
  dog?: { x: number; z: number } | null,
): { x: number; y: number; z: number; visible: boolean; spinning: boolean } {
  const scripted = fetchPose(ball, now);
  if (scripted.done) return { x: ball.fromX, y: BALL_RADIUS, z: ball.fromZ, visible: false, spinning: false };

  const dist = scripted.outbound;
  const airMs = airDuration(dist);
  const height = airHeight(dist);
  const elapsed = now - ball.thrownAt;

  if (elapsed < airMs) {
    const t = Math.max(0, Math.min(1, elapsed / airMs));
    const ease = t * t * (3 - 2 * t);
    return {
      x: ball.fromX + (ball.toX - ball.fromX) * ease,
      y: Math.sin(Math.PI * t) * height + BALL_RADIUS,
      z: ball.fromZ + (ball.toZ - ball.fromZ) * ease,
      visible: true,
      spinning: true,
    };
  }

  if (scripted.carrying && dog) {
    return { x: dog.x + Math.sin(scripted.yaw) * 0.34, y: 0.42, z: dog.z + Math.cos(scripted.yaw) * 0.34, visible: true, spinning: false };
  }

  const after = elapsed - airMs;
  const bounceMs = 380;
  if (after < bounceMs) {
    const u = after / bounceMs;
    return {
      x: ball.toX,
      y: Math.abs(Math.sin(Math.PI * u)) * height * 0.26 * (1 - u) + BALL_RADIUS,
      z: ball.toZ,
      visible: true,
      spinning: true,
    };
  }

  return { x: ball.toX, y: BALL_RADIUS, z: ball.toZ, visible: true, spinning: false };
}

export function sameThrow(local: BallState, server: BallState) {
  return (
    local.playId === server.playId ||
    (local.throwerId === server.throwerId &&
      Math.hypot(local.toX - server.toX, local.toZ - server.toZ) < 1.6 &&
      Math.abs(local.thrownAt - server.thrownAt) < 2_000)
  );
}

export function reconcileBall(local: BallState | null | undefined, server: BallState | null | undefined, now: number) {
  const liveServer = migrateBall(server, now);
  const liveLocal = migrateBall(local, now);
  if (liveServer && liveLocal && sameThrow(liveLocal, liveServer)) {
    return { ...liveServer, thrownAt: Math.min(liveLocal.thrownAt, liveServer.thrownAt) };
  }
  if (liveServer) return liveServer;
  if (liveLocal && !fetchPose(liveLocal, now).done) return liveLocal;
  return null;
}

export function tickFetch(yard: YardState, now: number): YardState {
  const ball = migrateBall(yard.ball, now);
  if (!ball) {
    if (!yard.ball) return yard;
    return { ...yard, ball: undefined };
  }
  const scripted = fetchPose(ball, now);
  const leash = yard.leash
    ? { ...yard.leash, lastInputAt: now }
    : yard.leash;
  if (scripted.done) {
    return {
      ...yard,
      ball: undefined,
      lastThrowAt: yard.lastThrowAt ?? ball.thrownAt,
      leash,
      pose: {
        ...yard.pose,
        x: scripted.x,
        z: scripted.z,
        yaw: scripted.yaw,
        vx: 0,
        vz: 0,
        gait: 'idle',
      },
    };
  }
  return {
    ...yard,
    ball,
    leash,
    pose: {
      ...yard.pose,
      x: scripted.x,
      z: scripted.z,
      yaw: scripted.yaw,
      vx: scripted.vx,
      vz: scripted.vz,
      gait: scripted.gait,
    },
  };
}

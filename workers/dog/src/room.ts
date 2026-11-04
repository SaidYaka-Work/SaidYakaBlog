/** Shared yard physics, leash rules, and feeder/walk caps. Worker is authoritative. */

export const ROOM_HALF = 3.05;
export const DOG_RADIUS = 0.28;
export const WALK_SPEED = 1.35;
export const RUN_SPEED = 2.6;
export const ACCEL = 5.2;
export const DECEL = 6.4;
export const YAW_TURN = 3.4;
export const TURN_ALIGN = 0.18;
export const MOVE_MIN_MS = 70;
export const MOVE_DT_MAX = 0.18;
export const LEASH_IDLE_MS = 12_000;
export const LEASH_MAX_MS = 90_000;
export const LEASH_COOLDOWN_MS = 20_000;
export const FEEDER = { x: -1.62, y: 0.07, z: 1.38, radius: 0.74 };
export const BED = { x: 1.72, z: -1.52, radius: 0.58 };
export const RUG = { x: 0.05, z: 0.06, radius: 0.95 };
export const WALK_CREDIT_M = 8;
export const MAX_LEASH_QUEUE = 16;
export const WALK_CAP_SESSION_M = 40;
export const WALK_CAP_HOUR_M = 80;
export const EAT_MS = 2_400;
export const YARD_TICK_MS = 250;
export const AI_TICK_MS = 800;

export type Gait = 'idle' | 'walk' | 'run' | 'sit' | 'lie' | 'eat' | 'sniff';

export type Pose = {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  gait: Gait;
};

export type LeashWait = { id: string; ip: string };

export type Leash = {
  holderId: string | null;
  holderIp: string | null;
  since: number;
  lastInputAt: number;
  sessionMeters: number;
  creditedMeters: number;
  hourMeters: number;
  hourStartedAt: number;
  cooldownUntil: Record<string, number>;
  /** FIFO waiters. Handoff on release; older rooms migrate to []. */
  queue: LeashWait[];
};

export type FeederState = {
  hasFood: boolean;
  filledAt: number;
  eatingUntil: number;
  /** Local-space bowl. Missing on older rooms; migrate places it near the dog. */
  x?: number;
  z?: number;
};

export type AiMode = 'idle' | 'wander' | 'sniff' | 'sit' | 'bed' | 'feeder';

export type YardAi = {
  mode: AiMode;
  until: number;
  tx: number;
  tz: number;
};

export type YardState = {
  pose: Pose;
  leash: Leash;
  feeder: FeederState;
  ai: YardAi;
  /** Present after the open-world worker deploy. Older rooms migrate in. */
  location?: import('./world').Location;
  /** Memory-only fetch ball. Older rooms migrate to undefined. */
  ball?: import('./fetch').BallState;
  lastThrowAt?: number;
};

export type Circle = { x: number; z: number; radius: number };

/** Solid props the dog slides around. Bed and feeder stay walkable. */
export const BLOCKERS: Circle[] = [
  { x: 1.58, z: -0.15, radius: 0.28 },
  { x: -1.72, z: -1.42, radius: 0.3 },
  { x: 0.15, z: 2.28, radius: 0.22 },
];

/** Gap in the far (-Z) fence. Walking through leaves the yard. */
export const GATE = { x: 0, z: -ROOM_HALF, half: 0.58 };

export function nearGate(x: number, z: number) {
  return Math.abs(x - GATE.x) <= GATE.half && z <= -ROOM_HALF + 0.7;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function headingYaw(dx: number, dz: number) {
  return Math.atan2(dx, dz);
}

export function feederSpot(feeder?: Pick<FeederState, 'x' | 'z'> | null) {
  return {
    x: Number.isFinite(feeder?.x) ? feeder!.x! : FEEDER.x,
    z: Number.isFinite(feeder?.z) ? feeder!.z! : FEEDER.z,
    radius: FEEDER.radius,
  };
}

/** Portable bowl to the dog's right so dinner is a short walk, not a room prop. */
export function placeFeeder(pose: Pick<Pose, 'x' | 'z' | 'yaw'>): { x: number; z: number } {
  const rightX = Math.cos(pose.yaw) * 1.25;
  const rightZ = -Math.sin(pose.yaw) * 1.25;
  return { x: pose.x + rightX, z: pose.z + rightZ };
}

export function eatStand(feeder?: Pick<FeederState, 'x' | 'z'> | null): { x: number; z: number; yaw: number } {
  const bowl = feederSpot(feeder);
  const x = bowl.x + 0.62;
  const z = bowl.z;
  return { x, z, yaw: headingYaw(bowl.x - x, bowl.z - z) };
}

export function createYard(now: number): YardState {
  return {
    pose: { x: 0, z: 0, yaw: 0.55, vx: 0, vz: 0, gait: 'idle' },
    leash: {
      holderId: null,
      holderIp: null,
      since: 0,
      lastInputAt: 0,
      sessionMeters: 0,
      creditedMeters: 0,
      hourMeters: 0,
      hourStartedAt: now,
      cooldownUntil: {},
      queue: [],
    },
    feeder: { hasFood: false, filledAt: 0, eatingUntil: 0, ...placeFeeder({ x: 0, z: 0, yaw: 0.55 }) },
    ai: { mode: 'idle', until: now + 2_400, tx: 0, tz: 0 },
  };
}

export function migrateYard(yard: YardState | undefined, now: number): YardState {
  if (!yard || !yard.pose || !yard.leash || !yard.feeder || !yard.ai) return createYard(now);
  return {
    pose: { ...createYard(now).pose, ...yard.pose },
    leash: {
      ...createYard(now).leash,
      ...yard.leash,
      cooldownUntil: yard.leash.cooldownUntil ?? {},
      queue: migrateQueue(yard.leash.queue),
    },
    feeder: { ...createYard(now).feeder, ...yard.feeder },
    ai: { ...createYard(now).ai, ...yard.ai },
    location: yard.location,
    ball: yard.ball,
    lastThrowAt: Number.isFinite(yard.lastThrowAt) ? yard.lastThrowAt : undefined,
  };
}

export function normalizeInput(ax: number, az: number) {
  const x = Number.isFinite(ax) ? clamp(ax, -1, 1) : 0;
  const z = Number.isFinite(az) ? clamp(az, -1, 1) : 0;
  const mag = Math.hypot(x, z);
  if (mag <= 1) return { ax: x, az: z, mag };
  return { ax: x / mag, az: z / mag, mag: 1 };
}

export function resolveCircle(x: number, z: number, cx: number, cz: number, minDist: number) {
  const dx = x - cx;
  const dz = z - cz;
  const dist = Math.hypot(dx, dz);
  if (dist >= minDist) return { x, z, hit: false };
  if (dist < 1e-6) return { x: cx + minDist, z: cz, hit: true };
  const scale = minDist / dist;
  return { x: cx + dx * scale, z: cz + dz * scale, hit: true };
}

export function collide(x: number, z: number, extras: Circle[] = []) {
  const limit = ROOM_HALF - DOG_RADIUS;
  let nx = clamp(x, -limit, limit);
  let nz = clamp(z, -limit, limit);
  for (const prop of [...BLOCKERS, ...extras]) {
    const next = resolveCircle(nx, nz, prop.x, prop.z, prop.radius + DOG_RADIUS);
    nx = next.x;
    nz = next.z;
  }
  nx = clamp(nx, -limit, limit);
  nz = clamp(nz, -limit, limit);
  return { x: nx, z: nz };
}

/** Slide along walls/props instead of stopping dead. */
export function slide(ox: number, oz: number, nx: number, nz: number) {
  const full = collide(nx, nz);
  if (Math.abs(full.x - nx) < 1e-4 && Math.abs(full.z - nz) < 1e-4) return full;
  const onlyX = collide(nx, oz);
  if (Math.abs(onlyX.x - nx) < 1e-4) return { x: onlyX.x, z: onlyX.z };
  const onlyZ = collide(ox, nz);
  if (Math.abs(onlyZ.z - nz) < 1e-4) return { x: onlyZ.x, z: onlyZ.z };
  return collide(ox, oz);
}

export function nearFeeder(x: number, z: number, feeder?: Pick<FeederState, 'x' | 'z'> | null) {
  const bowl = feederSpot(feeder);
  return Math.hypot(x - bowl.x, z - bowl.z) <= bowl.radius;
}

export function nearBed(x: number, z: number) {
  return Math.hypot(x - BED.x, z - BED.z) <= BED.radius + 0.12;
}

export function wrapAngle(value: number) {
  let next = value;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
}

export function gaitFromSpeed(speed: number, run: boolean, prev: Gait = 'idle'): Gait {
  if (speed < 0.08) return 'idle';
  if (prev === 'idle' && speed < 0.2) return 'idle';
  if (prev === 'walk' && speed < 0.14) return 'walk';
  if (run && (speed > WALK_SPEED * 0.92 || (prev === 'run' && speed > WALK_SPEED * 0.64))) return 'run';
  if (speed < 0.12) return 'idle';
  return 'walk';
}

export function integratePose(
  pose: Pose,
  ax: number,
  az: number,
  run: boolean,
  dt: number,
): { pose: Pose; meters: number } {
  const input = normalizeInput(ax, az);
  const moving = input.mag > 0.08;
  let yaw = pose.yaw;
  let aligned = 1;
  if (moving) {
    const want = headingYaw(input.ax, input.az);
    const diff = wrapAngle(want - yaw);
    const step = clamp(diff, -YAW_TURN * dt, YAW_TURN * dt);
    yaw += step;
    aligned = Math.cos(wrapAngle(want - yaw));
  }
  const turnInPlace = moving && aligned < TURN_ALIGN;
  const top = (run ? RUN_SPEED : WALK_SPEED) * input.mag;
  const target = !moving || turnInPlace ? 0 : top * Math.max(0.28, aligned);
  const current = Math.hypot(pose.vx, pose.vz);
  const rate = target > current ? ACCEL : DECEL;
  const speed = current + (target - current) * Math.min(1, rate * dt);
  const vx = Math.sin(yaw) * speed;
  const vz = Math.cos(yaw) * speed;
  const next = slide(pose.x, pose.z, pose.x + vx * dt, pose.z + vz * dt);
  const meters = Math.hypot(next.x - pose.x, next.z - pose.z);
  return {
    meters,
    pose: {
      x: next.x,
      z: next.z,
      yaw,
      vx,
      vz,
      gait: gaitFromSpeed(speed, run, pose.gait),
    },
  };
}

/** Steer around circular props instead of walking into them. */
export function steerToward(x: number, z: number, tx: number, tz: number) {
  let ax = tx - x;
  let az = tz - z;
  const dist = Math.hypot(ax, az);
  if (dist < 1e-4) return { ax: 0, az: 0 };
  ax /= dist;
  az /= dist;
  const look = 0.62;
  const aheadX = x + ax * look;
  const aheadZ = z + az * look;
  const hit = collide(aheadX, aheadZ);
  if (Math.hypot(hit.x - aheadX, hit.z - aheadZ) < 0.05) return { ax, az };
  const left = { ax: -az, az: ax };
  const right = { ax: az, az: -ax };
  const probe = (dir: { ax: number; az: number }) => {
    const px = x + dir.ax * look;
    const pz = z + dir.az * look;
    const placed = collide(px, pz);
    const free = Math.hypot(placed.x - px, placed.z - pz) < 0.05;
    const closer = Math.hypot(tx - (x + dir.ax), tz - (z + dir.az));
    return { free, closer, dir };
  };
  const l = probe(left);
  const r = probe(right);
  if (l.free && r.free) return l.closer <= r.closer ? l.dir : r.dir;
  if (l.free) return l.dir;
  if (r.free) return r.dir;
  return { ax, az };
}

export function migrateQueue(raw: Leash['queue'] | string[] | undefined): LeashWait[] {
  if (!Array.isArray(raw)) return [];
  const next: LeashWait[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item) next.push({ id: item, ip: '' });
    else if (item && typeof item === 'object' && typeof item.id === 'string' && item.id) {
      next.push({ id: item.id, ip: typeof item.ip === 'string' ? item.ip : '' });
    }
    if (next.length >= MAX_LEASH_QUEUE) break;
  }
  return next;
}

export function enqueueLeash(queue: LeashWait[], id: string, ip: string): LeashWait[] {
  if (!id || queue.some((wait) => wait.id === id)) return queue;
  return [...queue, { id, ip }].slice(0, MAX_LEASH_QUEUE);
}

export function dropLeashWait(yard: YardState, clientId: string): YardState {
  return {
    ...yard,
    leash: {
      ...yard.leash,
      queue: (yard.leash.queue ?? []).filter((wait) => wait.id !== clientId),
    },
  };
}

export function pruneCooldowns(map: Record<string, number>, now: number) {
  const next: Record<string, number> = {};
  for (const [ip, until] of Object.entries(map)) {
    if (until > now) next[ip] = until;
  }
  return next;
}

export function leashExpired(leash: Leash, now: number) {
  if (!leash.holderId) return false;
  return now - leash.lastInputAt >= LEASH_IDLE_MS;
}

export function releaseLeash(
  yard: YardState,
  now: number,
  liveIds?: Iterable<string>,
  reason: 'idle' | 'leave' = 'leave',
): YardState {
  const leash = yard.leash;
  const cooldownUntil = { ...pruneCooldowns(leash.cooldownUntil, now) };
  if (reason !== 'idle' && leash.holderIp) cooldownUntil[leash.holderIp] = now + LEASH_COOLDOWN_MS;
  const live = liveIds ? new Set(liveIds) : null;
  const waiting = migrateQueue(leash.queue).filter(
    (wait) => wait.id && wait.id !== leash.holderId && (!live || live.has(wait.id)),
  );
  const next = waiting[0];
  const idlePose = {
    ...yard.pose,
    vx: 0,
    vz: 0,
    gait: yard.pose.gait === 'run' || yard.pose.gait === 'walk' ? 'idle' : yard.pose.gait,
  };
  if (next) {
    return {
      ...yard,
      pose: idlePose,
      leash: {
        ...leash,
        holderId: next.id,
        holderIp: next.ip || null,
        since: now,
        lastInputAt: now,
        sessionMeters: 0,
        creditedMeters: 0,
        cooldownUntil,
        queue: waiting.slice(1),
      },
      ai: { mode: 'idle', until: now + 1_200, tx: yard.pose.x, tz: yard.pose.z },
    };
  }
  return {
    ...yard,
    pose: idlePose,
    leash: {
      ...leash,
      holderId: null,
      holderIp: null,
      since: 0,
      lastInputAt: 0,
      sessionMeters: 0,
      creditedMeters: 0,
      cooldownUntil,
      queue: waiting,
    },
    ai: { mode: 'idle', until: now + 1_200, tx: yard.pose.x, tz: yard.pose.z },
    feeder: { ...yard.feeder, ...placeFeeder(idlePose) },
  };
}

export function tryAcquireLeash(
  yard: YardState,
  clientId: string,
  ip: string,
  now: number,
): { ok: true; yard: YardState } | { ok: false; code: 'busy' | 'cooldown'; retryAfterMs: number; yard: YardState } {
  let current = migrateYard(yard, now);
  if (current.leash.holderId && current.leash.holderId !== clientId && leashExpired(current.leash, now)) {
    current = releaseLeash(current, now, undefined, 'idle');
  }
  if (current.leash.holderId === clientId) {
    return {
      ok: true,
      yard: {
        ...current,
        leash: {
          ...current.leash,
          queue: (current.leash.queue ?? []).filter((wait) => wait.id !== clientId),
        },
      },
    };
  }
  if (current.leash.holderId) {
    const idleLeft = Math.max(0, LEASH_IDLE_MS - (now - current.leash.lastInputAt));
    const maxLeft = Math.max(0, LEASH_MAX_MS - (now - current.leash.since));
    return {
      ok: false,
      code: 'busy',
      retryAfterMs: Math.min(idleLeft || maxLeft, maxLeft),
      yard: {
        ...current,
        leash: { ...current.leash, queue: enqueueLeash(current.leash.queue ?? [], clientId, ip) },
      },
    };
  }
  const blockedUntil = current.leash.cooldownUntil[ip] ?? 0;
  if (blockedUntil > now) {
    return { ok: false, code: 'cooldown', retryAfterMs: blockedUntil - now, yard: current };
  }
  return {
    ok: true,
    yard: {
      ...current,
      pose: { ...current.pose, gait: current.pose.gait === 'lie' || current.pose.gait === 'eat' ? 'idle' : current.pose.gait },
      leash: {
        ...current.leash,
        holderId: clientId,
        holderIp: ip,
        since: now,
        lastInputAt: now,
        sessionMeters: 0,
        creditedMeters: 0,
        cooldownUntil: pruneCooldowns(current.leash.cooldownUntil, now),
        queue: (current.leash.queue ?? []).filter((wait) => wait.id !== clientId),
      },
    },
  };
}

export function applyDrive(
  yard: YardState,
  ax: number,
  az: number,
  run: boolean,
  dt: number,
  now: number,
): YardState {
  const current = migrateYard(yard, now);
  if (current.feeder.eatingUntil > now) {
    const stand = eatStand();
    return {
      ...current,
      pose: { ...current.pose, x: stand.x, z: stand.z, yaw: stand.yaw, vx: 0, vz: 0, gait: 'eat' },
    };
  }
  const stepped = integratePose(current.pose, ax, az, run, clamp(dt, 0, MOVE_DT_MAX));
  const input = normalizeInput(ax, az);
  const moving = input.mag > 0.08;
  let sessionMeters = current.leash.sessionMeters;
  let hourMeters = current.leash.hourMeters;
  let hourStartedAt = current.leash.hourStartedAt;
  if (now - hourStartedAt >= 3_600_000) {
    hourMeters = 0;
    hourStartedAt = now;
  }
  if (current.leash.holderId && moving) {
    const room = Math.min(stepped.meters, RUN_SPEED * MOVE_DT_MAX + 0.05);
    const sessionLeft = Math.max(0, WALK_CAP_SESSION_M - sessionMeters);
    const hourLeft = Math.max(0, WALK_CAP_HOUR_M - hourMeters);
    const added = Math.min(room, sessionLeft, hourLeft);
    sessionMeters = Math.min(WALK_CAP_SESSION_M, sessionMeters + added);
    hourMeters = Math.min(WALK_CAP_HOUR_M, hourMeters + added);
  } else {
    sessionMeters = Math.min(WALK_CAP_SESSION_M, sessionMeters);
    hourMeters = Math.min(WALK_CAP_HOUR_M, hourMeters);
  }
  return {
    ...current,
    pose: stepped.pose,
    leash: {
      ...current.leash,
      lastInputAt: moving && current.leash.holderId ? now : current.leash.lastInputAt,
      sessionMeters,
      hourMeters,
      hourStartedAt,
    },
  };
}

export function walkCreditPending(leash: Leash) {
  const uncapped = Math.max(0, Math.min(leash.sessionMeters, WALK_CAP_SESSION_M) - leash.creditedMeters);
  const hourLeft = Math.max(0, WALK_CAP_HOUR_M - leash.hourMeters);
  return Math.min(uncapped, hourLeft);
}

export function markWalkCredited(yard: YardState, meters = WALK_CREDIT_M): YardState {
  return {
    ...yard,
    leash: {
      ...yard.leash,
      creditedMeters: yard.leash.creditedMeters + meters,
    },
  };
}

export function fillFeeder(yard: YardState, now: number): YardState {
  return {
    ...yard,
    feeder: { ...yard.feeder, hasFood: true, filledAt: now },
  };
}

export function startEating(yard: YardState, now: number): YardState {
  const stand = eatStand(yard.feeder);
  return {
    ...yard,
    pose: { x: stand.x, z: stand.z, yaw: stand.yaw, vx: 0, vz: 0, gait: 'eat' },
    feeder: { ...yard.feeder, hasFood: false, filledAt: yard.feeder.filledAt, eatingUntil: now + EAT_MS },
    ai: { mode: 'idle', until: now + EAT_MS + 400, tx: stand.x, tz: stand.z },
  };
}

export function randomOpenPoint(rng: () => number = Math.random) {
  for (let i = 0; i < 12; i += 1) {
    const x = (rng() * 2 - 1) * (ROOM_HALF - 0.7);
    const z = (rng() * 2 - 1) * (ROOM_HALF - 0.7);
    const placed = collide(x, z);
    if (Math.hypot(placed.x - x, placed.z - z) < 0.05) return placed;
  }
  return { x: 0, z: 0 };
}

export function tickYardAi(
  yard: YardState,
  now: number,
  dt: number,
  opts: { hungry?: boolean; tired?: boolean; asleep?: boolean } = {},
  rng: () => number = Math.random,
): YardState {
  let current = migrateYard(yard, now);
  if (current.leash.holderId) {
    if (leashExpired(current.leash, now)) current = releaseLeash(current, now, undefined, 'idle');
    else return current;
  }
  if (current.feeder.eatingUntil > now) {
    const stand = eatStand();
    return {
      ...current,
      pose: { ...current.pose, x: stand.x, z: stand.z, yaw: stand.yaw, vx: 0, vz: 0, gait: 'eat' },
    };
  }

  const hungry = Boolean(opts.hungry && current.feeder.hasFood);
  const tired = Boolean(opts.tired || opts.asleep);
  let mode = current.ai.mode;
  let until = current.ai.until;
  let tx = current.ai.tx;
  let tz = current.ai.tz;

  if (hungry) {
    mode = 'feeder';
    tx = eatStand().x;
    tz = eatStand().z;
    until = now + 8_000;
  } else if (tired && mode !== 'bed') {
    mode = 'bed';
    tx = BED.x;
    tz = BED.z;
    until = now + 12_000;
  } else if (now >= until && !hungry) {
    const pick = rng();
    if (pick < 0.42) {
      mode = 'wander';
      const point = randomOpenPoint(rng);
      tx = point.x;
      tz = point.z;
      until = now + 3_600 + rng() * 2_400;
    } else if (pick < 0.62) {
      mode = 'sniff';
      tx = current.pose.x;
      tz = current.pose.z;
      until = now + 1_600 + rng() * 1_200;
    } else if (pick < 0.8) {
      mode = 'sit';
      tx = current.pose.x;
      tz = current.pose.z;
      until = now + 2_200 + rng() * 1_800;
    } else {
      mode = 'idle';
      tx = current.pose.x;
      tz = current.pose.z;
      until = now + 2_000 + rng() * 2_000;
    }
  }

  const dx = tx - current.pose.x;
  const dz = tz - current.pose.z;
  const dist = Math.hypot(dx, dz);
  const arrive = dist < 0.18;
  let pose = current.pose;
  let feeder = current.feeder;

  if ((mode === 'wander' || mode === 'feeder' || mode === 'bed') && !arrive) {
    const steer = steerToward(pose.x, pose.z, tx, tz);
    const sprint = mode === 'wander' && dist > 1.6 && Math.floor(until / 1800) % 9 === 0;
    const stepped = integratePose(pose, steer.ax, steer.az, sprint, clamp(dt, 0, 0.25));
    pose = stepped.pose;
  } else if (mode === 'feeder' && (arrive || nearFeeder(pose.x, pose.z, current.feeder))) {
    current = startEating(current, now);
    pose = current.pose;
    feeder = current.feeder;
    mode = 'idle';
    until = now + EAT_MS;
  } else if (mode === 'bed' && (arrive || nearBed(pose.x, pose.z))) {
    pose = { ...pose, x: BED.x, z: BED.z, yaw: 1.2, vx: 0, vz: 0, gait: 'lie' };
  } else if (mode === 'sniff') {
    pose = { ...pose, vx: 0, vz: 0, gait: 'sniff' };
  } else if (mode === 'sit') {
    pose = { ...pose, vx: 0, vz: 0, gait: 'sit' };
  } else {
    pose = { ...pose, vx: 0, vz: 0, gait: pose.gait === 'lie' ? 'lie' : 'idle' };
  }

  return {
    ...current,
    pose,
    feeder,
    ai: { mode, until, tx, tz },
  };
}

export function clampTeleport(from: Pose, to: Pose, dt: number) {
  const maxStep = RUN_SPEED * Math.max(dt, MOVE_DT_MAX) + 0.35;
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  if (dist <= maxStep) return collide(to.x, to.z);
  const scale = maxStep / dist;
  return collide(from.x + (to.x - from.x) * scale, from.z + (to.z - from.z) * scale);
}

export function publicPose(pose: Pose) {
  return {
    x: Math.round(pose.x * 1000) / 1000,
    z: Math.round(pose.z * 1000) / 1000,
    yaw: Math.round(pose.yaw * 1000) / 1000,
    gait: pose.gait,
  };
}

export function publicLeash(leash: Leash, now: number) {
  const held = Boolean(leash.holderId) && !leashExpired(leash, now);
  const queue = migrateQueue(leash.queue).map((wait) => wait.id);
  return {
    held,
    holderId: held ? leash.holderId : null,
    queue,
    nextId: queue[0] ?? null,
  };
}

export function publicFeeder(feeder: FeederState, pose: Pose, now: number) {
  const bowl = feederSpot(feeder);
  return {
    hasFood: feeder.hasFood || feeder.eatingUntil > now,
    eating: feeder.eatingUntil > now,
    near: nearFeeder(pose.x, pose.z, feeder),
    x: Math.round(bowl.x * 1000) / 1000,
    z: Math.round(bowl.z * 1000) / 1000,
  };
}

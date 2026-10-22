import { createYard } from '../workers/dog/src/room.ts';
import { applyWorldDrive } from '../workers/dog/src/world.ts';
import { reconcileDriver, pushTrail, type TrailPoint } from '../components/dog/motion.ts';

// One-way latency, server pose tick, client send interval (as shipped).
const ONE_WAY = Number(process.env.OW || 80);
const TICK = 250;
const SEND = 80;
const MOVE_MIN = 70;
const FRAME = 1000 / 60;
const jitter = () => (Math.random() - 0.5) * Number(process.env.JIT || 30);

type Report = {
  reconcile: boolean;
  trail: boolean;
  run: boolean;
  OW: number;
  localZ: number;
  serverZ: number;
  idealZ: number;
  drift_med: number;
  drift_max: number;
  corrections: number;
  snaps: number;
  speed_med: number;
  speed_p10: number;
  proposedAccepted: number;
  proposedRejected: number;
  movesDropped: number;
  walkPct: number;
};

function run(reconcile: boolean, runFlag: boolean, useTrail: boolean): Report {
  let now = 1_800_000_000_000;
  const t0 = now;
  const base = createYard(now);
  let local = structuredClone(base);
  let server = structuredClone(base);
  let serverSeen: { x: number; z: number; yaw: number } | null = null;
  let onPose: { x: number; z: number } | null = null;
  let lastOnPose = 0;
  let lastSend = 0;
  let lastMoveAt = 0;
  const toServer: [number, { ax: number; az: number; run: boolean; wx?: number; wz?: number }][] = [];
  const toClient: [number, { x: number; z: number; yaw: number }][] = [];
  let lastTick = now;
  const trail: TrailPoint[] = [];
  let snaps = 0;
  let pulls = 0;
  let accepted = 0;
  let rejected = 0;
  let dropped = 0;
  const lagS: number[] = [];
  let prevZ = 0;
  const speeds: number[] = [];
  const end = now + 12000;
  for (; now < end; now += FRAME) {
    const pressing = now - t0 < 8000;
    const ax = 0;
    const az = pressing ? -1 : 0;
    while (toServer.length && toServer[0][0] <= now) {
      const [, m] = toServer.shift()!;
      const wait = lastMoveAt + MOVE_MIN - now;
      if (wait > 0) {
        dropped += 1;
        continue;
      }
      const dt = lastMoveAt ? Math.min(0.18, (now - lastMoveAt) / 1000) : 0.08;
      lastMoveAt = now;
      const next = applyWorldDrive(server, m.ax, m.az, m.run, dt, now, m.wx !== undefined ? { x: m.wx, z: m.wz! } : null);
      if (m.wx !== undefined) {
        if (Math.abs(next.pose.z - m.wz!) < 1e-6) accepted += 1;
        else rejected += 1;
      }
      server = next;
    }
    if (now - lastTick >= TICK) {
      lastTick = now;
      toClient.push([now + ONE_WAY + jitter(), { ...server.pose }]);
    }
    while (toClient.length && toClient[0][0] <= now) serverSeen = toClient.shift()![1];
    local = applyWorldDrive(local, ax, az, runFlag, FRAME / 1000, now, null, [], [], []);
    const pre = { x: local.pose.x, z: local.pose.z };
    if (reconcile) {
      pushTrail(trail, now, local.pose.x, local.pose.z);
      const mixed = reconcileDriver(local.pose, serverSeen, useTrail ? trail : undefined);
      if (mixed.x !== pre.x || mixed.z !== pre.z) {
        const d = Math.hypot(pre.x - mixed.x, pre.z - mixed.z);
        if (d > 0.5) snaps += 1;
        else pulls += 1;
      }
      local.pose.x = mixed.x;
      local.pose.z = mixed.z;
      local.pose.yaw = mixed.yaw;
    }
    if (now - lastOnPose >= 80) {
      lastOnPose = now;
      onPose = { x: local.pose.x, z: local.pose.z };
    }
    if (now - lastSend >= SEND) {
      lastSend = now;
      toServer.push([
        now + ONE_WAY + jitter(),
        { ax, az, run: runFlag, ...(onPose ? { wx: onPose.x, wz: onPose.z } : {}) },
      ]);
    }
    toServer.sort((a, b) => a[0] - b[0]);
    toClient.sort((a, b) => a[0] - b[0]);
    if (serverSeen && pressing && now - t0 > 1000) {
      lagS.push(Math.hypot(local.pose.x - serverSeen.x, local.pose.z - serverSeen.z));
    }
    if (pressing && now - t0 > 1000) speeds.push(Math.abs(local.pose.z - prevZ) / (FRAME / 1000));
    prevZ = local.pose.z;
  }
  lagS.sort((a, b) => a - b);
  speeds.sort((a, b) => a - b);
  const ideal = runFlag ? 2.6 : 1.35;
  const idealZ = -(ideal * 8);
  return {
    reconcile,
    trail: useTrail,
    run: runFlag,
    OW: ONE_WAY,
    localZ: +local.pose.z.toFixed(2),
    serverZ: +server.pose.z.toFixed(2),
    idealZ: +idealZ.toFixed(1),
    drift_med: +(lagS[lagS.length >> 1] ?? 0).toFixed(2),
    drift_max: +(lagS[lagS.length - 1] ?? 0).toFixed(2),
    corrections: pulls,
    snaps,
    speed_med: +(speeds[speeds.length >> 1] ?? 0).toFixed(2),
    speed_p10: +(speeds[Math.floor(speeds.length * 0.1)] ?? 0).toFixed(2),
    proposedAccepted: accepted,
    proposedRejected: rejected,
    movesDropped: dropped,
    walkPct: +((Math.abs(local.pose.z) / Math.abs(idealZ)) * 100).toFixed(1),
  };
}

const rows: Report[] = [];
for (const rec of [false, true]) {
  for (const trail of rec ? [false, true] : [false]) {
    for (const rf of [false, true]) {
      rows.push(run(rec, rf, trail));
    }
  }
}

for (const row of rows) console.log(JSON.stringify(row));

const staleWalk = rows.find((row) => row.reconcile && !row.trail && !row.run);
const fixedWalk = rows.find((row) => row.reconcile && row.trail && !row.run);
if (!staleWalk || !fixedWalk) throw new Error('lag sim missing walk rows');
if (fixedWalk.walkPct < 90) {
  throw new Error(`trail reconcile walkPct ${fixedWalk.walkPct} is still short of 90%`);
}
if (staleWalk.walkPct > 0 && fixedWalk.walkPct < staleWalk.walkPct + 10) {
  throw new Error(`trail should recover walk distance (stale ${staleWalk.walkPct} vs fixed ${fixedWalk.walkPct})`);
}
if (fixedWalk.corrections > staleWalk.corrections) {
  throw new Error(`trail should cut corrections (stale ${staleWalk.corrections} vs fixed ${fixedWalk.corrections})`);
}

console.log('dog-lag-sim ok');

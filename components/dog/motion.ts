import { AnimationClip, Vector3, type Object3D, type SkinnedMesh } from 'three';
import type { DogGait, DogPose } from '@/lib/dog';

const ROOM_HALF = 3.05;
const YAW_TURN = 4.6;
export const RUN_SPEED = 2.6;
export const WALK_SPEED = 1.35;

function wrapAngle(value: number) {
  let next = value;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
}

export const FLOOR_Y = 0;
export const POSE_DELAY_MS = 100;
export const SNAP_DISTANCE = 1.65;
export const WALK_STRIDE = 1.18;
export const GALLOP_STRIDE = 2.75;
export const CLIP_BLEND = 0.28;

const _min = new Vector3();

const ROOT_BONES = /^(body|root|hips|animalarmature)$/i;

export function stripRootMotion(clip: AnimationClip) {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    const bone = track.name.split('.').slice(0, -1).join('.').split('|').pop() || '';
    if (!ROOT_BONES.test(bone)) continue;
    const values = track.values;
    if (values.length < 3) continue;
    const x0 = values[0];
    const y0 = values[1];
    const z0 = values[2];
    for (let i = 0; i < values.length; i += 3) {
      values[i] = x0;
      values[i + 1] = y0;
      values[i + 2] = z0;
    }
  }
  return clip;
}

export function computeFootOffset(root: Object3D) {
  root.updateWorldMatrix(true, true);
  let minY = Infinity;
  root.traverse((node) => {
    const mesh = node as SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.geometry || mesh.name === 'Collar') return;
    mesh.computeBoundingBox();
    if (!mesh.boundingBox || mesh.boundingBox.isEmpty()) return;
    const box = mesh.boundingBox;
    _min.set(box.min.x, box.min.y, box.min.z).applyMatrix4(mesh.matrixWorld);
    const y = _min.y;
    if (Number.isFinite(y)) minY = Math.min(minY, y);
  });
  const offset = minY - root.position.y;
  if (!Number.isFinite(offset) || Math.abs(offset) > 0.45) return 0;
  return offset;
}

export function plantOnFloor(root: Object3D, footOffset: number, floorY = FLOOR_Y) {
  const y = floorY - footOffset;
  root.position.y = Number.isFinite(y) ? y : floorY;
  return root.position.y;
}

export function strideTimeScale(gait: 'walk' | 'trot' | string, speed: number, base = 1) {
  if (gait === 'walk') return Math.max(0.72, Math.min(1.55, (speed || 0.2) / WALK_STRIDE)) * base;
  if (gait === 'trot') return Math.max(0.74, Math.min(1.4, (speed || 0.4) / GALLOP_STRIDE)) * base;
  return base;
}

export type PoseSample = { at: number; x: number; z: number; yaw: number; gait: DogGait };

export function pushSample(buffer: PoseSample[], sample: PoseSample, limit = 18) {
  buffer.push(sample);
  while (buffer.length > limit) buffer.shift();
}

export function sampleBuffer(
  buffer: PoseSample[],
  now: number,
  delayMs = POSE_DELAY_MS,
): { x: number; z: number; yaw: number; gait: DogGait; snapped: boolean } | null {
  if (!buffer.length) return null;
  const latest = buffer[buffer.length - 1];
  if (buffer.length === 1) return { ...latest, snapped: false };
  const span = Math.hypot(latest.x - buffer[0].x, latest.z - buffer[0].z);
  if (span > SNAP_DISTANCE) return { ...latest, snapped: true };
  const renderAt = now - delayMs;
  let i = 0;
  while (i < buffer.length - 2 && buffer[i + 1].at < renderAt) i += 1;
  const a = buffer[i];
  const b = buffer[i + 1] ?? a;
  const spanT = Math.max(1, b.at - a.at);
  const t = Math.max(0, Math.min(1, (renderAt - a.at) / spanT));
  let dyaw = wrapAngle(b.yaw - a.yaw);
  if (Math.abs(dyaw) > YAW_TURN * (spanT / 1000) + 0.35) dyaw = wrapAngle(b.yaw - a.yaw) * 0.35;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    yaw: a.yaw + dyaw * t,
    gait: t > 0.5 ? b.gait : a.gait,
    snapped: false,
  };
}

export type TrailPoint = { at: number; x: number; z: number };

/** Keep ~1.5 s of locally predicted positions so a lagged server echo can be matched. */
export function pushTrail(trail: TrailPoint[], at: number, x: number, z: number, keepMs = 1500) {
  trail.push({ at, x, z });
  while (trail.length && at - trail[0].at > keepMs) trail.shift();
}

/**
 * Server poses arrive one RTT plus up to one 250 ms tick late, and the Worker mostly
 * echoes our own proposed wx/wz. Compare the server pose to where we *were* (trail),
 * not where we are now, or every echo drags the dog backwards.
 */
export function reconcileDriver(local: DogPose, server: DogPose | null, trail?: TrailPoint[]): DogPose {
  if (!server) return local;
  let refX = local.x;
  let refZ = local.z;
  let drift = Math.hypot(local.x - server.x, local.z - server.z);
  if (trail) {
    for (const point of trail) {
      const d = Math.hypot(point.x - server.x, point.z - server.z);
      if (d < drift) {
        drift = d;
        refX = point.x;
        refZ = point.z;
      }
    }
  }
  if (drift > 2) {
    if (trail) trail.length = 0;
    return { ...local, x: server.x, z: server.z, yaw: server.yaw };
  }
  if (drift > 0.42) {
    // Nudge by the error the server saw at that moment, not toward its stale position.
    return {
      ...local,
      x: local.x + (server.x - refX) * 0.12,
      z: local.z + (server.z - refZ) * 0.12,
    };
  }
  return local;
}

export function hopHeight(startedAt: number, now: number) {
  const t = (now - startedAt) / 320;
  if (t < 0 || t > 1) return 0;
  return Math.sin(Math.PI * t) * 0.055;
}

export function insideYard(x: number, z: number) {
  return Math.abs(x) <= ROOM_HALF && Math.abs(z) <= ROOM_HALF;
}

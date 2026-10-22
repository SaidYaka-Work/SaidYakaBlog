/** Live frame-part timings and the camera-fade target. No per-frame allocations. */

export const frameMark = {
  drive: 0,
  camera: 0,
  collide: 0,
  tiles: 0,
};

export const camFade = {
  lookX: 0,
  lookY: 1.15,
  lookZ: 0,
  camX: 0,
  camY: 8,
  camZ: 14,
  fade: 0,
};

export const liveBuildingGrid: { current: unknown } = { current: null };

/** Live dog XZ from the rig. Spawn/QA lat/lng stay at the spawn; shared-dog lat/lng lag the pose. */
export const liveHere = { x: 0, z: 0, ready: false };

export function dogHere(fallback: { x: number; z: number }) {
  return liveHere.ready ? { x: liveHere.x, z: liveHere.z } : fallback;
}

/** Shared pixel-ratio cap. PerfProbe lowers this when p95 stays high. */
export const renderScale = { dpr: 1.25 };

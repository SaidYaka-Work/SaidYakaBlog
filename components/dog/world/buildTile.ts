/**
 * Time-sliced OSM tile mesh builder. Pure enough to drive from a unit test
 * without mounting React — every dress stage must advance or the job is dropped.
 */
import {
  BoxGeometry,
  BufferAttribute,
  ExtrudeGeometry,
  Shape,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { centroid, facadeTint, isMajorRoad, ringBounds } from './dress';
import type { TileBounds, WorldTileData } from './decode';

export type BuiltTile = {
  key: string;
  buildings: BufferGeometry[];
  roofs: BufferGeometry[];
  parks: BufferGeometry | null;
  water: BufferGeometry | null;
  sidewalks: BufferGeometry | null;
  roads: BufferGeometry | null;
  major: BufferGeometry | null;
};

export type DressStep = 'buildings' | 'merge' | 'parks' | 'water' | 'sidewalks' | 'roads' | 'major';

export const DRESS_STEPS: DressStep[] = ['buildings', 'merge', 'parks', 'water', 'sidewalks', 'roads', 'major'];

export type RibbonCursor = { road: number; seg: number; geos: BufferGeometry[] };

export type BuildJob = {
  tile: WorldTileData;
  lod: boolean;
  walls: BufferGeometry[];
  roofs: BufferGeometry[];
  index: number;
  list: WorldTileData['buildings'];
  dress: DressStep | 'done' | string;
  built: BuiltTile;
  ribbon: RibbonCursor | null;
};

export function emptyTile(key: string): BuiltTile {
  return {
    key,
    buildings: [],
    roofs: [],
    parks: null,
    water: null,
    sidewalks: null,
    roads: null,
    major: null,
  };
}

export function pointToAabb(x: number, z: number, box: TileBounds) {
  const dx = x < box.minX ? box.minX - x : x > box.maxX ? x - box.maxX : 0;
  const dz = z < box.minZ ? box.minZ - z : z > box.maxZ ? z - box.maxZ : 0;
  return Math.hypot(dx, dz);
}

export function boundsFromTile(tile: WorldTileData): TileBounds {
  if (tile.bounds) return tile.bounds;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const touch = (x: number, z: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  };
  for (const building of tile.buildings) {
    for (const p of building.ring) touch(p.x, p.z);
  }
  for (const road of tile.roads) {
    for (const p of road.line) touch(p.x, p.z);
  }
  for (const ring of [...tile.parks, ...tile.water]) {
    for (const p of ring) touch(p.x, p.z);
  }
  if (!Number.isFinite(minX)) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  return { minX, maxX, minZ, maxZ };
}

/** Distance from Biscuit to the tile AABB. 0 when he is standing on that tile. */
export function tileDistanceToPoint(tile: WorldTileData, here: { x: number; z: number }) {
  return pointToAabb(here.x, here.z, boundsFromTile(tile));
}

export function tileIsLod(tile: WorldTileData, here: { x: number; z: number }, far = 88) {
  return tileDistanceToPoint(tile, here) > far;
}

function shapeFrom(ring: { x: number; z: number }[]) {
  const shape = new Shape();
  shape.moveTo(ring[0].x, ring[0].z);
  for (let i = 1; i < ring.length; i += 1) shape.lineTo(ring[i].x, ring[i].z);
  shape.closePath();
  return shape;
}

export function mergeAll(geos: BufferGeometry[]) {
  if (!geos.length) return [] as BufferGeometry[];
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged ? [merged] : [];
}

function paintBuilding(geo: BufferGeometry, tint: readonly number[], height: number) {
  const count = geo.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const heights = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = tint[0];
    colors[i * 3 + 1] = tint[1];
    colors[i * 3 + 2] = tint[2];
    heights[i] = height;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.setAttribute('aHeight', new BufferAttribute(heights, 1));
}

export function pushBuilding(
  building: WorldTileData['buildings'][number],
  walls: BufferGeometry[],
  roofs: BufferGeometry[],
  withRoof: boolean,
) {
  try {
    const height = Math.max(3.2, building.height - building.min);
    const geo = new ExtrudeGeometry(shapeFrom(building.ring), {
      depth: height,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, building.min, 0);
    const mid = centroid(building.ring);
    paintBuilding(geo, facadeTint(mid.x, mid.z), height);
    walls.push(geo);
    if (!withRoof) return;
    const box = ringBounds(building.ring);
    if (box.w > 1.2 && box.d > 1.2) {
      const cap = new BoxGeometry(box.w + 0.2, 0.32, box.d + 0.2);
      cap.translate((box.minX + box.maxX) / 2, building.min + height + 0.1, (box.minZ + box.maxZ) / 2);
      roofs.push(cap);
    }
  } catch {
    // skip a broken ring
  }
}

export function pushRibbonSegs(
  tile: WorldTileData,
  pad: number,
  y: number,
  majorOnly: boolean,
  cursor: RibbonCursor,
  limit: number,
) {
  let made = 0;
  while (cursor.road < tile.roads.length && made < limit) {
    const road = tile.roads[cursor.road];
    if (majorOnly && !isMajorRoad(road.width, road.klass)) {
      cursor.road += 1;
      cursor.seg = 1;
      continue;
    }
    if (cursor.seg < 1) cursor.seg = 1;
    while (cursor.seg < road.line.length && made < limit) {
      const a = road.line[cursor.seg - 1];
      const b = road.line[cursor.seg];
      cursor.seg += 1;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.4) continue;
      const half = road.width * 0.5 + pad;
      const nx = (-dz / len) * half;
      const nz = (dx / len) * half;
      const ring = [
        { x: a.x + nx, z: a.z + nz },
        { x: b.x + nx, z: b.z + nz },
        { x: b.x - nx, z: b.z - nz },
        { x: a.x - nx, z: a.z - nz },
      ];
      try {
        const geo = new ExtrudeGeometry(shapeFrom(ring), { depth: 0.05, bevelEnabled: false, curveSegments: 1 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, y, 0);
        const count = geo.getAttribute('position').count;
        const uv = new Float32Array(count * 2);
        const pos = geo.getAttribute('position');
        for (let v = 0; v < count; v += 1) {
          const px = pos.getX(v);
          const pz = pos.getZ(v);
          const along = ((px - a.x) * dx + (pz - a.z) * dz) / (len * len);
          const across = ((px - a.x) * -dz + (pz - a.z) * dx) / (len * half * 2) + 0.5;
          uv[v * 2] = across;
          uv[v * 2 + 1] = along * len;
        }
        geo.setAttribute('uv', new BufferAttribute(uv, 2));
        cursor.geos.push(geo);
        made += 1;
      } catch {
        // skip
      }
    }
    if (cursor.seg >= road.line.length) {
      cursor.road += 1;
      cursor.seg = 1;
    }
  }
  return cursor.road >= tile.roads.length;
}

export function takeMerged(geos: BufferGeometry[]) {
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged ?? null;
}

export function flattenRings(rings: { x: number; z: number }[][], y = 0.012) {
  const geos: BufferGeometry[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    try {
      const geo = new ExtrudeGeometry(shapeFrom(ring), { depth: 0.04, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, y, 0);
      geos.push(geo);
    } catch {
      // skip
    }
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged;
}

export function createBuildJob(tile: WorldTileData, here: { x: number; z: number }): BuildJob {
  const lod = tileIsLod(tile, here);
  const list = lod
    ? tile.buildings.filter((building) => building.area > 28).slice(0, 80)
    : tile.buildings.slice(0, 160);
  return {
    tile,
    lod,
    walls: [],
    roofs: [],
    index: 0,
    list,
    dress: 'buildings',
    built: emptyTile(tile.key),
    ribbon: null,
  };
}

export type StepResult = { done: boolean; changed: boolean; job: BuildJob | null };

/**
 * Advance one dress slice. Unknown steps drop the job so the queue cannot freeze.
 */
export function stepBuildJob(job: BuildJob): StepResult {
  if (job.dress === 'buildings') {
    const end = Math.min(job.list.length, job.index + 8);
    for (; job.index < end; job.index += 1) {
      pushBuilding(job.list[job.index], job.walls, job.roofs, !job.lod);
    }
    if (job.index < job.list.length) return { done: false, changed: false, job };
    job.dress = 'merge';
    return { done: false, changed: false, job };
  }
  if (job.dress === 'merge') {
    if (job.walls.length) {
      job.built.buildings.push(...mergeAll(job.walls.splice(0, 16)));
      return { done: false, changed: false, job };
    }
    if (job.roofs.length) {
      job.built.roofs.push(...mergeAll(job.roofs.splice(0, 16)));
      return { done: false, changed: false, job };
    }
    job.dress = 'parks';
    return { done: false, changed: true, job };
  }
  if (job.dress === 'parks') {
    const rings = job.lod ? job.tile.parks.slice(0, 6) : job.tile.parks.slice(0, 16);
    const cursor = job.ribbon ?? { road: 0, seg: 1, geos: [] };
    const next = Math.min(rings.length, cursor.road + 3);
    const chunk = flattenRings(rings.slice(cursor.road, next), 0.004);
    if (chunk) cursor.geos.push(chunk);
    cursor.road = next;
    job.ribbon = cursor;
    if (cursor.road < rings.length) return { done: false, changed: false, job };
    job.built.parks = takeMerged(cursor.geos);
    job.dress = 'water';
    job.ribbon = { road: 0, seg: 1, geos: [] };
    return { done: false, changed: false, job };
  }
  if (job.dress === 'water') {
    const rings = job.lod ? job.tile.water.slice(0, 4) : job.tile.water.slice(0, 12);
    const cursor = job.ribbon ?? { road: 0, seg: 1, geos: [] };
    const next = Math.min(rings.length, cursor.road + 3);
    const chunk = flattenRings(rings.slice(cursor.road, next), 0.006);
    if (chunk) cursor.geos.push(chunk);
    cursor.road = next;
    job.ribbon = cursor;
    if (cursor.road < rings.length) return { done: false, changed: false, job };
    job.built.water = takeMerged(cursor.geos);
    job.dress = 'sidewalks';
    job.ribbon = { road: 0, seg: 1, geos: [] };
    return { done: false, changed: true, job };
  }
  if (job.dress === 'sidewalks' || job.dress === 'roads' || job.dress === 'major') {
    const cursor = job.ribbon ?? { road: 0, seg: 1, geos: [] };
    job.ribbon = cursor;
    const pad = job.dress === 'sidewalks' ? 1.15 : 0;
    const y = job.dress === 'sidewalks' ? 0.002 : job.dress === 'major' ? 0.01 : 0.008;
    const done = pushRibbonSegs(job.tile, pad, y, job.dress === 'major', cursor, 8);
    if (!done) return { done: false, changed: false, job };
    const merged = takeMerged(cursor.geos);
    if (job.dress === 'sidewalks') job.built.sidewalks = merged;
    else if (job.dress === 'roads') job.built.roads = merged;
    else job.built.major = merged;
    if (job.dress === 'sidewalks') {
      job.dress = 'roads';
      job.ribbon = { road: 0, seg: 1, geos: [] };
      return { done: false, changed: true, job };
    }
    if (job.dress === 'roads' && !job.lod) {
      job.dress = 'major';
      job.ribbon = { road: 0, seg: 1, geos: [] };
      return { done: false, changed: true, job };
    }
    job.dress = 'done';
    return { done: true, changed: true, job: null };
  }
  job.dress = 'done';
  return { done: true, changed: false, job: null };
}

export function runBuildJob(tile: WorldTileData, here: { x: number; z: number }, maxSteps = 2_000) {
  let job: BuildJob | null = createBuildJob(tile, here);
  const seen: string[] = [];
  let built = job.built;
  for (let i = 0; i < maxSteps && job; i += 1) {
    if (!seen.includes(job.dress)) seen.push(job.dress);
    const result = stepBuildJob(job);
    if (result.job) built = result.job.built;
    job = result.job;
    if (result.done) break;
  }
  return { built, seen, leftover: job };
}

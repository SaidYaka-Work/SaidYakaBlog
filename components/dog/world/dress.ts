/** Stylized city dressing. Pure helpers so tests can pin counts without Three. */

export const FACADE_PALETTE = [
  [0.86, 0.78, 0.68],
  [0.74, 0.56, 0.48],
  [0.62, 0.64, 0.68],
  [0.8, 0.7, 0.58],
  [0.68, 0.5, 0.44],
  [0.76, 0.74, 0.7],
  [0.82, 0.66, 0.52],
  [0.56, 0.6, 0.64],
  [0.7, 0.64, 0.56],
  [0.84, 0.72, 0.68],
] as const;

export type PointXZ = { x: number; z: number };
export type RoadLine = { line: PointXZ[]; width: number; klass?: string };
export type Plant = PointXZ & { s: number; kind: 'tree' | 'bush' };
export type Crossing = { x: number; z: number; dx: number; dz: number; w: number };

export function hash2(x: number, z: number) {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export function facadeTint(x: number, z: number) {
  const i = Math.floor(hash2(x, z) * FACADE_PALETTE.length) % FACADE_PALETTE.length;
  return FACADE_PALETTE[i];
}

export function centroid(ring: PointXZ[]) {
  let x = 0;
  let z = 0;
  for (const p of ring) {
    x += p.x;
    z += p.z;
  }
  return { x: x / ring.length, z: z / ring.length };
}

export function ringBounds(ring: PointXZ[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ, w: maxX - minX, d: maxZ - minZ };
}

export function pointInRing(x: number, z: number, ring: PointXZ[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].x;
    const zi = ring[i].z;
    const xj = ring[j].x;
    const zj = ring[j].z;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function ringArea(ring: PointXZ[]) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += ring[j].x * ring[i].z - ring[i].x * ring[j].z;
  }
  return Math.abs(area) * 0.5;
}

export function lampsAlongRoads(roads: RoadLine[], here: PointXZ, max = 24, spacing = 18) {
  const lamps: PointXZ[] = [];
  for (const road of roads) {
    if (road.width < 4.6) continue;
    let traveled = 0;
    for (let i = 1; i < road.line.length; i += 1) {
      const a = road.line[i - 1];
      const b = road.line[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const nx = -dz / len;
      const nz = dx / len;
      const side = road.width * 0.5 + 0.7;
      let t = (spacing - (traveled % spacing)) % spacing;
      while (t < len && lamps.length < 120) {
        lamps.push({
          x: a.x + (dx / len) * t + nx * side,
          z: a.z + (dz / len) * t + nz * side,
        });
        t += spacing;
      }
      traveled += len;
    }
  }
  const nearest = lamps
    .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))
    .slice(0, max);
  if (nearest.length >= 4) return nearest;
  for (let i = nearest.length; i < Math.min(8, max); i += 1) {
    const ang = (i / 8) * Math.PI * 2;
    nearest.push({ x: here.x + Math.cos(ang) * 12, z: here.z + Math.sin(ang) * 12 });
  }
  return nearest;
}

function sampleInside(ring: PointXZ[], want: number, seed: number) {
  const box = ringBounds(ring);
  const hits: PointXZ[] = [];
  for (let i = 0; i < want * 10 && hits.length < want; i += 1) {
    const x = box.minX + hash2(seed + i, box.minZ) * box.w;
    const z = box.minZ + hash2(box.maxX, seed + i * 3) * box.d;
    if (pointInRing(x, z, ring)) hits.push({ x, z });
  }
  if (!hits.length) hits.push(centroid(ring));
  return hits;
}

export function plantsInParks(parks: PointXZ[][], here: PointXZ, max = 80) {
  const plants: Plant[] = [];
  for (const park of parks) {
    if (park.length < 3) continue;
    const area = ringArea(park);
    if (area < 30) continue;
    const trees = Math.min(36, 6 + Math.floor(area / 90));
    const bushes = Math.min(24, 4 + Math.floor(area / 140));
    const seed = centroid(park);
    sampleInside(park, trees, seed.x).forEach((p, i) => {
      plants.push({ ...p, s: 1.1 + hash2(i, seed.x) * 0.8, kind: 'tree' });
    });
    sampleInside(park, bushes, seed.z + 9).forEach((p, i) => {
      plants.push({ ...p, s: 0.45 + hash2(i + 4, seed.z) * 0.35, kind: 'bush' });
    });
  }
  return plants
    .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))
    .slice(0, max);
}

export function streetTreesAlongRoads(roads: RoadLine[], here: PointXZ, max = 36, spacing = 12) {
  const trees: Plant[] = [];
  for (const road of roads) {
    if (road.width < 4.8) continue;
    let traveled = 0;
    for (let i = 1; i < road.line.length; i += 1) {
      const a = road.line[i - 1];
      const b = road.line[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 2) continue;
      const nx = -dz / len;
      const nz = dx / len;
      const side = road.width * 0.5 + 1.6;
      let t = (spacing * 0.5 - (traveled % spacing) + spacing) % spacing;
      while (t < len && trees.length < 80) {
        trees.push({
          x: a.x + (dx / len) * t + nx * side,
          z: a.z + (dz / len) * t + nz * side,
          s: 0.85 + hash2(t, a.x) * 0.45,
          kind: 'tree',
        });
        t += spacing;
      }
      traveled += len;
    }
  }
  return trees
    .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))
    .slice(0, max);
}

export function dressPlants(parks: PointXZ[][], roads: RoadLine[], here: PointXZ, max = 120) {
  const park = plantsInParks(parks, here, Math.ceil(max * 0.7));
  const street = streetTreesAlongRoads(roads, here, Math.floor(max * 0.35));
  return [...park, ...street]
    .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))
    .slice(0, max);
}

export function isMajorRoad(width: number, klass?: string) {
  if (width >= 6.4) return true;
  return klass === 'primary' || klass === 'secondary' || klass === 'tertiary' || klass === 'trunk' || klass === 'motorway';
}

function segmentHit(a0: PointXZ, a1: PointXZ, b0: PointXZ, b1: PointXZ) {
  const dax = a1.x - a0.x;
  const daz = a1.z - a0.z;
  const dbx = b1.x - b0.x;
  const dbz = b1.z - b0.z;
  const det = dax * dbz - daz * dbx;
  if (Math.abs(det) < 1e-8) return null;
  const t = ((b0.x - a0.x) * dbz - (b0.z - a0.z) * dbx) / det;
  const u = ((b0.x - a0.x) * daz - (b0.z - a0.z) * dax) / det;
  if (t < -0.04 || t > 1.04 || u < -0.04 || u > 1.04) return null;
  const len = Math.hypot(dax, daz) || 1;
  return { x: a0.x + t * dax, z: a0.z + t * daz, dx: dax / len, dz: daz / len };
}

export function crossingsAtIntersections(roads: RoadLine[], here: PointXZ, max = 10) {
  const majors = roads.filter((road) => isMajorRoad(road.width, road.klass));
  const crossings: Crossing[] = [];
  for (let i = 0; i < majors.length; i += 1) {
    for (let j = i + 1; j < majors.length; j += 1) {
      const a = majors[i];
      const b = majors[j];
      for (let ai = 1; ai < a.line.length; ai += 1) {
        for (let bi = 1; bi < b.line.length; bi += 1) {
          const hit = segmentHit(a.line[ai - 1], a.line[ai], b.line[bi - 1], b.line[bi]);
          if (!hit) continue;
          if (crossings.some((mark) => Math.hypot(mark.x - hit.x, mark.z - hit.z) < 8)) continue;
          crossings.push({ ...hit, w: Math.max(7, a.width + 1.2) });
        }
      }
    }
  }
  return crossings
    .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))
    .slice(0, max);
}

/** @deprecated use dressPlants — kept so older tests/imports keep working */
export function treesInParks(parks: PointXZ[][], here: PointXZ, max = 36) {
  return plantsInParks(parks, here, max).filter((plant) => plant.kind === 'tree');
}

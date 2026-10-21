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

export function lampsAlongRoads(roads: RoadLine[], here: PointXZ, max = 16, spacing = 28) {
  const lamps: PointXZ[] = [];
  for (const road of roads) {
    if (road.width < 6.2) continue;
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
      const side = road.width * 0.5 + 0.55;
      let t = (spacing - (traveled % spacing)) % spacing;
      while (t < len && lamps.length < 80) {
        lamps.push({
          x: a.x + (dx / len) * t + nx * side,
          z: a.z + (dz / len) * t + nz * side,
        });
        t += spacing;
      }
      traveled += len;
    }
  }
  return lamps
    .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))
    .slice(0, max);
}

export function treesInParks(parks: PointXZ[][], here: PointXZ, max = 36) {
  const trees: { x: number; z: number; s: number }[] = [];
  for (const park of parks) {
    if (park.length < 3) continue;
    const c = centroid(park);
    let area = 0;
    for (let i = 0, j = park.length - 1; i < park.length; j = i, i += 1) {
      area += park[j].x * park[i].z - park[i].x * park[j].z;
    }
    area = Math.abs(area) * 0.5;
    if (area < 90) continue;
    const n = Math.min(4, 1 + Math.floor(area / 500));
    for (let i = 0; i < n && trees.length < max * 2; i += 1) {
      const ang = hash2(c.x, c.z + i) * Math.PI * 2;
      const r = 1.6 + hash2(c.z, c.x + i) * 7;
      trees.push({
        x: c.x + Math.cos(ang) * r,
        z: c.z + Math.sin(ang) * r,
        s: 0.75 + hash2(i + 2, c.x) * 0.7,
      });
    }
  }
  return trees
    .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))
    .slice(0, max);
}

export function isMajorRoad(width: number, klass?: string) {
  if (width >= 6.4) return true;
  return klass === 'primary' || klass === 'secondary' || klass === 'tertiary' || klass === 'trunk' || klass === 'motorway';
}

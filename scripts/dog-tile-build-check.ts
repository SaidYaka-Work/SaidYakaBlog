import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import {
  DRESS_STEPS,
  createBuildJob,
  pointToAabb,
  runBuildJob,
  stepBuildJob,
  tileDistanceToPoint,
  tileIsLod,
  type BuiltTile,
} from '../components/dog/world/buildTile.ts';
import {
  decodeTile,
  keepNearBuildings,
  keepNearRoads,
  type BuildingFeat,
  type RoadFeat,
  type WorldTileData,
} from '../components/dog/world/decode.ts';
import {
  TILE_TEMPLATE_FALLBACK,
  formatPlaceLine,
  resolveTileTemplate,
} from '../workers/dog/src/world.ts';
import {
  KEEP_RING,
  MAX_CACHED_TILES,
  MAX_LIVE_TILES,
  evictTileCache,
  stableTileCenter,
  tileFraction,
  wantedTileKeys,
} from '../components/dog/world/tileWindow.ts';
import { parseDebugSpawn, SPAWN_PRESETS } from '../components/dog/debugSpawn.ts';

function box(x: number, z: number, w: number, d: number) {
  return [
    { x: x - w, z: z - d },
    { x: x + w, z: z - d },
    { x: x + w, z: z + d },
    { x: x - w, z: z + d },
  ];
}

function fixtureTile(): WorldTileData {
  return {
    key: '14/4825/6156',
    bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
    buildings: [{ ring: box(10, 8, 4, 3), height: 14, min: 0, area: 48 }],
    roads: [{ line: [{ x: -40, z: 0 }, { x: 40, z: 0 }], width: 8, klass: 'primary' }],
    water: [box(-20, 16, 6, 4)],
    parks: [box(0, 40, 8, 8)],
    labels: [{ x: 853, z: 40, name: 'West 4 Street' }],
  };
}

const tile = fixtureTile();
const here = { x: 0, z: 0 };

assert.equal(pointToAabb(0, 0, tile.bounds!), 0, 'point inside the tile AABB is 0');
assert.equal(tileDistanceToPoint(tile, here), 0, "Biscuit's own tile is never distant");
assert.equal(tileIsLod(tile, here), false, 'center tile keeps roofs and road markings');
assert.ok(tileIsLod(tile, { x: 400, z: 0 }), 'far visitor still lods');

const job = createBuildJob(tile, here);
assert.equal(job.lod, false);
assert.equal(job.dress, 'buildings');

const { built, seen, leftover } = runBuildJob(tile, here);
assert.equal(leftover, null, 'builder must finish the fixture tile');
for (const step of DRESS_STEPS) {
  assert.ok(seen.includes(step), `builder never visited ${step} (saw ${seen.join(',')})`);
}
assert.ok(built.buildings.length >= 1, 'fixture walls exist');
assert.ok(built.parks, 'parks mesh');
assert.ok(built.water, 'water mesh — the missing stage');
assert.ok(built.sidewalks, 'sidewalks mesh');
assert.ok(built.roads, 'roads mesh');
assert.equal(built.major, null, 'road markings live on the single road mesh');
assert.equal(built.buildings.length, 1, 'one merged building mesh');
const walkPos = built.sidewalks.getAttribute('position');
let onRoad = 0;
for (let i = 0; i < (walkPos?.count ?? 0); i += 1) {
  if (Math.abs(walkPos!.getZ(i)) < 3.6) onRoad += 1;
}
assert.ok((walkPos?.count ?? 0) > 0 && onRoad / walkPos!.count < 0.2, 'sidewalks stay beside the road');

const stuck = createBuildJob(tile, here);
stuck.dress = 'nope';
const dropped = stepBuildJob(stuck);
assert.equal(dropped.done, true);
assert.equal(dropped.job, null, 'unknown dress must clear pending');

const near: BuildingFeat = { ring: box(4, 2, 2, 2), height: 8, min: 0, area: 12 };
const far: BuildingFeat[] = Array.from({ length: 160 }, (_, i) => ({
  ring: box(400 + i * 8, 400, 20, 20),
  height: 40,
  min: 0,
  area: 800,
}));
const kept = keepNearBuildings([...far, near], { x: 0, z: 0 });
assert.ok(
  kept.some((b) => b.area === 12),
  'a small building next to Biscuit beats 160 giant far footprints',
);
assert.equal(kept.filter((b) => b.area === 12).length, 1);
assert.equal(kept.filter((b) => b.area === 800).length, 40, 'only the far remainder is capped');

const nearRoad: RoadFeat = { line: [{ x: 2, z: 0 }, { x: 8, z: 0 }], width: 6, klass: 'street' };
const farRoads: RoadFeat[] = Array.from({ length: 280 }, (_, i) => ({
  line: [
    { x: 500 + i, z: 500 },
    { x: 520 + i, z: 500 },
  ],
  width: 12,
  klass: 'motorway',
}));
const roads = keepNearRoads([...farRoads, nearRoad], { x: 0, z: 0 });
assert.equal(roads[0], nearRoad, 'nearest road is kept first, not the first 280 far ones');
assert.ok(roads.length <= 280);

assert.equal(
  formatPlaceLine('Patchin Place', 'Washington Square Park, New York'),
  'Patchin Place · near Washington Square Park',
);
assert.equal(
  formatPlaceLine('6½ Avenue', 'Times Square, New York'),
  '6½ Avenue · near Times Square',
);
assert.equal(formatPlaceLine('Broadway', 'Times Square buildings'), 'Broadway');

assert.equal(
  resolveTileTemplate('https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'),
  TILE_TEMPLATE_FALLBACK,
  'unversioned planet wildcard must not be used',
);
assert.equal(
  resolveTileTemplate('https://tiles.openfreemap.org/planet/20261018_080001_pt/{z}/{x}/{y}.pbf'),
  'https://tiles.openfreemap.org/planet/20261018_080001_pt/{z}/{x}/{y}.pbf',
);
assert.equal(resolveTileTemplate(undefined), TILE_TEMPLATE_FALLBACK);

const fixtureBytes = readFileSync('components/dog/world/fixtures/ofm-14-4823-6157.pbf');
const rawTile = new VectorTile(new PbfReader(fixtureBytes));
const layerCounts = Object.fromEntries(
  Object.entries(rawTile.layers).map(([name, layer]) => [name, layer.length]),
) as Record<string, number>;
assert.ok((layerCounts.building ?? 0) > 0, `fixture building layer empty: ${JSON.stringify(layerCounts)}`);
assert.ok((layerCounts.transportation ?? 0) > 0, 'fixture transportation layer empty');
const decodedFixture = decodeTile(
  fixtureBytes.buffer.slice(fixtureBytes.byteOffset, fixtureBytes.byteOffset + fixtureBytes.byteLength),
  14,
  4823,
  6157,
  40.730823,
  -73.997332,
);
assert.ok(decodedFixture.buildings.length > 0, `decode lost buildings (${decodedFixture.buildings.length})`);
assert.ok(decodedFixture.roads.length > 0, `decode lost roads (${decodedFixture.roads.length})`);

function xzBoundsOfGeos(geos: { getAttribute: (name: string) => { count: number; getX: (i: number) => number; getZ: (i: number) => number } | undefined }[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const geo of geos) {
    const pos = geo.getAttribute('position');
    if (!pos) continue;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }
  return { minX, maxX, minZ, maxZ };
}

function xzBoundsOfRings(rings: { x: number; z: number }[][]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
  }
  return { minX, maxX, minZ, maxZ };
}

function xzOverlaps(
  a: { minX: number; maxX: number; minZ: number; maxZ: number },
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function assertMeshMatchesFootprint(built: BuiltTile, tile: WorldTileData, label: string) {
  assert.ok(built.buildings.length > 0, `${label}: no wall meshes`);
  const walls = xzBoundsOfGeos(built.buildings);
  const roofs = built.roofs.length ? xzBoundsOfGeos(built.roofs) : null;
  const footprint = xzBoundsOfRings(tile.buildings.map((building) => building.ring));
  const mirrored = { ...footprint, minZ: -footprint.maxZ, maxZ: -footprint.minZ };
  assert.ok(
    xzOverlaps(walls, footprint),
    `${label}: wall meshes ${JSON.stringify(walls)} miss collision footprints ${JSON.stringify(footprint)}`,
  );
  const footprintCrossesOrigin = footprint.minZ < 0 && footprint.maxZ > 0;
  if (!footprintCrossesOrigin) {
    assert.equal(
      xzOverlaps(walls, mirrored),
      false,
      `${label}: walls sit on the north-south mirror ${JSON.stringify(mirrored)} instead of ${JSON.stringify(footprint)}`,
    );
  }
  if (roofs) {
    assert.ok(xzOverlaps(roofs, footprint), `${label}: roof caps miss collision footprints`);
    assert.ok(xzOverlaps(roofs, walls), `${label}: roof caps must sit on the wall meshes`);
  }
  if (built.parks && tile.parks.length) {
    const parkMesh = xzBoundsOfGeos([built.parks]);
    const parkFoot = xzBoundsOfRings(tile.parks);
    assert.ok(xzOverlaps(parkMesh, parkFoot), `${label}: park mesh misses park rings`);
  }
}

const northOnly: WorldTileData = {
  key: '14/0/0',
  bounds: { minX: -80, maxX: 80, minZ: 20, maxZ: 80 },
  buildings: [{ ring: box(12, 48, 6, 5), height: 16, min: 0, area: 120 }],
  roads: [{ line: [{ x: -20, z: 40 }, { x: 20, z: 40 }], width: 8, klass: 'primary' }],
  water: [],
  parks: [box(12, 48, 10, 8)],
  labels: [],
};
const northBuilt = runBuildJob(northOnly, { x: 12, z: 48 }).built;
assertMeshMatchesFootprint(northBuilt, northOnly, 'synthetic +Z tile');
assert.ok(
  xzBoundsOfGeos(northBuilt.buildings).minZ > 20,
  'walls of a +Z-only footprint must stay in +Z after rotateX',
);

const fixtureBuilt = runBuildJob(decodedFixture, { x: 0, z: 0 }).built;
assertMeshMatchesFootprint(fixtureBuilt, decodedFixture, 'OpenFreeMap fixture 14/4823/6157');

const center = { z: 14, x: 4825, y: 6156 };
const windowKeys = wantedTileKeys(center);
assert.equal(windowKeys.length, MAX_LIVE_TILES);
assert.ok(windowKeys.includes('14/4825/6156'));
const cache = new Map<string, string>([
  ['14/4825/6156', 'center'],
  ['14/4824/6156', 'west'],
  ['14/4826/6155', 'ne'],
  ['14/4800/6100', 'far'],
  ['14/4999/6300', 'farther'],
]);
const evicted = evictTileCache(cache, windowKeys);
assert.ok(evicted.includes('14/4800/6100'));
assert.ok(evicted.includes('14/4999/6300'));
assert.equal(cache.has('14/4800/6100'), false);
assert.equal(cache.has('14/4825/6156'), true);
assert.ok(cache.size <= MAX_LIVE_TILES);

assert.equal(parseDebugSpawn('?debug=1&spawn=timessq-buildings')?.lat, SPAWN_PRESETS['timessq-buildings'].lat);
assert.equal(parseDebugSpawn('?debug=1&spawn=avenue-row')?.lng, SPAWN_PRESETS['avenue-row'].lng);
assert.equal(parseDebugSpawn('spawn=40.758,-73.9855')?.lng, -73.9855);
assert.equal(parseDebugSpawn('?debug=1'), null);

const frac = tileFraction(40.730823, -73.997332, 14);
const held = stableTileCenter(40.730823, -73.997332, { z: 14, x: frac.x, y: frac.y }, 14);
assert.equal(held.x, frac.x);
const neighborLng = -73.997332 + (1 - frac.u + 0.08) * (360 / 2 ** 14);
const flapping = stableTileCenter(40.730823, neighborLng, held, 14);
assert.equal(flapping.x, held.x, 'edge tiles must not flap on a recenter');
const deepLng = -73.997332 + (1 - frac.u + 0.4) * (360 / 2 ** 14);
const recentered = stableTileCenter(40.730823, deepLng, held, 14);
assert.ok(recentered.x !== held.x, 'recenter only after walking well into the neighbor');

const keepKeys = wantedTileKeys(center, KEEP_RING);
assert.equal(keepKeys.length, MAX_CACHED_TILES);
const reuse = new Map<string, string>([
  ['14/4825/6156', 'center'],
  ['14/4823/6156', 'kept-west'],
  ['14/4800/6100', 'far'],
]);
const reusedEvicted = evictTileCache(reuse, keepKeys, undefined, MAX_CACHED_TILES);
assert.ok(reusedEvicted.includes('14/4800/6100'));
assert.equal(reuse.has('14/4823/6156'), true, 'already-built tiles just outside 3×3 are reused');

console.log('dog-tile-build-check ok');

import assert from 'node:assert/strict';
import {
  DRESS_STEPS,
  createBuildJob,
  pointToAabb,
  runBuildJob,
  stepBuildJob,
  tileDistanceToPoint,
  tileIsLod,
} from '../components/dog/world/buildTile.ts';
import {
  keepNearBuildings,
  keepNearRoads,
  type BuildingFeat,
  type RoadFeat,
  type WorldTileData,
} from '../components/dog/world/decode.ts';
import { formatPlaceLine } from '../workers/dog/src/world.ts';
import { MAX_LIVE_TILES, evictTileCache, wantedTileKeys } from '../components/dog/world/tileWindow.ts';
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
assert.equal(parseDebugSpawn('spawn=40.758,-73.9855')?.lng, -73.9855);
assert.equal(parseDebugSpawn('?debug=1'), null);

console.log('dog-tile-build-check ok');

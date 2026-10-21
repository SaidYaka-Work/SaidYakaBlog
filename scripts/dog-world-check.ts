import {
  HOME_PLACE,
  PLACES,
  applyGoHome,
  applyLeaveWorld,
  applyTravel,
  applyWorldDrive,
  haversineMeters,
  lngLatToLocal,
  localToLngLat,
  pointInRing,
  pushCircleOut,
  sunDirection,
  tileXY,
} from '../workers/dog/src/world.ts';
import { RUN_SPEED, createYard, nearGate } from '../workers/dog/src/room.ts';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const T0 = Date.parse('2026-10-21T12:00:00Z');
const origin = HOME_PLACE;

const here = lngLatToLocal(origin.lat, origin.lng, origin.lat, origin.lng);
assert(Math.abs(here.x) < 1e-6 && Math.abs(here.z) < 1e-6, 'origin is local 0,0');
const north = localToLngLat(0, -25, origin.lat, origin.lng);
const east = localToLngLat(25, 0, origin.lat, origin.lng);
assert(north.lat > origin.lat, 'local -Z is north so WASD W walks uptown');
assert(east.lng > origin.lng, 'local +X is east');
const round = lngLatToLocal(north.lat, north.lng, origin.lat, origin.lng);
assert(Math.abs(round.z + 25) < 0.05, 'local/geo round-trips');

const tile = tileXY(origin.lat, origin.lng);
assert(tile.z === 14, 'OpenFreeMap maxzoom is 14');

assert(PLACES.length >= 30, `need a fixed public list, got ${PLACES.length}`);
assert(
  PLACES.every((place) => place.id && Number.isFinite(place.lat) && Number.isFinite(place.lng)),
  'every preset is a public lat/lng',
);
assert(
  !PLACES.some((place) => /said|home address|apartment|residence/i.test(`${place.id} ${place.name}`)),
  'no private addresses in the travel list',
);

const yard = createYard(T0);
assert(!applyTravel(yard, 'said-house', T0).ok, 'unknown places are rejected');
const trip = applyTravel(yard, 'shibuya', T0);
assert(trip.ok, 'Shibuya is on the list');
if (trip.ok) {
  assert(trip.yard.location?.mode === 'world', 'travel enters the world');
  assert(trip.yard.location?.placeId === 'shibuya', 'travel stores the place id');
  assert(!applyTravel(trip.yard, 'tuileries', T0 + 1000).ok, 'travel cooldown blocks a second hop');
}

const left = applyLeaveWorld(createYard(T0), T0);
assert(left.location?.mode === 'world', 'leave walks out the gate');
assert(left.location?.placeId === HOME_PLACE.id, 'the gate opens onto the public home park');
const stepped = applyWorldDrive(left, 0, -1, true, 0.1, T0 + 80);
const moved = haversineMeters(left.location!.lat, left.location!.lng, stepped.location!.lat, stepped.location!.lng);
assert(moved <= RUN_SPEED * 0.1 + 1.6, `world step ${moved} exceeded the cap`);
const tele = applyWorldDrive(stepped, 0, -1, true, 0.1, T0 + 160, { x: 400, z: 400 });
const jump = Math.hypot(tele.pose.x - stepped.pose.x, tele.pose.z - stepped.pose.z);
assert(jump < 3, `proposed teleport slipped through (${jump})`);

const home = applyGoHome(left, T0 + 10);
assert(home.location?.mode === 'home', 'Home returns to the porch');
assert(nearGate(0, -3.05), 'the far fence is the gate');

const square = [
  { x: -1, z: -1 },
  { x: 1, z: -1 },
  { x: 1, z: 1 },
  { x: -1, z: 1 },
];
assert(pointInRing(0, 0, square), 'centroid starts inside');
const out = pushCircleOut(0, 0, 0.3, [square]);
assert(!pointInRing(out.x, out.z, square), 'buildings push the dog out');

const noon = sunDirection(origin.lat, origin.lng, Date.parse('2026-06-21T16:00:00Z'));
const midnight = sunDirection(origin.lat, origin.lng, Date.parse('2026-06-21T04:00:00Z'));
assert(!noon.night && midnight.night, 'sunDirection is lat/lng/UTC so Phase 3 can replace the model');

console.log('dog-world-check ok');

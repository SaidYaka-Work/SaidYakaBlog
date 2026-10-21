/**
 * Shared open-world location, presets, and geo.
 *
 * Later PRs plug in without rewriting pose or breaking old clients:
 * - Phase 2 Presence: companions[] + leash.queue / nextId (preset emotes, fair handoff)
 * - Phase 3 Living world: Worker-cached weather + sunDirection() already keyed by lat/lng/UTC
 * - Phase 4 Passport: stamps/collectibles on the living dog and Memorial (Hall of Dogs)
 * - Phase 5 Events: goals/postcards keyed by placeId + lat/lng
 */

import {
  ACCEL,
  DECEL,
  DOG_RADIUS,
  MOVE_DT_MAX,
  RUN_SPEED,
  TURN_ALIGN,
  WALK_CAP_HOUR_M,
  WALK_CAP_SESSION_M,
  WALK_SPEED,
  YAW_TURN,
  clamp,
  gaitFromSpeed,
  headingYaw,
  normalizeInput,
  placeFeeder,
  wrapAngle,
  type Gait,
  type Pose,
  type YardState,
} from './room';

export const WORLD_TILE_ZOOM = 14;
export const TRAVEL_COOLDOWN_MS = 25_000;
export const WORLD_WANDER_M = 80;
export const METERS_PER_DEG = 111_320;
export const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
export const ATTRIBUTION = '© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap';

export type Place = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
};

/** Public parks and plazas only. No private or personal addresses. */
export const PLACES: Place[] = [
  { id: 'wsp', name: 'Washington Square Park', city: 'New York', country: 'USA', lat: 40.730823, lng: -73.997332 },
  { id: 'central-park', name: 'Central Park Mall', city: 'New York', country: 'USA', lat: 40.7723, lng: -73.9716 },
  { id: 'times-square', name: 'Times Square', city: 'New York', country: 'USA', lat: 40.758, lng: -73.9855 },
  { id: 'brooklyn-bridge-park', name: 'Brooklyn Bridge Park', city: 'New York', country: 'USA', lat: 40.7023, lng: -73.9964 },
  { id: 'boston-common', name: 'Boston Common', city: 'Boston', country: 'USA', lat: 42.3551, lng: -71.0656 },
  { id: 'national-mall', name: 'National Mall', city: 'Washington', country: 'USA', lat: 38.8895, lng: -77.0353 },
  { id: 'millennium-park', name: 'Millennium Park', city: 'Chicago', country: 'USA', lat: 41.8826, lng: -87.6226 },
  { id: 'golden-gate-park', name: 'Golden Gate Park', city: 'San Francisco', country: 'USA', lat: 37.7694, lng: -122.4862 },
  { id: 'crissy-field', name: 'Crissy Field', city: 'San Francisco', country: 'USA', lat: 37.8039, lng: -122.4662 },
  { id: 'pike-place', name: 'Pike Place Market', city: 'Seattle', country: 'USA', lat: 47.6097, lng: -122.3422 },
  { id: 'stanley-park', name: 'Stanley Park', city: 'Vancouver', country: 'Canada', lat: 49.3017, lng: -123.1417 },
  { id: 'hyde-park', name: 'Hyde Park', city: 'London', country: 'UK', lat: 51.5073, lng: -0.1657 },
  { id: 'trafalgar', name: 'Trafalgar Square', city: 'London', country: 'UK', lat: 51.5081, lng: -0.128 },
  { id: 'tuileries', name: 'Jardin des Tuileries', city: 'Paris', country: 'France', lat: 48.8634, lng: 2.3275 },
  { id: 'sagrada', name: 'Sagrada Família', city: 'Barcelona', country: 'Spain', lat: 41.4036, lng: 2.1744 },
  { id: 'retiro', name: 'Parque del Retiro', city: 'Madrid', country: 'Spain', lat: 40.4153, lng: -3.6844 },
  { id: 'dam-square', name: 'Dam Square', city: 'Amsterdam', country: 'Netherlands', lat: 52.3731, lng: 4.8926 },
  { id: 'brandenburg', name: 'Brandenburg Gate', city: 'Berlin', country: 'Germany', lat: 52.5163, lng: 13.3777 },
  { id: 'spanish-steps', name: 'Spanish Steps', city: 'Rome', country: 'Italy', lat: 41.906, lng: 12.4828 },
  { id: 'st-marks', name: 'Piazza San Marco', city: 'Venice', country: 'Italy', lat: 45.434, lng: 12.3388 },
  { id: 'charles-bridge', name: 'Charles Bridge', city: 'Prague', country: 'Czechia', lat: 50.0865, lng: 14.4114 },
  { id: 'shibuya', name: 'Shibuya Crossing', city: 'Tokyo', country: 'Japan', lat: 35.6595, lng: 139.7004 },
  { id: 'ueno', name: 'Ueno Park', city: 'Tokyo', country: 'Japan', lat: 35.7148, lng: 139.773 },
  { id: 'merlion', name: 'Merlion Park', city: 'Singapore', country: 'Singapore', lat: 1.2868, lng: 103.8545 },
  { id: 'marina-bay', name: 'Marina Bay', city: 'Singapore', country: 'Singapore', lat: 1.2834, lng: 103.8607 },
  { id: 'opera-sydney', name: 'Sydney Opera House', city: 'Sydney', country: 'Australia', lat: -33.8568, lng: 151.2153 },
  { id: 'copacabana', name: 'Copacabana', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.9711, lng: -43.1822 },
  { id: 'zocalo', name: 'Zócalo', city: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332 },
  { id: 'temple-bar', name: 'Temple Bar', city: 'Dublin', country: 'Ireland', lat: 53.3454, lng: -6.2641 },
  { id: 'gamla-stan', name: 'Gamla Stan', city: 'Stockholm', country: 'Sweden', lat: 59.325, lng: 18.0708 },
];

export const HOME_PLACE_ID = 'wsp';
export const HOME_PLACE = PLACES[0];

export type LocationMode = 'world';

/** Shared "where is Biscuit". Additive: weather, stamps, events can join later without breaking pose. */
export type Location = {
  mode: LocationMode;
  lat: number;
  lng: number;
  heading: number;
  originLat: number;
  originLng: number;
  placeId: string;
  lastTravelAt: number;
  lastWorldInputAt: number;
};

export type PublicLocation = {
  mode: LocationMode;
  lat: number;
  lng: number;
  heading: number;
  originLat: number;
  originLng: number;
  placeId: string;
  placeName: string;
  city: string;
  country: string;
};

export type Ring = { x: number; z: number }[];

export function placeById(id: string): Place | undefined {
  return PLACES.find((place) => place.id === id);
}

export function createLocation(now: number, place: Place = HOME_PLACE, _mode: LocationMode | 'home' | 'yard' = 'world'): Location {
  return {
    mode: 'world',
    lat: place.lat,
    lng: place.lng,
    heading: 0,
    originLat: place.lat,
    originLng: place.lng,
    placeId: place.id,
    lastTravelAt: 0,
    lastWorldInputAt: now,
  };
}

export function isLegacyIndoorMode(mode: unknown) {
  return mode === 'home' || mode === 'yard';
}

export function migrateLocation(value: Location | undefined, now: number): Location {
  if (!value || !Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return createLocation(now);
  const place = placeById(value.placeId) ?? HOME_PLACE;
  return {
    ...createLocation(now, place),
    ...value,
    mode: 'world',
    placeId: place.id,
    heading: Number.isFinite(value.heading) ? value.heading : 0,
    originLat: Number.isFinite(value.originLat) ? value.originLat : place.lat,
    originLng: Number.isFinite(value.originLng) ? value.originLng : place.lng,
  };
}

/** Align a yard that still thinks it is indoors onto its last geo (or WSP). */
export function settleWorldYard(yard: YardState, now: number): YardState {
  const priorMode = yard.location?.mode;
  const location = migrateLocation(yard.location, now);
  const parked = lngLatToLocal(location.lat, location.lng, location.originLat, location.originLng);
  const pose = isLegacyIndoorMode(priorMode)
    ? { ...yard.pose, x: parked.x, z: parked.z, yaw: location.heading, vx: 0, vz: 0 }
    : yard.pose;
  const bowl =
    Number.isFinite(yard.feeder.x) && Number.isFinite(yard.feeder.z) ? yard.feeder : { ...yard.feeder, ...placeFeeder(pose) };
  return { ...yard, pose, location, feeder: bowl };
}

export function publicLocation(location: Location): PublicLocation {
  const place = placeById(location.placeId) ?? HOME_PLACE;
  return {
    mode: location.mode,
    lat: Math.round(location.lat * 1e6) / 1e6,
    lng: Math.round(location.lng * 1e6) / 1e6,
    heading: Math.round(location.heading * 1000) / 1000,
    originLat: Math.round(location.originLat * 1e6) / 1e6,
    originLng: Math.round(location.originLng * 1e6) / 1e6,
    placeId: place.id,
    placeName: place.name,
    city: place.city,
    country: place.country,
  };
}

export function metersPerDegreeLng(lat: number) {
  return METERS_PER_DEG * Math.cos((lat * Math.PI) / 180);
}

/** Local +X east, +Z south so WASD W (az=-1) walks north, matching the yard camera. */
export function lngLatToLocal(lat: number, lng: number, originLat: number, originLng: number) {
  return {
    x: (lng - originLng) * metersPerDegreeLng(originLat),
    z: (originLat - lat) * METERS_PER_DEG,
  };
}

export function localToLngLat(x: number, z: number, originLat: number, originLng: number) {
  return {
    lat: originLat - z / METERS_PER_DEG,
    lng: originLng + x / metersPerDegreeLng(originLat),
  };
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function tileXY(lat: number, lng: number, zoom = WORLD_TILE_ZOOM) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { z: zoom, x, y };
}

export function syncLocationFromPose(location: Location, pose: Pose): Location {
  const geo = localToLngLat(pose.x, pose.z, location.originLat, location.originLng);
  return { ...location, lat: geo.lat, lng: geo.lng, heading: pose.yaw };
}

export function integrateOpen(
  pose: Pose,
  ax: number,
  az: number,
  run: boolean,
  dt: number,
  collide: (x: number, z: number, nx: number, nz: number) => { x: number; z: number } = (_x, _z, nx, nz) => ({ x: nx, z: nz }),
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
  const next = collide(pose.x, pose.z, pose.x + vx * dt, pose.z + vz * dt);
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

export function pointInRing(x: number, z: number, ring: Ring) {
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

function closestOnSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = dx * dx + dz * dz;
  const t = len < 1e-8 ? 0 : clamp(((x - ax) * dx + (z - az) * dz) / len, 0, 1);
  return { x: ax + dx * t, z: az + dz * t };
}

function ringCentroid(ring: Ring) {
  let x = 0;
  let z = 0;
  for (const p of ring) {
    x += p.x;
    z += p.z;
  }
  return { x: x / ring.length, z: z / ring.length };
}

export function pushCircleOut(x: number, z: number, radius: number, rings: Ring[]) {
  let px = x;
  let pz = z;
  for (const ring of rings) {
    if (ring.length < 3 || !pointInRing(px, pz, ring)) continue;
    const mid = ringCentroid(ring);
    let best = Infinity;
    let outX = px;
    let outZ = pz;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[j];
      const b = ring[i];
      const hit = closestOnSegment(px, pz, a.x, a.z, b.x, b.z);
      const d = Math.hypot(px - hit.x, pz - hit.z);
      if (d >= best) continue;
      best = d;
      let nx = b.z - a.z;
      let nz = a.x - b.x;
      const nlen = Math.hypot(nx, nz) || 1;
      nx /= nlen;
      nz /= nlen;
      if (nx * (mid.x - hit.x) + nz * (mid.z - hit.z) > 0) {
        nx = -nx;
        nz = -nz;
      }
      outX = hit.x + nx * (radius + 0.05);
      outZ = hit.z + nz * (radius + 0.05);
    }
    px = outX;
    pz = outZ;
  }
  return { x: px, z: pz };
}

export function nearestOnLines(x: number, z: number, lines: Ring[]) {
  let best = Infinity;
  let px = x;
  let pz = z;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const hit = closestOnSegment(x, z, line[i - 1].x, line[i - 1].z, line[i].x, line[i].z);
      const d = Math.hypot(x - hit.x, z - hit.z);
      if (d < best) {
        best = d;
        px = hit.x;
        pz = hit.z;
      }
    }
  }
  return { x: px, z: pz, dist: best };
}

function creditWalk(yard: YardState, meters: number, moving: boolean, now: number): YardState {
  let sessionMeters = yard.leash.sessionMeters;
  let hourMeters = yard.leash.hourMeters;
  let hourStartedAt = yard.leash.hourStartedAt;
  if (now - hourStartedAt >= 3_600_000) {
    hourMeters = 0;
    hourStartedAt = now;
  }
  if (yard.leash.holderId && moving) {
    const added = Math.min(meters, Math.max(0, WALK_CAP_SESSION_M - sessionMeters), Math.max(0, WALK_CAP_HOUR_M - hourMeters));
    sessionMeters += added;
    hourMeters += added;
  }
  return {
    ...yard,
    leash: {
      ...yard.leash,
      lastInputAt: moving ? now : yard.leash.lastInputAt,
      sessionMeters,
      hourMeters,
      hourStartedAt,
    },
  };
}

export function applyWorldDrive(
  yard: YardState,
  ax: number,
  az: number,
  run: boolean,
  dt: number,
  now: number,
  proposed?: { x: number; z: number } | null,
  buildings: Ring[] = [],
): YardState {
  const location = migrateLocation(yard.location, now);
  const stepped = integrateOpen(yard.pose, ax, az, run, clamp(dt, 0, MOVE_DT_MAX), (_x, _z, nx, nz) =>
    pushCircleOut(nx, nz, DOG_RADIUS, buildings),
  );
  let pose = stepped.pose;
  if (proposed && Number.isFinite(proposed.x) && Number.isFinite(proposed.z)) {
    const jump = Math.hypot(proposed.x - yard.pose.x, proposed.z - yard.pose.z);
    const cap = RUN_SPEED * Math.max(dt, MOVE_DT_MAX) + 0.85;
    if (jump <= cap) {
      const safe = pushCircleOut(proposed.x, proposed.z, DOG_RADIUS, buildings);
      pose = { ...pose, x: safe.x, z: safe.z };
    }
  }
  const next = creditWalk({ ...yard, pose, location }, stepped.meters, Math.hypot(ax, az) > 0.08, now);
  return {
    ...next,
    location: syncLocationFromPose({ ...location, lastWorldInputAt: now }, next.pose),
  };
}

/** Old clients still send leave/home. Stay parked in the world. */
export function applyLeaveWorld(yard: YardState, now: number): YardState {
  return settleWorldYard(yard, now);
}

export function applyGoHome(yard: YardState, now: number): YardState {
  return settleWorldYard(yard, now);
}

export function applyTravel(yard: YardState, placeId: string, now: number): { ok: true; yard: YardState } | { ok: false; code: 'invalid' | 'too_soon' } {
  const place = placeById(placeId);
  if (!place) return { ok: false, code: 'invalid' };
  const location = migrateLocation(yard.location, now);
  if (location.lastTravelAt && now - location.lastTravelAt < TRAVEL_COOLDOWN_MS) return { ok: false, code: 'too_soon' };
  const next: Location = {
    ...createLocation(now, place, 'world'),
    lastTravelAt: now,
    lastWorldInputAt: now,
  };
  const pose: Pose = { x: 0, z: 0, yaw: Math.PI, vx: 0, vz: 0, gait: 'idle' };
  return {
    ok: true,
    yard: {
      ...yard,
      pose,
      location: next,
      feeder: { ...yard.feeder, ...placeFeeder(pose) },
      ai: { mode: 'idle', until: now + 3_600, tx: 0, tz: 0 },
    },
  };
}

export function applyHomeOrWorldDrive(
  yard: YardState,
  ax: number,
  az: number,
  run: boolean,
  dt: number,
  now: number,
  proposed?: { x: number; z: number } | null,
): YardState {
  const settled = settleWorldYard(yard, now);
  return applyWorldDrive(settled, ax, az, run, dt, now, proposed);
}

export function tickWorldAi(
  yard: YardState,
  now: number,
  _dt: number,
  _opts: { hungry?: boolean; buildings?: Ring[]; roads?: Ring[]; parks?: Ring[] } = {},
): YardState {
  const settled = settleWorldYard(yard, now);
  if (settled.leash.holderId) return settled;
  let { until, mode } = settled.ai;
  let gait: Gait = settled.pose.gait === 'run' || settled.pose.gait === 'walk' ? 'idle' : settled.pose.gait;
  if (now >= until) {
    const cycle = ['idle', 'sniff', 'sit', 'idle'] as const;
    const pick = cycle[Math.floor(now / 3_200) % cycle.length];
    mode = pick;
    gait = pick;
    until = now + 2_800 + (now % 900);
  }
  const pose = { ...settled.pose, vx: 0, vz: 0, gait };
  return {
    ...settled,
    pose,
    location: syncLocationFromPose(settled.location!, pose),
    ai: { mode, until, tx: pose.x, tz: pose.z },
  };
}

/** Cheap local solar vector so Phase 3 can swap in a fuller model without changing the scene. */
export function sunDirection(lat: number, lng: number, now: number) {
  const utc = new Date(now);
  const hours = utc.getUTCHours() + utc.getUTCMinutes() / 60 + lng / 15;
  const local = ((hours % 24) + 24) % 24;
  const t = ((local - 6) / 12) * Math.PI;
  const elev = Math.sin(t) * (0.72 + 0.18 * Math.cos((lat * Math.PI) / 180));
  const az = (local / 24) * Math.PI * 2;
  return {
    night: elev < 0.08,
    x: Math.sin(az) * 8,
    y: Math.max(0.35, elev * 10),
    z: Math.cos(az) * 8,
  };
}

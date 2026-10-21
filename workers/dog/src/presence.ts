/** Phase 2 Presence: anonymous companions, preset emotes, position clamps. */

export const EMOTES = ['wave', 'heart', 'sit', 'treat', 'clap'] as const;
export type EmoteKind = (typeof EMOTES)[number];

export const EMOTE_GAP_MS = 2_000;
export const EMOTE_WINDOW_MS = 60_000;
export const EMOTE_MAX_PER_WINDOW = 8;
export const EMOTE_HOLD_MS = 2_800;
export const HERE_GAP_MS = 120;
export const COMPANION_RADIUS = 4.8;
export const COMPANION_STALE_MS = 14_000;
export const MAX_COMPANIONS = 12;
export const MAX_QUEUE = 16;

export type Companion = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  emote: EmoteKind | null;
  emoteUntil: number;
  lastHereAt: number;
};

export type PublicCompanion = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  emote: EmoteKind | null;
};

export type EmoteBucket = {
  count: number;
  windowStart: number;
  lastAt: number;
};

export function isEmote(value: unknown): value is EmoteKind {
  return typeof value === 'string' && (EMOTES as readonly string[]).includes(value);
}

export function hash01(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i += 1) n = (n * 33 + id.charCodeAt(i)) >>> 0;
  return (n % 10_000) / 10_000;
}

export function clampNearDog(x: number, z: number, dog: { x: number; z: number }, radius = COMPANION_RADIUS) {
  const dx = x - dog.x;
  const dz = z - dog.z;
  const dist = Math.hypot(dx, dz);
  if (!Number.isFinite(dist) || dist <= radius || dist < 1e-6) {
    return {
      x: Number.isFinite(x) ? x : dog.x + 1.2,
      z: Number.isFinite(z) ? z : dog.z + 0.6,
    };
  }
  return { x: dog.x + (dx / dist) * radius, z: dog.z + (dz / dist) * radius };
}

export function seatAround(id: string, dog: { x: number; z: number }, index = 0) {
  const turn = hash01(id) * Math.PI * 2 + index * 2.1;
  const radius = 1.35 + hash01(id + ':r') * 1.1;
  const x = dog.x + Math.sin(turn) * radius;
  const z = dog.z + Math.cos(turn) * radius;
  return { x, z, yaw: Math.atan2(dog.x - x, dog.z - z) };
}

export function seatCompanion(
  map: Record<string, Companion>,
  clientId: string,
  dog: { x: number; z: number },
  now: number,
): Record<string, Companion> {
  if (map[clientId]) return map;
  const seated = seatAround(clientId, dog, Object.keys(map).length);
  return {
    ...map,
    [clientId]: {
      id: clientId,
      x: seated.x,
      z: seated.z,
      yaw: seated.yaw,
      emote: null,
      emoteUntil: 0,
      lastHereAt: now,
    },
  };
}

export function applyHere(
  map: Record<string, Companion>,
  clientId: string,
  x: number,
  z: number,
  dog: { x: number; z: number },
  now: number,
): Record<string, Companion> {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return map;
  const current = map[clientId] ?? {
    id: clientId,
    ...seatAround(clientId, dog, Object.keys(map).length),
    emote: null as EmoteKind | null,
    emoteUntil: 0,
    lastHereAt: 0,
  };
  const next = clampNearDog(x, z, dog);
  const dx = next.x - current.x;
  const dz = next.z - current.z;
  const yaw = Math.hypot(dx, dz) > 0.04 ? Math.atan2(dx, dz) : current.yaw;
  const updated: Companion = {
    ...current,
    x: Math.round(next.x * 1000) / 1000,
    z: Math.round(next.z * 1000) / 1000,
    yaw: Math.round(yaw * 1000) / 1000,
    lastHereAt: now,
    emote: current.emoteUntil > now ? current.emote : null,
    emoteUntil: current.emoteUntil,
  };
  return capCompanions({ ...map, [clientId]: updated });
}

export function applyEmote(
  map: Record<string, Companion>,
  clientId: string,
  kind: EmoteKind,
  dog: { x: number; z: number },
  now: number,
): Record<string, Companion> {
  const seated = seatCompanion(map, clientId, dog, now);
  const current = seated[clientId];
  return {
    ...seated,
    [clientId]: {
      ...current,
      emote: kind,
      emoteUntil: now + EMOTE_HOLD_MS,
      lastHereAt: now,
    },
  };
}

export function dropCompanion(map: Record<string, Companion>, clientId: string) {
  if (!map[clientId]) return map;
  const next = { ...map };
  delete next[clientId];
  return next;
}

export function pruneCompanions(
  map: Record<string, Companion> | undefined,
  now: number,
  liveIds?: Iterable<string>,
): Record<string, Companion> {
  const live = liveIds ? new Set(liveIds) : null;
  const next: Record<string, Companion> = {};
  for (const [id, companion] of Object.entries(map ?? {})) {
    if (live && !live.has(id)) continue;
    if (now - companion.lastHereAt > COMPANION_STALE_MS) continue;
    next[id] = companion.emoteUntil > now ? companion : { ...companion, emote: null };
  }
  return capCompanions(next);
}

function capCompanions(map: Record<string, Companion>) {
  const entries = Object.values(map).sort((a, b) => b.lastHereAt - a.lastHereAt);
  if (entries.length <= MAX_COMPANIONS) return map;
  const next: Record<string, Companion> = {};
  for (const companion of entries.slice(0, MAX_COMPANIONS)) next[companion.id] = companion;
  return next;
}

export function publicCompanions(
  map: Record<string, Companion> | undefined,
  dog: { x: number; z: number },
  now: number,
  selfId?: string | null,
): PublicCompanion[] {
  return Object.values(pruneCompanions(map, now))
    .filter((companion) => companion.id !== selfId)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((companion) => {
      const at = clampNearDog(companion.x, companion.z, dog);
      return {
        id: companion.id,
        x: Math.round(at.x * 1000) / 1000,
        z: Math.round(at.z * 1000) / 1000,
        yaw: Math.round(companion.yaw * 1000) / 1000,
        emote: companion.emoteUntil > now ? companion.emote : null,
      };
    });
}

export function takeEmoteRate(
  bucket: EmoteBucket | undefined,
  now: number,
): { ok: true; bucket: EmoteBucket } | { ok: false; bucket: EmoteBucket; retryAfterMs: number } {
  const current: EmoteBucket = bucket ?? { count: 0, windowStart: now, lastAt: 0 };
  const gap = current.lastAt + EMOTE_GAP_MS - now;
  if (gap > 0) {
    return { ok: false, bucket: current, retryAfterMs: gap };
  }
  const windowStart = now - current.windowStart > EMOTE_WINDOW_MS ? now : current.windowStart;
  const count = windowStart === current.windowStart ? current.count + 1 : 1;
  if (count > EMOTE_MAX_PER_WINDOW) {
    return {
      ok: false,
      bucket: { ...current, windowStart },
      retryAfterMs: Math.max(0, EMOTE_WINDOW_MS - (now - windowStart)),
    };
  }
  return { ok: true, bucket: { count, windowStart, lastAt: now } };
}

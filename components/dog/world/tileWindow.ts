/** Bounded OSM tile window. Display about 3×3; keep a wider reuse ring. */

export const TILE_RING = 1;
export const KEEP_RING = 2;
export const MAX_LIVE_TILES = (TILE_RING * 2 + 1) ** 2;
export const MAX_CACHED_TILES = (KEEP_RING * 2 + 1) ** 2;
export const TILE_HYSTERESIS = 0.28;

export type TileCoord = { z: number; x: number; y: number };

export function tileKey(z: number, x: number, y: number) {
  return `${z}/${x}/${y}`;
}

export function tileFraction(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const fx = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  return { z: zoom, x, y, u: fx - x, v: fy - y };
}

/** Stay on the previous center until the dog is well inside a neighbor tile. */
export function stableTileCenter(
  lat: number,
  lng: number,
  prev: TileCoord | null | undefined,
  zoom: number,
  hysteresis = TILE_HYSTERESIS,
): TileCoord {
  const next = tileFraction(lat, lng, zoom);
  const snapped = { z: next.z, x: next.x, y: next.y };
  if (!prev || prev.z !== next.z) return snapped;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  if (dx === 0 && dy === 0) return prev;
  if (Math.abs(dx) + Math.abs(dy) > 2) return snapped;
  if (dx > 0 && next.u < hysteresis) return prev;
  if (dx < 0 && next.u > 1 - hysteresis) return prev;
  if (dy > 0 && next.v < hysteresis) return prev;
  if (dy < 0 && next.v > 1 - hysteresis) return prev;
  return snapped;
}

export function wantedTiles(center: TileCoord, ring = TILE_RING): TileCoord[] {
  const next: TileCoord[] = [];
  for (let dy = -ring; dy <= ring; dy += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      next.push({ z: center.z, x: center.x + dx, y: center.y + dy });
    }
  }
  next.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
  return next;
}

export function wantedTileKeys(center: TileCoord, ring = TILE_RING) {
  return wantedTiles(center, ring).map((tile) => tileKey(tile.z, tile.x, tile.y));
}

/** Drop cache entries outside the keep set, then cap at max. Returns evicted keys. */
export function evictTileCache<T>(
  cache: Map<string, T>,
  wanted: Iterable<string>,
  onEvict?: (key: string, value: T) => void,
  max = MAX_CACHED_TILES,
) {
  const keep = new Set(wanted);
  const evicted: string[] = [];
  for (const [key, value] of Array.from(cache.entries())) {
    if (keep.has(key)) continue;
    onEvict?.(key, value);
    cache.delete(key);
    evicted.push(key);
  }
  if (cache.size > max) {
    const extra = Array.from(cache.keys()).filter((key) => !keep.has(key));
    for (const key of extra) {
      const value = cache.get(key);
      if (value !== undefined) onEvict?.(key, value);
      cache.delete(key);
      evicted.push(key);
    }
  }
  if (cache.size > max) {
    const overflow = Array.from(cache.keys()).slice(max);
    for (const key of overflow) {
      const value = cache.get(key);
      if (value !== undefined) onEvict?.(key, value);
      cache.delete(key);
      evicted.push(key);
    }
  }
  return evicted;
}

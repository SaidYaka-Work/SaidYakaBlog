/** Bounded OSM tile window. Keep about 3×3 live tiles; evict the rest. */

export const TILE_RING = 1;
export const MAX_LIVE_TILES = (TILE_RING * 2 + 1) ** 2;

export type TileCoord = { z: number; x: number; y: number };

export function tileKey(z: number, x: number, y: number) {
  return `${z}/${x}/${y}`;
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

/** Drop every cache entry outside the live window. Returns evicted keys. */
export function evictTileCache<T>(
  cache: Map<string, T>,
  wanted: Iterable<string>,
  onEvict?: (key: string, value: T) => void,
  max = MAX_LIVE_TILES,
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

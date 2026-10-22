'use client';

import { useEffect, useRef, useState } from 'react';
import {
  TILEJSON_PINNED_URL,
  TILEJSON_URL,
  TILE_TEMPLATE_FALLBACK,
  WORLD_TILE_ZOOM,
  buildFootprintGrid,
  emptyFootprintGrid,
  lngLatToLocal,
  resolveTileTemplate,
  type FootprintGrid,
  type Ring,
} from '../../../workers/dog/src/world';
import { decodeTile, type WorldTileData } from './decode';
import type { PackedTile } from './packTile';
import { KEEP_RING, MAX_CACHED_TILES, TILE_RING, evictTileCache, stableTileCenter, wantedTiles, type TileCoord } from './tileWindow';
import { liveBuildingGrid } from './frameMark';

export type WorldColliders = {
  buildings: Ring[];
  roads: Ring[];
  parks: Ring[];
  buildingGrid: FootprintGrid;
  roadGrid: FootprintGrid;
  label: string;
};

export type TileStatus = 'loading' | 'ready' | 'failed';

const MAX_INFLIGHT = 2;
const DECODE_MS = 8_000;
const FETCH_TRIES = 3;

let templatePromise: Promise<string> | null = null;

type TileWorkerHost = {
  __DOG_TILE_WORKER__?: Worker | null;
  __DOG_TILE_WORKER_USERS__?: number;
  __DOG_TILE_WORKER_BROKEN__?: boolean;
};

function workerHost() {
  return globalThis as typeof globalThis & TileWorkerHost;
}

function tileTemplate() {
  if (!templatePromise) {
    templatePromise = (async () => {
      for (const url of [TILEJSON_PINNED_URL, TILEJSON_URL]) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const json = (await res.json()) as { tiles?: string[] };
          return resolveTileTemplate(json.tiles?.[0]);
        } catch {
          // try the next tilejson, then the pinned template
        }
      }
      return TILE_TEMPLATE_FALLBACK;
    })().catch((error) => {
      templatePromise = null;
      throw error;
    });
  }
  return templatePromise;
}

function acquireWorker() {
  const host = workerHost();
  if (host.__DOG_TILE_WORKER_BROKEN__) return null;
  if (!host.__DOG_TILE_WORKER__) {
    try {
      const worker = new Worker(new URL('./tile.worker.ts', import.meta.url));
      worker.addEventListener('error', () => {
        console.warn('[dog] tile worker failed; decoding on the main thread');
        host.__DOG_TILE_WORKER_BROKEN__ = true;
        try {
          worker.terminate();
        } catch {
          // ignore
        }
        if (host.__DOG_TILE_WORKER__ === worker) host.__DOG_TILE_WORKER__ = null;
      });
      host.__DOG_TILE_WORKER__ = worker;
    } catch (error) {
      console.warn('[dog] tile worker unavailable', error);
      host.__DOG_TILE_WORKER_BROKEN__ = true;
      host.__DOG_TILE_WORKER__ = null;
    }
  }
  host.__DOG_TILE_WORKER_USERS__ = (host.__DOG_TILE_WORKER_USERS__ ?? 0) + 1;
  return host.__DOG_TILE_WORKER__ ?? null;
}

function releaseWorker() {
  const host = workerHost();
  host.__DOG_TILE_WORKER_USERS__ = Math.max(0, (host.__DOG_TILE_WORKER_USERS__ ?? 1) - 1);
  // Keep the one worker for remounts / Strict Mode so a page never accumulates extras.
}

function decodeOnMain(
  buffer: ArrayBuffer,
  z: number,
  x: number,
  y: number,
  originLat: number,
  originLng: number,
  focusLat: number,
  focusLng: number,
) {
  return decodeTile(buffer, z, x, y, originLat, originLng, focusLat, focusLng);
}

async function fetchTileBuffer(url: string) {
  let last: Error | null = null;
  for (let attempt = 0; attempt < FETCH_TRIES; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`tile ${res.status}`);
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength < 24) throw new Error(`empty tile ${buffer.byteLength}`);
      return buffer;
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
      if (attempt < FETCH_TRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
  }
  throw last ?? new Error('tile fetch failed');
}

export default function useWorldTiles(originLat: number, originLng: number, lat: number, lng: number, enabled: boolean) {
  const [tiles, setTiles] = useState<WorldTileData[]>([]);
  const [warmTiles, setWarmTiles] = useState<WorldTileData[]>([]);
  const [status, setStatus] = useState<TileStatus>('loading');
  const [colliders, setColliders] = useState<WorldColliders>({
    buildings: [],
    roads: [],
    parks: [],
    buildingGrid: emptyFootprintGrid(),
    roadGrid: emptyFootprintGrid(),
    label: '',
  });
  const cache = useRef(new Map<string, WorldTileData>());
  const origin = useRef(`${originLat},${originLng}`);
  const focusRef = useRef({ lat, lng });
  focusRef.current = { lat, lng };
  const stableRef = useRef<TileCoord | null>(null);
  const center = stableTileCenter(lat, lng, stableRef.current, WORLD_TILE_ZOOM);
  stableRef.current = center;
  const tileKey = `${center.z}/${center.x}/${center.y}`;

  useEffect(() => {
    if (!enabled) return;
    if (origin.current !== `${originLat},${originLng}`) {
      cache.current.clear();
      origin.current = `${originLat},${originLng}`;
    }
    let dead = false;
    let failures = 0;
    let loaded = 0;
    const worker = acquireWorker();
    const pending = new Map<number, { resolve: (tile: WorldTileData) => void; reject: (error: Error) => void }>();
    let job = 1;
    const settle = (id: number, tile?: WorldTileData, error?: string) => {
      const wait = pending.get(id);
      pending.delete(id);
      if (!wait) return;
      if (tile) wait.resolve(tile);
      else wait.reject(new Error(error || 'decode'));
    };
    const failAll = (reason: string) => {
      workerHost().__DOG_TILE_WORKER_BROKEN__ = true;
      Array.from(pending.entries()).forEach(([id, wait]) => {
        pending.delete(id);
        wait.reject(new Error(reason));
      });
    };
    const onMessage = (event: MessageEvent<{ id: number; tile?: WorldTileData; packed?: PackedTile; error?: string }>) => {
      const tile = event.data.tile;
      if (tile && event.data.packed) tile.packed = event.data.packed;
      settle(event.data.id, tile, event.data.error);
    };
    const onWorkerError = () => {
      console.warn('[dog] tile worker failed; decoding on the main thread');
      failAll('worker error');
    };
    worker?.addEventListener('message', onMessage);
    worker?.addEventListener('error', onWorkerError);

    async function decode(buffer: ArrayBuffer, z: number, x: number, y: number) {
      if (!worker || workerHost().__DOG_TILE_WORKER_BROKEN__) {
        return decodeOnMain(
          buffer,
          z,
          x,
          y,
          originLat,
          originLng,
          focusRef.current.lat,
          focusRef.current.lng,
        );
      }
      const copy = buffer.slice(0);
      return new Promise<WorldTileData>((resolve, reject) => {
        const id = job;
        job += 1;
        const timer = window.setTimeout(() => {
          pending.delete(id);
          reject(new Error('decode timeout'));
        }, DECODE_MS);
        pending.set(id, {
          resolve: (tile) => {
            window.clearTimeout(timer);
            resolve(tile);
          },
          reject: (error) => {
            window.clearTimeout(timer);
            reject(error);
          },
        });
        try {
          worker.postMessage(
            {
              id,
              buffer: copy,
              z,
              x,
              y,
              originLat,
              originLng,
              focusLat: focusRef.current.lat,
              focusLng: focusRef.current.lng,
            },
            [copy],
          );
        } catch (error) {
          window.clearTimeout(timer);
          pending.delete(id);
          reject(error instanceof Error ? error : new Error('worker post'));
        }
      }).catch((error) => {
        console.warn('[dog] tile decode worker failed; using main thread', error);
        workerHost().__DOG_TILE_WORKER_BROKEN__ = true;
        return decodeOnMain(
          buffer,
          z,
          x,
          y,
          originLat,
          originLng,
          focusRef.current.lat,
          focusRef.current.lng,
        );
      });
    }

    function publish(displayKeys: Set<string>, keepKeys?: Set<string>) {
      const next = displayKeys.size
        ? Array.from(cache.current.entries())
            .filter(([key]) => displayKeys.has(key))
            .map(([, tile]) => tile)
        : [];
      const warming = keepKeys
        ? Array.from(cache.current.entries())
            .filter(([key]) => keepKeys.has(key))
            .map(([, tile]) => tile)
        : next;
      setTiles(next);
      setWarmTiles(warming);
      const buildings = warming.flatMap((tile) => tile.buildings.map((b) => b.ring));
      const roads = next.flatMap((tile) => tile.roads.map((r) => r.line));
      const parks = next.flatMap((tile) => tile.parks);
      const buildingGrid = buildFootprintGrid(buildings);
      const roadGrid = buildFootprintGrid(roads);
      liveBuildingGrid.current = buildingGrid;
      setColliders((current) => ({
        buildings,
        roads,
        parks,
        buildingGrid,
        roadGrid,
        label: current.label,
      }));
      if (next.some((tile) => tile.buildings.length || tile.roads.length)) {
        setStatus('ready');
      }
    }

    async function run() {
      setStatus('loading');
      let template: string;
      try {
        template = await tileTemplate();
      } catch (error) {
        console.warn('[dog] tilejson fetch failed', error);
        if (!dead) setStatus('failed');
        return;
      }
      const display = wantedTiles(center, TILE_RING).map((tile) => ({
        ...tile,
        key: `${tile.z}/${tile.x}/${tile.y}`,
      }));
      const keep = wantedTiles(center, KEEP_RING).map((tile) => ({
        ...tile,
        key: `${tile.z}/${tile.x}/${tile.y}`,
      }));
      const displayKeys = new Set(display.map((tile) => tile.key));
      const keepKeys = new Set(keep.map((tile) => tile.key));
      evictTileCache(cache.current, keepKeys, undefined, MAX_CACHED_TILES);
      const queue = keep.filter((tile) => !cache.current.has(tile.key));
      publish(displayKeys, keepKeys);
      let inflight = 0;
      await new Promise<void>((resolve) => {
        const kick = () => {
          if (dead) return resolve();
          if (!queue.length && inflight === 0) return resolve();
          const cap = loaded === 0 && !cache.current.has(`${center.z}/${center.x}/${center.y}`) ? 1 : MAX_INFLIGHT;
          while (inflight < cap && queue.length) {
            const tile = queue.shift();
            if (!tile) break;
            inflight += 1;
            const url = template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
            fetchTileBuffer(url)
              .then((buffer) => decode(buffer, tile.z, tile.x, tile.y))
              .then((data) => {
                loaded += 1;
                cache.current.set(tile.key, data);
                if (!dead) publish(displayKeys, keepKeys);
              })
              .catch((error) => {
                failures += 1;
                console.warn('[dog] tile fetch failed', url, error);
              })
              .finally(() => {
                inflight -= 1;
                kick();
              });
          }
        };
        kick();
      });
      if (dead) return;
      evictTileCache(cache.current, keepKeys, undefined, MAX_CACHED_TILES);
      if (loaded === 0 && (failures > 0 || cache.current.size === 0)) {
        setStatus('failed');
      } else {
        setStatus('ready');
      }
    }

    void run();
    return () => {
      dead = true;
      worker?.removeEventListener('message', onMessage);
      worker?.removeEventListener('error', onWorkerError);
      releaseWorker();
    };
  }, [center, enabled, originLat, originLng, tileKey]);

  useEffect(() => {
    if (!enabled || !tiles.length) return;
    const here = lngLatToLocal(lat, lng, originLat, originLng);
    const label =
      tiles
        .flatMap((tile) => tile.labels)
        .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))[0]?.name || '';
    setColliders((current) => (current.label === label ? current : { ...current, label }));
  }, [enabled, lat, lng, originLat, originLng, tiles]);

  return { tiles, warmTiles, colliders, status };
}

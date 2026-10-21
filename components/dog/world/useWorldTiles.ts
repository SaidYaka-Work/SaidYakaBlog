'use client';

import { useEffect, useRef, useState } from 'react';
import { TILEJSON_URL, lngLatToLocal, tileXY, type Ring } from '../../../workers/dog/src/world';
import { decodeTile, type WorldTileData } from './decode';

export type WorldColliders = {
  buildings: Ring[];
  roads: Ring[];
  parks: Ring[];
  label: string;
};

export type TileStatus = 'loading' | 'ready' | 'failed';

const MAX_INFLIGHT = 3;
const TILE_RING = 1;
const DECODE_MS = 8_000;
const FETCH_TRIES = 3;

let templatePromise: Promise<string> | null = null;
let sharedWorker: Worker | null = null;
let workerUsers = 0;
let workerBroken = false;

function tileTemplate() {
  if (!templatePromise) {
    templatePromise = fetch(TILEJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`tilejson ${res.status}`);
        return res.json();
      })
      .then((json: { tiles?: string[] }) => json.tiles?.[0] || 'https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf')
      .catch((error) => {
        templatePromise = null;
        throw error;
      });
  }
  return templatePromise;
}

function acquireWorker() {
  if (workerBroken) return null;
  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(new URL('./tile.worker.ts', import.meta.url));
      sharedWorker.addEventListener('error', () => {
        console.warn('[dog] tile worker failed; decoding on the main thread');
        workerBroken = true;
        try {
          sharedWorker?.terminate();
        } catch {
          // ignore
        }
        sharedWorker = null;
      });
    } catch (error) {
      console.warn('[dog] tile worker unavailable', error);
      workerBroken = true;
      sharedWorker = null;
    }
  }
  workerUsers += 1;
  return sharedWorker;
}

function releaseWorker() {
  workerUsers = Math.max(0, workerUsers - 1);
  if (workerUsers === 0 && sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
  }
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
      return await res.arrayBuffer();
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
  const [status, setStatus] = useState<TileStatus>('loading');
  const [colliders, setColliders] = useState<WorldColliders>({ buildings: [], roads: [], parks: [], label: '' });
  const cache = useRef(new Map<string, WorldTileData>());
  const origin = useRef(`${originLat},${originLng}`);
  const focusRef = useRef({ lat, lng });
  focusRef.current = { lat, lng };
  const center = tileXY(lat, lng);
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
      workerBroken = true;
      Array.from(pending.entries()).forEach(([id, wait]) => {
        pending.delete(id);
        wait.reject(new Error(reason));
      });
    };
    const onMessage = (event: MessageEvent<{ id: number; tile?: WorldTileData; error?: string }>) => {
      settle(event.data.id, event.data.tile, event.data.error);
    };
    const onWorkerError = () => {
      console.warn('[dog] tile worker failed; decoding on the main thread');
      failAll('worker error');
    };
    worker?.addEventListener('message', onMessage);
    worker?.addEventListener('error', onWorkerError);

    async function decode(buffer: ArrayBuffer, z: number, x: number, y: number) {
      if (!worker || workerBroken) {
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
        workerBroken = true;
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

    function publish(wantedKeys: Set<string>) {
      const next = wantedKeys.size
        ? Array.from(cache.current.entries())
            .filter(([key]) => wantedKeys.has(key))
            .map(([, tile]) => tile)
        : [];
      setTiles(next);
      setColliders((current) => ({
        buildings: next.flatMap((tile) => tile.buildings.map((b) => b.ring)),
        roads: next.flatMap((tile) => tile.roads.map((r) => r.line)),
        parks: next.flatMap((tile) => tile.parks),
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
      const wanted: { z: number; x: number; y: number; key: string }[] = [];
      for (let dy = -TILE_RING; dy <= TILE_RING; dy += 1) {
        for (let dx = -TILE_RING; dx <= TILE_RING; dx += 1) {
          const x = center.x + dx;
          const y = center.y + dy;
          wanted.push({ z: center.z, x, y, key: `${center.z}/${x}/${y}` });
        }
      }
      const wantedKeys = new Set(wanted.map((tile) => tile.key));
      const queue = wanted.filter((tile) => !cache.current.has(tile.key));
      publish(wantedKeys);
      let inflight = 0;
      await new Promise<void>((resolve) => {
        const kick = () => {
          if (dead) return resolve();
          if (!queue.length && inflight === 0) return resolve();
          while (inflight < MAX_INFLIGHT && queue.length) {
            const tile = queue.shift();
            if (!tile) break;
            inflight += 1;
            const url = template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
            fetchTileBuffer(url)
              .then((buffer) => decode(buffer, tile.z, tile.x, tile.y))
              .then((data) => {
                loaded += 1;
                cache.current.set(tile.key, data);
                if (!dead) publish(wantedKeys);
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
      Array.from(cache.current.keys()).forEach((key) => {
        if (!wantedKeys.has(key)) cache.current.delete(key);
      });
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
  }, [center.x, center.y, center.z, enabled, originLat, originLng, tileKey]);

  useEffect(() => {
    if (!enabled || !tiles.length) return;
    const here = lngLatToLocal(lat, lng, originLat, originLng);
    const label =
      tiles
        .flatMap((tile) => tile.labels)
        .sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z))[0]?.name || '';
    setColliders((current) => (current.label === label ? current : { ...current, label }));
  }, [enabled, lat, lng, originLat, originLng, tiles]);

  return { tiles, colliders, status };
}

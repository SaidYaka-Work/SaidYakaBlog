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

const MAX_INFLIGHT = 4;

let templatePromise: Promise<string> | null = null;

function tileTemplate() {
  if (!templatePromise) {
    templatePromise = fetch(TILEJSON_URL)
      .then((res) => res.json())
      .then((json: { tiles?: string[] }) => json.tiles?.[0] || 'https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf')
      .catch((error) => {
        templatePromise = null;
        throw error;
      });
  }
  return templatePromise;
}

export default function useWorldTiles(originLat: number, originLng: number, lat: number, lng: number, enabled: boolean) {
  const [tiles, setTiles] = useState<WorldTileData[]>([]);
  const [colliders, setColliders] = useState<WorldColliders>({ buildings: [], roads: [], parks: [], label: '' });
  const cache = useRef(new Map<string, WorldTileData>());
  const origin = useRef(`${originLat},${originLng}`);
  const center = tileXY(lat, lng);
  const tileKey = `${center.z}/${center.x}/${center.y}`;

  useEffect(() => {
    if (!enabled) return;
    if (origin.current !== `${originLat},${originLng}`) {
      cache.current.clear();
      origin.current = `${originLat},${originLng}`;
    }
    let dead = false;
    const worker = (() => {
      try {
        return new Worker(new URL('./tile.worker.ts', import.meta.url));
      } catch {
        return null;
      }
    })();
    const pending = new Map<number, (tile: WorldTileData) => void>();
    let job = 1;
    if (worker) {
      worker.onmessage = (event: MessageEvent<{ id: number; tile?: WorldTileData }>) => {
        const done = pending.get(event.data.id);
        if (event.data.tile) done?.(event.data.tile);
        pending.delete(event.data.id);
      };
    }

    async function decode(buffer: ArrayBuffer, z: number, x: number, y: number) {
      if (!worker) return decodeTile(buffer, z, x, y, originLat, originLng);
      return new Promise<WorldTileData>((resolve) => {
        const id = job;
        job += 1;
        pending.set(id, resolve);
        worker.postMessage({ id, buffer, z, x, y, originLat, originLng }, [buffer]);
      });
    }

    async function run() {
      const template = await tileTemplate();
      const wanted: { z: number; x: number; y: number; key: string }[] = [];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = center.x + dx;
          const y = center.y + dy;
          wanted.push({ z: center.z, x, y, key: `${center.z}/${x}/${y}` });
        }
      }
      const next: WorldTileData[] = [];
      const queue = wanted.filter((tile) => {
        const hit = cache.current.get(tile.key);
        if (hit) {
          next.push(hit);
          return false;
        }
        return true;
      });
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
            fetch(url)
              .then((res) => res.arrayBuffer())
              .then((buffer) => decode(buffer, tile.z, tile.x, tile.y))
              .then((data) => {
                cache.current.set(tile.key, data);
                next.push(data);
              })
              .catch(() => undefined)
              .finally(() => {
                inflight -= 1;
                kick();
              });
          }
        };
        kick();
      });
      if (dead) return;
      setTiles(next);
      const wantedKeys = new Set(wanted.map((tile) => tile.key));
      Array.from(cache.current.keys()).forEach((key) => {
        if (!wantedKeys.has(key)) cache.current.delete(key);
      });
      const buildings = next.flatMap((tile) => tile.buildings.map((b) => b.ring));
      const roads = next.flatMap((tile) => tile.roads.map((r) => r.line));
      const parks = next.flatMap((tile) => tile.parks);
      setColliders((current) => ({ buildings, roads, parks, label: current.label }));
    }

    void run();
    return () => {
      dead = true;
      worker?.terminate();
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

  return { tiles, colliders };
}

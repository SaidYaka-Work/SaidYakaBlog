/// <reference lib="webworker" />
import { decodeTile } from './decode';

self.onmessage = (event: MessageEvent<{ id: number; buffer: ArrayBuffer; z: number; x: number; y: number; originLat: number; originLng: number }>) => {
  const { id, buffer, z, x, y, originLat, originLng } = event.data;
  try {
    const tile = decodeTile(buffer, z, x, y, originLat, originLng);
    self.postMessage({ id, tile });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'decode' });
  }
};

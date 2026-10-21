/// <reference lib="webworker" />
import { decodeTile } from './decode';

self.onmessage = (
  event: MessageEvent<{
    id: number;
    buffer: ArrayBuffer;
    z: number;
    x: number;
    y: number;
    originLat: number;
    originLng: number;
    focusLat?: number;
    focusLng?: number;
  }>,
) => {
  const { id, buffer, z, x, y, originLat, originLng, focusLat, focusLng } = event.data;
  try {
    const tile = decodeTile(buffer, z, x, y, originLat, originLng, focusLat ?? originLat, focusLng ?? originLng);
    self.postMessage({ id, tile });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'decode' });
  }
};

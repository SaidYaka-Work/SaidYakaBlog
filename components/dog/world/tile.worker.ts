/// <reference lib="webworker" />
import { lngLatToLocal } from '../../../workers/dog/src/world';
import { runBuildJob } from './buildTile';
import { decodeTile } from './decode';
import { disposePackedSources, packBuiltTile, packedTransferList } from './packTile';

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
    const focus = lngLatToLocal(focusLat ?? originLat, focusLng ?? originLng, originLat, originLng);
    const { built } = runBuildJob(tile, focus);
    const packed = packBuiltTile(built);
    disposePackedSources(built);
    const transfers = packedTransferList(packed);
    self.postMessage({ id, tile, packed }, transfers);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'decode' });
  }
};

'use client';

import { useEffect } from 'react';
import WorldScene from './WorldScene';
import useWorldTiles, { type TileStatus, type WorldColliders } from './useWorldTiles';

export default function WorldLayer({
  originLat,
  originLng,
  lat,
  lng,
  night,
  onColliders,
  onStatus,
}: {
  originLat: number;
  originLng: number;
  lat: number;
  lng: number;
  night?: boolean;
  onColliders?: (colliders: WorldColliders) => void;
  onStatus?: (status: TileStatus) => void;
}) {
  const { tiles, colliders, status } = useWorldTiles(originLat, originLng, lat, lng, true);
  useEffect(() => {
    onColliders?.(colliders);
  }, [colliders, onColliders]);
  useEffect(() => {
    onStatus?.(status);
  }, [onStatus, status]);
  return (
    <WorldScene
      tiles={tiles}
      lat={lat}
      lng={lng}
      originLat={originLat}
      originLng={originLng}
      nightHint={night}
      failed={status === 'failed'}
    />
  );
}

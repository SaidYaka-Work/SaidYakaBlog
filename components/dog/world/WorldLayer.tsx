'use client';

import { useEffect } from 'react';
import WorldScene from './WorldScene';
import useWorldTiles, { type WorldColliders } from './useWorldTiles';

export default function WorldLayer({
  originLat,
  originLng,
  lat,
  lng,
  night,
  onColliders,
}: {
  originLat: number;
  originLng: number;
  lat: number;
  lng: number;
  night?: boolean;
  onColliders?: (colliders: WorldColliders) => void;
}) {
  const { tiles, colliders } = useWorldTiles(originLat, originLng, lat, lng, true);
  useEffect(() => {
    onColliders?.(colliders);
  }, [colliders, onColliders]);
  return (
    <WorldScene
      tiles={tiles}
      lat={lat}
      lng={lng}
      originLat={originLat}
      originLng={originLng}
      nightHint={night}
    />
  );
}

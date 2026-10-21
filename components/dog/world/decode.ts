import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { lngLatToLocal, type Ring } from '../../../workers/dog/src/world';

export type BuildingFeat = { ring: Ring; height: number; min: number; area: number };
export type RoadFeat = { line: Ring; width: number; klass: string };
export type WorldTileData = {
  key: string;
  buildings: BuildingFeat[];
  roads: RoadFeat[];
  water: Ring[];
  parks: Ring[];
  labels: { x: number; z: number; name: string }[];
};

const ROAD_WIDTH: Record<string, number> = {
  motorway: 12,
  trunk: 11,
  primary: 9,
  secondary: 7.5,
  tertiary: 6.5,
  minor: 5.5,
  street: 5.5,
  service: 3.6,
  path: 2.4,
  footway: 2.2,
  pedestrian: 4,
  track: 3,
};

function tileToLngLat(z: number, x: number, y: number, px: number, py: number, extent: number) {
  const n = 2 ** z;
  const lng = ((x + px / extent) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

function ringArea(ring: Ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    a += ring[j].x * ring[i].z - ring[i].x * ring[j].z;
  }
  return Math.abs(a) * 0.5;
}

function simplify(ring: Ring, min = 8) {
  if (ring.length <= min) return ring;
  const step = Math.ceil(ring.length / min);
  const next = ring.filter((_, i) => i % step === 0);
  if (next[0] !== ring[0]) next.unshift(ring[0]);
  return next;
}

function toLocal(
  rings: { x: number; y: number }[][],
  z: number,
  x: number,
  y: number,
  extent: number,
  originLat: number,
  originLng: number,
): Ring[] {
  return rings.map((path) =>
    simplify(
      path.map((p) => {
        const geo = tileToLngLat(z, x, y, p.x, p.y, extent);
        return lngLatToLocal(geo.lat, geo.lng, originLat, originLng);
      }),
    ),
  );
}

export function decodeTile(
  buffer: ArrayBuffer,
  z: number,
  x: number,
  y: number,
  originLat: number,
  originLng: number,
): WorldTileData {
  const tile = new VectorTile(new PbfReader(new Uint8Array(buffer)));
  const buildings: BuildingFeat[] = [];
  const roads: RoadFeat[] = [];
  const water: Ring[] = [];
  const parks: Ring[] = [];
  const labels: WorldTileData['labels'] = [];

  const building = tile.layers.building;
  if (building) {
    for (let i = 0; i < building.length; i += 1) {
      const feat = building.feature(i);
      const rings = toLocal(feat.loadGeometry(), z, x, y, building.extent, originLat, originLng);
      const props = feat.properties as { render_height?: number; render_min_height?: number; hide_3d?: boolean };
      if (props.hide_3d) continue;
      for (const ring of rings) {
        if (ring.length < 3) continue;
        const area = ringArea(ring);
        if (area < 10) continue;
        buildings.push({
          ring,
          height: Math.min(140, Math.max(4.2, Number(props.render_height) || 9)),
          min: Math.max(0, Number(props.render_min_height) || 0),
          area,
        });
      }
    }
    buildings.sort((a, b) => b.area - a.area);
    buildings.splice(160);
  }

  const transport = tile.layers.transportation;
  if (transport) {
    for (let i = 0; i < transport.length; i += 1) {
      const feat = transport.feature(i);
      const klass = String((feat.properties as { class?: string }).class || 'street');
      const width = ROAD_WIDTH[klass] ?? 5;
      const lines = toLocal(feat.loadGeometry(), z, x, y, transport.extent, originLat, originLng);
      for (const line of lines) {
        if (line.length >= 2) roads.push({ line, width, klass });
      }
    }
    if (roads.length > 280) roads.length = 280;
  }

  for (const name of ['water', 'park', 'landcover', 'landuse'] as const) {
    const layer = tile.layers[name];
    if (!layer) continue;
    for (let i = 0; i < layer.length; i += 1) {
      const feat = layer.feature(i);
      const klass = String((feat.properties as { class?: string }).class || name);
      const rings = toLocal(feat.loadGeometry(), z, x, y, layer.extent, originLat, originLng);
      const dest = name === 'water' || klass === 'water' ? water : parks;
      if (name === 'landcover' && klass !== 'grass' && klass !== 'wood' && klass !== 'farmland') continue;
      if (name === 'landuse' && klass !== 'park' && klass !== 'pitch' && klass !== 'cemetery') continue;
      for (const ring of rings) {
        if (ring.length >= 3 && ringArea(ring) > 20) dest.push(ring);
      }
    }
  }

  const named = tile.layers.transportation_name || tile.layers.poi || tile.layers.place;
  if (named) {
    for (let i = 0; i < named.length && labels.length < 8; i += 1) {
      const feat = named.feature(i);
      const label = String((feat.properties as { name?: string; name_en?: string }).name_en || (feat.properties as { name?: string }).name || '');
      if (!label) continue;
      const geom = feat.loadGeometry()[0];
      if (!geom?.[0]) continue;
      const geo = tileToLngLat(z, x, y, geom[0].x, geom[0].y, named.extent);
      const local = lngLatToLocal(geo.lat, geo.lng, originLat, originLng);
      labels.push({ ...local, name: label });
    }
  }

  return { key: `${z}/${x}/${y}`, buildings, roads, water, parks, labels };
}

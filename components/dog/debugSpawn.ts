/** Local-only QA spawn. Never write this to the shared saved dog. */

export type DebugSpawn = { lat: number; lng: number; name: string };

export const SPAWN_PRESETS: Record<string, DebugSpawn> = {
  'timessq-buildings': { lat: 40.75842, lng: -73.98505, name: 'Times Square buildings' },
  timessq: { lat: 40.758, lng: -73.9855, name: 'Times Square' },
  'wsp-buildings': { lat: 40.73015, lng: -73.99655, name: 'Washington Square buildings' },
  wsp: { lat: 40.730823, lng: -73.997332, name: 'Washington Square Park' },
  'avenue-row': { lat: 40.76105, lng: -73.98355, name: '6½ Avenue' },
};

export function parseDebugSpawn(search: string): DebugSpawn | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const raw = params.get('spawn');
  if (!raw) return null;
  const preset = SPAWN_PRESETS[raw];
  if (preset) return { ...preset };
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180) {
    return { lat: parts[0], lng: parts[1], name: `${parts[0].toFixed(5)},${parts[1].toFixed(5)}` };
  }
  return null;
}

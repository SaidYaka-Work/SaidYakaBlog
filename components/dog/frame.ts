import { Box3, PerspectiveCamera, Sphere, Vector3, type Mesh, type Object3D, type SkinnedMesh } from 'three';

const _box = new Box3();
const _meshBox = new Box3();
const _sphere = new Sphere();
const _center = new Vector3();
const _desired = new Vector3();
const _corner = new Vector3();
const _size = new Vector3();

export const THREE_QUARTER_YAW = 0.55;
export const CAMERA_YAW = 0.32;
export const SLEEP_ROLL = Math.PI / 2;
export const SLEEP_YAW = Math.PI / 2;
export const BOWL = { x: -1.62, y: 0.07, z: 1.38 };
export const EAT_STAND = { x: -1, z: 1.38 };
export const EAT_YAW = Math.atan2(BOWL.x - EAT_STAND.x, BOWL.z - EAT_STAND.z);

function isBoneParent(node: Object3D) {
  let parent = node.parent;
  while (parent) {
    if ((parent as { isBone?: boolean }).isBone) return true;
    parent = parent.parent;
  }
  return false;
}

export function meshBounds(object: Object3D) {
  object.updateWorldMatrix(true, true);
  _box.makeEmpty();
  object.traverse((node) => {
    const mesh = node as Mesh & SkinnedMesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.name === 'Collar' || isBoneParent(mesh)) return;
    if (mesh.isSkinnedMesh) {
      mesh.computeBoundingBox();
      if (!mesh.boundingBox || mesh.boundingBox.isEmpty()) return;
      _meshBox.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
    } else {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const local = mesh.geometry.boundingBox;
      if (!local) return;
      _meshBox.copy(local).applyMatrix4(mesh.matrixWorld);
    }
    const sizeX = _meshBox.max.x - _meshBox.min.x;
    const sizeY = _meshBox.max.y - _meshBox.min.y;
    const sizeZ = _meshBox.max.z - _meshBox.min.z;
    if (sizeX > 4 || sizeY > 4 || sizeZ > 4) return;
    _box.union(_meshBox);
  });
  if (_box.isEmpty()) {
    _box.setFromObject(object, true);
    _box.getSize(_size);
    if (_box.isEmpty() || _size.x > 4 || _size.y > 4 || _size.z > 4) {
      object.getWorldPosition(_center);
      _box.setFromCenterAndSize(_center, _size.set(1.2, 1.5, 2.1));
    }
  }
  return !_box.isEmpty();
}

export function groundToFloor(object: Object3D, floorY = 0) {
  if (!meshBounds(object)) return null;
  const lift = floorY - _box.min.y;
  if (!Number.isFinite(lift) || Math.abs(lift) > 1.6) {
    object.position.y = floorY;
    object.updateWorldMatrix(true, true);
    return { lift: 0, minY: floorY, maxY: floorY + 1.2, center: object.position.clone() };
  }
  object.position.y += lift;
  object.updateWorldMatrix(true, true);
  meshBounds(object);
  return { lift, minY: _box.min.y, maxY: _box.max.y, center: _box.getCenter(new Vector3()) };
}

function placeCamera(
  camera: PerspectiveCamera,
  dist: number,
  yaw: number,
  pitch: number,
  lift: number,
  aspect: number,
) {
  _desired.set(
    _center.x + dist * Math.sin(yaw) * Math.cos(pitch),
    _center.y + dist * Math.sin(pitch),
    _center.z + dist * Math.cos(yaw) * Math.cos(pitch),
  );
  camera.up.set(0, 1, 0);
  camera.position.copy(_desired);
  camera.near = Math.max(0.08, dist / 40);
  camera.far = Math.max(80, dist * 10);
  camera.aspect = aspect;
  camera.lookAt(_center.x, _center.y - lift, _center.z);
  camera.updateProjectionMatrix();
}

/** Puppy occupies ~1/6–1/4 of the viewport; later stages grow a little. */
export const YARD_FRAC: Record<string, number> = {
  puppy: 0.21,
  young: 0.26,
  adult: 0.31,
  senior: 0.29,
};

/** Keep the dog out of name, chips, meters, and the Pet/Feed bar. */
export const YARD_SAFE = {
  minX: -0.48,
  maxX: 0.78,
  minY: -0.42,
  maxY: 0.5,
};

export const YARD_PITCH = 0.52;

/** Room-only body scale so the yard reads roomy next to furniture. */
export const YARD_BODY: Record<string, number> = {
  puppy: 0.62,
  young: 0.76,
  adult: 0.88,
  senior: 0.86,
};

const YARD_HEIGHT: Record<string, number> = {
  puppy: 0.78,
  young: 0.96,
  adult: 1.12,
  senior: 1.06,
};

export function followYardCamera(
  camera: PerspectiveCamera,
  object: Object3D,
  opts: { stage?: string; asleep?: boolean; aspect?: number } = {},
) {
  const stage = opts.stage ?? 'adult';
  const frac = YARD_FRAC[stage] ?? YARD_FRAC.adult;
  const aspect = opts.aspect ?? camera.aspect ?? 1;
  const fov = (camera.fov * Math.PI) / 180;
  const visualH = YARD_HEIGHT[stage] ?? YARD_HEIGHT.adult;
  object.getWorldPosition(_center);
  const lookY = visualH * 0.34;
  _box.min.set(_center.x - 0.3, 0, _center.z - 0.38);
  _box.max.set(_center.x + 0.3, visualH, _center.z + 0.38);
  const pitch = opts.asleep ? 0.48 : YARD_PITCH;
  const yaw = CAMERA_YAW;
  let dist = visualH / (Math.max(0.14, frac * 2) * Math.tan(fov / 2));
  dist = Math.min(8.6, Math.max(opts.asleep ? 5.2 : 5.6, dist));

  for (let i = 0; i < 8; i += 1) {
    _desired.set(
      _center.x + dist * Math.sin(yaw) * Math.cos(pitch),
      lookY + dist * Math.sin(pitch),
      _center.z + dist * Math.cos(yaw) * Math.cos(pitch),
    );
    camera.up.set(0, 1, 0);
    camera.position.copy(_desired);
    camera.near = Math.max(0.08, dist / 40);
    camera.far = Math.max(80, dist * 8);
    camera.aspect = aspect;
    camera.lookAt(_center.x, lookY, _center.z);
    camera.updateProjectionMatrix();
    const projected = projectCorners(camera);
    const height = projected.maxY - projected.minY;
    const overflow =
      projected.minX < YARD_SAFE.minX ||
      projected.maxX > YARD_SAFE.maxX ||
      projected.minY < YARD_SAFE.minY ||
      projected.maxY > YARD_SAFE.maxY ||
      height > frac * 2 * 1.22;
    if (!overflow) break;
    dist = Math.min(8.6, dist * 1.06);
  }

  return { center: _center.clone(), dist, desired: _desired.clone(), lookY };
}

export function frameCamera(
  camera: PerspectiveCamera,
  object: Object3D,
  opts: { pad?: number; yaw?: number; pitch?: number; aspect?: number; lift?: number; minDist?: number } = {},
) {
  if (!meshBounds(object)) return null;
  _box.getBoundingSphere(_sphere);
  _box.getCenter(_center);
  const pad = opts.pad ?? 1.42;
  const yaw = opts.yaw ?? CAMERA_YAW;
  const pitch = opts.pitch ?? 0.16;
  const lift = opts.lift ?? 0;
  const aspect = opts.aspect ?? camera.aspect ?? 1;
  const radius = Math.max(_sphere.radius, 0.35);
  let dist = opts.minDist ?? 3.05;
  for (let i = 0; i < 10; i += 1) {
    placeCamera(camera, dist, yaw, pitch, lift, aspect);
    const projected = projectCorners(camera);
    const margin = Math.min(0.9, 0.92 / Math.max(1.15, pad));
    if (
      projected.minX > -margin &&
      projected.maxX < margin &&
      projected.minY > -margin &&
      projected.maxY < margin &&
      projected.behind < 8
    ) {
      break;
    }
    dist = Math.min(7.2, dist * 1.1);
  }
  return { center: _center.clone(), radius, dist, desired: _desired.clone() };
}

function projectCorners(camera: PerspectiveCamera) {
  const { min, max } = _box;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let behind = 0;
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        _corner.set(x, y, z).project(camera);
        minX = Math.min(minX, _corner.x);
        maxX = Math.max(maxX, _corner.x);
        minY = Math.min(minY, _corner.y);
        maxY = Math.max(maxY, _corner.y);
        if (_corner.z < 0 || _corner.z > 1) behind += 1;
      }
    }
  }
  return { minX, minY, maxX, maxY, behind };
}

export function projectMeshBounds(object: Object3D, camera: PerspectiveCamera) {
  if (!meshBounds(object)) return null;
  const { minX, minY, maxX, maxY, behind } = projectCorners(camera);
  const width = maxX - minX;
  const height = maxY - minY;
  const onScreen = behind < 8 && minX >= -1 && maxX <= 1 && minY >= -1 && maxY <= 1;
  const fills = width >= 0.2 && height >= 0.16;
  const inView = onScreen && fills;
  return { minX, minY, maxX, maxY, width, height, behind, onScreen, fills, inView };
}

export function clipPreviewTime(kind: string, duration: number) {
  if (kind === 'sleep' || kind === 'lie') return duration * 0.94;
  if (kind === 'walk') return duration * 0.32;
  if (kind === 'pet') return duration * 0.42;
  if (kind === 'eat') return duration * 0.48;
  if (kind === 'sad') return duration * 0.55;
  return Math.min(0.35, duration * 0.2);
}

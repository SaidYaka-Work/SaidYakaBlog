import { Box3, PerspectiveCamera, Sphere, Vector3, type Mesh, type Object3D, type SkinnedMesh } from 'three';

const _box = new Box3();
const _meshBox = new Box3();
const _sphere = new Sphere();
const _center = new Vector3();
const _desired = new Vector3();
const _corner = new Vector3();

export const THREE_QUARTER_YAW = 0.55;
export const CAMERA_YAW = 0.1;
export const SLEEP_ROLL = -Math.PI / 2;
export const BOWL = { x: -0.58, y: 0.07, z: 0.7 };
export const EAT_YAW = Math.atan2(BOWL.x, BOWL.z);

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
    if (isBoneParent(mesh)) return;
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
    if (sizeX > 8 || sizeY > 8 || sizeZ > 8) return;
    _box.union(_meshBox);
  });
  return !_box.isEmpty();
}

export function groundToFloor(object: Object3D, floorY = 0) {
  if (!meshBounds(object)) return null;
  const lift = floorY - _box.min.y;
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
    dist = Math.min(6.4, dist * 1.1);
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

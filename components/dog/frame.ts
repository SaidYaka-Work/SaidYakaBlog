import { Box3, PerspectiveCamera, Sphere, Vector3, type Mesh, type Object3D } from 'three';

const _box = new Box3();
const _meshBox = new Box3();
const _sphere = new Sphere();
const _center = new Vector3();
const _desired = new Vector3();

export const THREE_QUARTER_YAW = 0.52;
export const CAMERA_YAW = 0.18;

function meshBounds(object: Object3D) {
  object.updateWorldMatrix(true, true);
  _box.makeEmpty();
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const local = mesh.geometry.boundingBox;
    if (!local) return;
    _meshBox.copy(local).applyMatrix4(mesh.matrixWorld);
    _box.union(_meshBox);
  });
  return !_box.isEmpty();
}

export function frameCamera(
  camera: PerspectiveCamera,
  object: Object3D,
  opts: { pad?: number; yaw?: number; pitch?: number; aspect?: number } = {},
) {
  if (!meshBounds(object)) return null;
  _box.getBoundingSphere(_sphere);
  _box.getCenter(_center);
  const pad = opts.pad ?? 1.42;
  const yaw = opts.yaw ?? CAMERA_YAW;
  const pitch = opts.pitch ?? 0.2;
  const fov = (camera.fov * Math.PI) / 180;
  const aspect = opts.aspect ?? camera.aspect ?? 1;
  const radius = Math.min(1.85, Math.max(_sphere.radius, 0.35) * pad);
  const dist = radius / Math.sin(fov / 2) / Math.min(1, aspect);
  _desired.set(
    _center.x + dist * Math.sin(yaw) * Math.cos(pitch),
    _center.y + dist * Math.sin(pitch),
    _center.z + dist * Math.cos(yaw) * Math.cos(pitch),
  );
  camera.position.copy(_desired);
  camera.near = Math.max(0.05, dist / 40);
  camera.far = Math.max(40, dist * 8);
  camera.lookAt(_center.x, _center.y + radius * 0.06, _center.z);
  camera.updateProjectionMatrix();
  return { center: _center.clone(), radius, dist, desired: _desired.clone() };
}

export function clipPreviewTime(kind: string, duration: number) {
  if (kind === 'sleep' || kind === 'lie') return duration * 0.94;
  if (kind === 'walk') return duration * 0.32;
  if (kind === 'pet') return duration * 0.42;
  if (kind === 'eat') return duration * 0.48;
  if (kind === 'sad') return duration * 0.55;
  return Math.min(0.35, duration * 0.2);
}

import { BoxGeometry, Group, Mesh, PerspectiveCamera } from 'three';
import { frameCamera, groundToFloor, meshBounds, projectMeshBounds, SLEEP_ROLL } from '../components/dog/frame.ts';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const dog = new Group();
const mesh = new Mesh(new BoxGeometry(0.45, 0.7, 1.15));
mesh.position.y = 0.35;
dog.add(mesh);
dog.updateWorldMatrix(true, true);

assert(meshBounds(dog), 'standing mesh bounds exist');
const stood = groundToFloor(dog, 0);
assert(stood && Math.abs(stood.minY) < 0.002, `standing min y should be 0, got ${stood?.minY}`);

dog.rotation.z = SLEEP_ROLL;
dog.position.y = 0.4;
const slept = groundToFloor(dog, 0);
assert(slept && Math.abs(slept.minY) < 0.002, `sleeping min y should be 0, got ${slept?.minY}`);
assert(slept && slept.maxY < 0.85, `sleeping dog should be low, max y ${slept?.maxY}`);

const camera = new PerspectiveCamera(32, 16 / 9, 0.1, 80);
const framed = frameCamera(camera, dog, { pad: 1.55, minDist: 2.7, aspect: 16 / 9 });
assert(framed && framed.dist >= 2.7, 'camera stays at least minDist away');
assert(Math.abs(camera.up.y - 1) < 0.001, 'camera stays level');
const projected = projectMeshBounds(dog, camera);
assert(projected && projected.minX > -1 && projected.maxX < 1 && projected.minY > -1 && projected.maxY < 1, `sleeping dog should stay on screen ${JSON.stringify(projected)}`);

console.log('dog-frame-check ok');

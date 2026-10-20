import { Bone, BoxGeometry, Group, Mesh, PerspectiveCamera } from 'three';
import { BOWL, EAT_YAW, frameCamera, groundToFloor, meshBounds, projectMeshBounds, SLEEP_ROLL } from '../components/dog/frame.ts';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const dog = new Group();
const mesh = new Mesh(new BoxGeometry(0.45, 0.7, 1.15));
mesh.position.y = 0.35;
dog.add(mesh);

const bone = new Bone();
bone.position.set(40, -30, 20);
const collar = new Mesh(new BoxGeometry(0.2, 0.2, 0.2));
bone.add(collar);
dog.add(bone);

const stray = new Mesh(new BoxGeometry(24, 24, 24));
stray.position.set(0, 0, -12);
dog.add(stray);
dog.updateWorldMatrix(true, true);

assert(meshBounds(dog), 'standing mesh bounds exist');
const stood = groundToFloor(dog, 0);
assert(stood && Math.abs(stood.minY) < 0.002, `standing min y should be 0, got ${stood?.minY}`);
assert(stood && stood.maxY < 0.85, `standing height should stay dog-sized, max y ${stood?.maxY}`);

dog.rotation.z = SLEEP_ROLL;
dog.position.y = 0.4;
const slept = groundToFloor(dog, 0);
assert(slept && Math.abs(slept.minY) < 0.002, `sleeping min y should be 0, got ${slept?.minY}`);
assert(slept && slept.maxY < 0.85, `sleeping dog should be low, max y ${slept?.maxY}`);

const camera = new PerspectiveCamera(32, 16 / 9, 0.1, 80);
const framed = frameCamera(camera, dog, { pad: 1.55, minDist: 2.7, aspect: 16 / 9 });
assert(framed && framed.dist >= 2.7 && framed.dist <= 5.8, `camera should stay close, dist ${framed?.dist}`);
assert(Math.abs(camera.up.y - 1) < 0.001 && Math.abs(camera.up.x) < 0.001, 'camera stays level');
const projected = projectMeshBounds(dog, camera);
assert(
  projected && projected.minY > -1 && projected.maxY < 1 && projected.minX > -1 && projected.maxX < 1,
  `sleeping dog should stay on screen ${JSON.stringify(projected)}`,
);
assert(projected && projected.fills && projected.inView, `sleeping dog should fill the frame ${JSON.stringify(projected)}`);

const walkCam = new PerspectiveCamera(30, 16 / 9, 0.1, 80);
dog.rotation.set(0, 0.55, 0);
dog.position.set(0.32, 0, 0.22);
groundToFloor(dog, 0);
const walk = frameCamera(walkCam, dog, { pad: 1.62, minDist: 3.1, aspect: 16 / 9 });
const walkProj = projectMeshBounds(dog, walkCam);
assert(walk && walk.dist >= 3.1 && walk.dist <= 5.8, 'walk camera keeps a fixed minimum distance');
assert(walkProj && walkProj.inView, `walking dog should stay in frame ${JSON.stringify(walkProj)}`);

const headingDot = Math.sin(EAT_YAW) * BOWL.x + Math.cos(EAT_YAW) * BOWL.z;
assert(headingDot > 0.3, `eat heading should point toward the bowl, got ${headingDot}`);
assert(BOWL.x < 0 && BOWL.z > 0, 'bowl stays front-left of the dog, camera-side');

console.log('dog-frame-check ok');

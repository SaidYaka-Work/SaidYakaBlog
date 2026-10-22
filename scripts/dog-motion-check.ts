import { BoxGeometry, Group, Mesh } from 'three';
import {
  ROOM_HALF,
  RUN_SPEED,
  YAW_TURN,
  applyDrive,
  createYard,
  integratePose,
  steerToward,
  tickYardAi,
} from '../workers/dog/src/room.ts';
import {
  hopHeight,
  insideYard,
  plantOnFloor,
  pushTrail,
  reconcileDriver,
  sampleBuffer,
  type PoseSample,
  type TrailPoint,
} from '../components/dog/motion.ts';
import { dressCell } from '../components/dog/world/dress.ts';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const dt = 1 / 60;
const floor = 0;
const dog = new Group();
const body = new Mesh(new BoxGeometry(0.4, 0.7, 1.1));
body.position.y = 0.35;
dog.add(body);
dog.updateWorldMatrix(true, true);
const foot = body.position.y - 0.35;

for (let i = 0; i < 40; i += 1) {
  body.position.y = 0.35 + Math.sin(i * 0.4) * 0.2;
  dog.position.set(0.2 * i, 2, -0.1 * i);
  plantOnFloor(dog, foot, floor);
  assert(Math.abs(dog.position.y - floor) < 1e-9, `planted y must stay on the floor, got ${dog.position.y}`);
}

assert(hopHeight(0, -10) === 0 && hopHeight(0, 400) === 0, 'hop is in-place and finite');
assert(hopHeight(0, 160) > 0 && hopHeight(0, 160) < 0.06, 'pet hop stays small');

let yard = createYard(0);
let last = { ...yard.pose };
const rng = (() => {
  let s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
})();

for (let i = 0; i < 8 * 60; i += 1) {
  const ax = Math.sin(i * 0.17) + (rng() - 0.5) * 0.4;
  const az = Math.cos(i * 0.13) + (rng() - 0.5) * 0.4;
  const run = i % 90 < 20;
  const stepped = integratePose(yard.pose, ax, az, run, dt);
  yard = { ...yard, pose: stepped.pose };
  const pose = yard.pose;
  const speed = Math.hypot(pose.vx, pose.vz);
  const jump = Math.hypot(pose.x - last.x, pose.z - last.z);
  const turn = Math.abs(((pose.yaw - last.yaw + Math.PI) % (Math.PI * 2)) - Math.PI);
  assert(speed <= RUN_SPEED + 0.08, `speed ${speed} exceeds max`);
  assert(jump <= RUN_SPEED * dt + 0.06, `position jump ${jump} at frame ${i}`);
  assert(turn <= YAW_TURN * dt + 0.02, `heading jump ${turn} at frame ${i}`);
  assert(insideYard(pose.x, pose.z), `left the yard ${pose.x},${pose.z}`);
  assert(Math.abs(pose.x) <= ROOM_HALF && Math.abs(pose.z) <= ROOM_HALF, 'outside fence');
  last = { ...pose };
}

const reverse = integratePose({ x: 0, z: 0, yaw: 0, vx: 0, vz: 0, gait: 'idle' }, 0, -1, false, dt);
assert(Math.hypot(reverse.pose.vx, reverse.pose.vz) < 0.35, 'reverse should turn in place first');

const buf: PoseSample[] = [
  { at: 0, x: 0, z: 0, yaw: 0, gait: 'walk' },
  { at: 80, x: 0.2, z: 0.1, yaw: 0.2, gait: 'walk' },
  { at: 160, x: 0.4, z: 0.2, yaw: 0.4, gait: 'walk' },
];
const mid = sampleBuffer(buf, 200, 120);
assert(mid && Math.abs(mid.x - 0.2) < 0.15, `buffer interpolates, got ${mid?.x}`);

let ai = createYard(0);
for (let i = 0; i < 240; i += 1) {
  ai = tickYardAi(ai, i * 250, 0.25, {}, rng);
  assert(insideYard(ai.pose.x, ai.pose.z), 'autopilot left the yard');
  if (ai.pose.gait === 'run') {
    assert(ai.ai.mode === 'wander', 'autopilot only sprints while wandering');
  }
}

const around = steerToward(-1.2, -1.1, 1.4, -0.1);
assert(Math.hypot(around.ax, around.az) > 0.4, 'steerToward returns a heading');

const driven = applyDrive(createYard(0), 0, 1, false, 0.1, 10);
assert(driven.pose.x === driven.pose.x && !('y' in driven.pose), 'sim pose has no y');

const idle = { x: 4, z: -8, yaw: 0, vx: 0, vz: 0, gait: 'walk' as const };
const stale = { ...idle, z: -7.2 };
const naive = reconcileDriver(idle, stale);
assert(Math.abs(naive.z - idle.z) > 0.05, 'without a trail, a 0.8 m echo still tugs');

const trail: TrailPoint[] = [];
pushTrail(trail, 1000, 4, -7.2);
pushTrail(trail, 1250, 4, -7.6);
pushTrail(trail, 1500, 4, -8);
const matched = reconcileDriver(idle, stale, trail);
assert(matched.z === idle.z && matched.x === idle.x, `trail match must not pull back, got z=${matched.z}`);
pushTrail(trail, 4000, 4, -12);
assert(trail[0].at >= 2500, 'trail drops samples older than 1.5 s');

const far = reconcileDriver(idle, { ...idle, x: 10, z: 10 }, trail);
assert(far.x === 10 && trail.length === 0, 'a >2 m snap clears the trail');

assert(dressCell({ x: 5, z: -5 }).x === 0 && dressCell({ x: 5, z: -5 }).z === 0, 'dress stays on the 12 m cell');
assert(dressCell({ x: 13, z: -20 }).x === 12 && dressCell({ x: 13, z: -20 }).z === -24, 'dress hops only after 12 m');

console.log('dog-motion-check ok');

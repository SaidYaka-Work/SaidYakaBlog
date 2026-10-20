import { hashSeed, mulberry32, type DogGenome, type LifeStage } from '@/lib/dog';
import { extrasFromGenome, palette, type PortraitReaction } from './look';
import type { Object3D } from 'three';

export const SHIBA_URL = '/dog/ShibaInu.glb';
export const HUSKY_URL = '/dog/Husky.glb';

export type Breed = 'ShibaInu' | 'Husky';

export function breedFromGenome(genome: DogGenome): Breed {
  if (genome.seed === 'biscuit-porch-1') return 'ShibaInu';
  const rng = mulberry32(hashSeed(`${genome.seed}:breed`));
  if (genome.earShape === 'prick' && (genome.build === 'lean' || genome.build === 'long')) {
    return rng() > 0.2 ? 'Husky' : 'ShibaInu';
  }
  return rng() > 0.62 ? 'Husky' : 'ShibaInu';
}

export function modelUrl(breed: Breed) {
  return breed === 'Husky' ? HUSKY_URL : SHIBA_URL;
}

export function clipName(names: string[], aliases: string[]) {
  for (const alias of aliases) {
    const exact = names.find((name) => name === alias || name.endsWith(`|${alias}`));
    if (exact) return exact;
  }
  for (const alias of aliases) {
    const fuzzy = names.find((name) => name.toLowerCase().includes(alias.toLowerCase()));
    if (fuzzy) return fuzzy;
  }
  return names[0] ?? null;
}

export const CLIPS: Record<string, string[]> = {
  idle: ['Idle'],
  idleAlt: ['Idle_2'],
  sad: ['Idle_2_HeadLow'],
  sleep: ['Death'],
  lie: ['Death'],
  eat: ['Eating', 'Eat'],
  walk: ['Walk', 'Walking'],
  trot: ['Gallop'],
  pet: ['Gallop_Jump', 'Jump'],
  recover: ['Jump_ToIdle'],
};

export function clipForReaction(reaction: PortraitReaction, sad: boolean, asleep: boolean) {
  if (asleep || reaction === 'sleep') return 'idle';
  if (reaction === 'pet') return 'pet';
  if (reaction === 'feed') return 'eat';
  if (reaction === 'walk') return 'walk';
  if (sad) return 'sad';
  return 'idle';
}

export type Figure = {
  body: number;
  length: number;
  head: number;
  ear: number;
  leg: number;
  paw: number;
  timeScale: number;
};

export function figureFromGenome(genome: DogGenome, stage: LifeStage): Figure {
  const extras = extrasFromGenome(genome);
  const build = {
    tiny: { body: 0.86, length: 0.9, leg: 0.84 },
    lean: { body: 0.92, length: 1.12, leg: 1.16 },
    stocky: { body: 1.08, length: 0.92, leg: 0.86 },
    long: { body: 0.96, length: 1.18, leg: 1.08 },
  }[genome.build];
  const life = {
    puppy: { body: 0.68, head: 1.72, ear: 1.28, leg: 0.68, paw: 1.68, timeScale: 1.12 },
    young: { body: 0.88, head: 1.1, ear: 1.02, leg: 1.2, paw: 1.02, timeScale: 1.04 },
    adult: { body: 1, head: 1, ear: 1, leg: 1, paw: 1, timeScale: 1 },
    senior: { body: 1.02, head: 0.98, ear: 0.96, leg: 0.88, paw: 1.04, timeScale: 0.72 },
  }[stage];
  const ear = genome.earShape === 'prick' ? 1.12 : genome.earShape === 'flop' ? 0.92 + genome.earFloppy * 0.2 : 0.88;
  return {
    body: build.body * life.body * (extras.fur === 'fluffy' ? 1.04 : 1),
    length: build.length,
    head: life.head * (genome.snout === 'short' ? 1.08 : genome.snout === 'long' ? 0.96 : 1),
    ear: life.ear * ear,
    leg: build.leg * life.leg,
    paw: life.paw,
    timeScale: life.timeScale,
  };
}

function isMesh(node: Object3D): node is Object3D & {
  material: { clone: () => { color: { set: (hex: string) => void }; roughness: number; metalness: number; name?: string } };
  geometry: unknown;
  castShadow: boolean;
  receiveShadow: boolean;
} {
  return (node as { isMesh?: boolean }).isMesh === true;
}

function isBone(node: Object3D): node is Object3D & { isBone: true } {
  return (node as { isBone?: boolean }).isBone === true;
}

export function applyDogLook(root: Object3D, genome: DogGenome, stage: LifeStage, opts: { asleep?: boolean } = {}) {
  const colors = palette(genome);
  const extras = extrasFromGenome(genome);
  const figure = figureFromGenome(genome, stage);
  root.traverse((node) => {
    if (isMesh(node)) {
      node.castShadow = true;
      node.receiveShadow = true;
      const src = Array.isArray(node.material) ? node.material[0] : node.material;
      if (!src || !src.color) return;
      const mat = src.clone();
      const label = `${src.name || ''} ${node.name}`.toLowerCase();
      if (label.includes('eye') || label.includes('pupil')) {
        if (opts.asleep) mat.color.set('#1a1410');
        else if (label.includes('pupil') || label.includes('black')) mat.color.set(colors.eye);
      } else if (label.includes('black') || label.includes('006')) {
        mat.color.set(colors.nose);
      } else if (label.includes('light') || label.includes('001')) {
        mat.color.set(stage === 'senior' ? colors.grey : colors.belly);
      } else if (label.includes('main') || label.includes('material') || label.includes('shibainu_1') || label.includes('cube_1')) {
        mat.color.set(colors.body);
      }
      mat.roughness = extras.fur === 'fluffy' ? 0.86 : 0.55;
      mat.metalness = 0.02;
      node.material = mat;
    }
    if (isBone(node)) {
      if (node.name === 'Head') node.scale.setScalar(figure.head);
      if (node.name.startsWith('Ear')) node.scale.setScalar(figure.ear);
      if (node.name.includes('UpperLeg')) node.scale.set(1, figure.leg, 1);
      if (node.name.includes('LowerLeg') || node.name.startsWith('FF') || node.name.startsWith('IK')) {
        node.scale.set(figure.paw, figure.leg * (node.name.includes('Lower') ? 0.92 : 1), figure.paw);
      }
    }
  });
  return { colors, extras, figure };
}

export function applyMoodBones(
  root: Object3D,
  opts: { sad?: boolean; asleep?: boolean; lookX?: number; lookY?: number; eat?: boolean; wag?: number },
) {
  const head = findBone(root, 'Head');
  const neck = findBone(root, 'Neck2');
  const neck1 = findBone(root, 'Neck1');
  const tail = ['Tail1', 'Tail2', 'Tail3', 'Tail4'].map((name) => findBone(root, name));
  if (opts.asleep) {
    if (head) head.rotation.x += 0.08;
    tail.forEach((bone) => {
      if (bone) bone.rotation.z -= 0.12;
    });
    return;
  }
  if (opts.sad) {
    if (head) head.rotation.x += 0.62;
    if (neck) neck.rotation.x += 0.34;
    if (neck1) neck1.rotation.x += 0.22;
    tail.forEach((bone, i) => {
      if (bone) {
        bone.rotation.x -= 0.48 - i * 0.05;
        bone.rotation.z -= 0.12;
      }
    });
  }
  if (head && opts.lookX) head.rotation.y += opts.lookX * 0.45;
  if (head && opts.lookY) head.rotation.x += opts.lookY * 0.28;
  if (neck && opts.lookX) neck.rotation.y += opts.lookX * 0.22;
  if (opts.eat && neck1) neck1.rotation.x += 0.32;
  if (opts.wag) {
    const wag = opts.wag;
    tail.forEach((bone, i) => {
      if (!bone) return;
      bone.rotation.z += Math.sin(wag + i * 0.45) * 0.32 * (1 - i * 0.12);
    });
  }
}

export function findBone(root: Object3D, name: string): Object3D | null {
  let found: Object3D | undefined;
  root.traverse((node) => {
    if (!found && node.name === name) found = node;
  });
  return found ?? null;
}

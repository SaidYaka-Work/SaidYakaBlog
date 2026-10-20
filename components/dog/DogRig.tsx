'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { AnimationMixer, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import type { AnimationAction, Group, Object3D } from 'three';
import { generateGenome, type DogGenome, type LifeStage } from '@/lib/dog';
import { wagMs, type PortraitReaction } from './look';
import { THREE_QUARTER_YAW } from './frame';
import {
  applyDogLook,
  applyMoodBones,
  breedFromGenome,
  clipForReaction,
  clipName,
  CLIPS,
  findBone,
  figureFromGenome,
  modelUrl,
} from './model';

useGLTF.preload('/dog/ShibaInu.glb');
useGLTF.preload('/dog/Husky.glb');

type Wander = { mode: 'idle' | 'look' | 'turn' | 'step'; t: number; next: number; yaw: number; x: number; z: number; look: number };

const DogRig = forwardRef<Group, {
  genome?: DogGenome | null;
  stage: LifeStage;
  reaction: PortraitReaction;
  asleep: boolean;
  sad?: boolean;
  happiness?: number;
  look?: { x: number; y: number };
  reduced?: boolean;
  interactive?: boolean;
}>(function DogRig(
  {
    genome,
    stage,
    reaction,
    asleep,
    sad = false,
    happiness = 70,
    look = { x: 0, y: 0 },
    reduced = false,
    interactive = false,
  },
  ref,
) {
  const genes = useMemo(() => genome ?? generateGenome('napping-biscuit'), [genome]);
  const breed = breedFromGenome(genes);
  const url = modelUrl(breed);
  const gltf = useGLTF(url);
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const figure = figureFromGenome(genes, stage);
  const group = useRef<Group>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const current = useRef<string>('');
  const actions = useRef<Record<string, AnimationAction>>({});
  const lookRef = useRef(look);
  lookRef.current = look;
  const wander = useRef<Wander>({ mode: 'idle', t: 0, next: 3.5, yaw: THREE_QUARTER_YAW, x: 0, z: 0, look: 0 });
  useImperativeHandle(ref, () => group.current as Group, []);

  useEffect(() => {
    const colors = applyDogLook(scene, genes, stage, { asleep }).colors;
    const neck = findBone(scene, 'Neck1');
    if (neck && !neck.getObjectByName('Collar')) {
      const collar = new Mesh(new TorusGeometry(0.16, 0.03, 8, 18), new MeshStandardMaterial({ color: colors.accessory, roughness: 0.45 }));
      collar.name = 'Collar';
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.02;
      neck.add(collar);
    }
    const mixer = new AnimationMixer(scene);
    mixerRef.current = mixer;
    current.current = '';
    actions.current = {};
    const names = gltf.animations.map((clip) => clip.name);
    for (const [key, aliases] of Object.entries(CLIPS)) {
      const name = clipName(names, aliases);
      const clip = gltf.animations.find((item) => item.name === name);
      if (clip) actions.current[key] = mixer.clipAction(clip);
    }
    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [asleep, genes, gltf.animations, scene, stage]);

  const play = useCallback((key: string, once = false) => {
    const mixer = mixerRef.current;
    const next = actions.current[key] ?? actions.current.idle;
    const prev = actions.current[current.current];
    if (!mixer || !next || current.current === key) return;
    prev?.fadeOut(0.24);
    next.reset();
    next.setEffectiveTimeScale(figure.timeScale * (sad ? 0.7 : key === 'walk' ? 1.05 : 1));
    if (once || key === 'pet' || key === 'sleep' || key === 'lie') {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(LoopRepeat, Infinity);
    }
    next.fadeIn(0.24).play();
    current.current = key;
  }, [figure.timeScale, sad]);

  useEffect(() => {
    const key = clipForReaction(reaction, sad, asleep);
    play(key, key === 'pet' || key === 'sleep');
    if (key === 'pet') {
      const mixer = mixerRef.current;
      if (!mixer) return;
      const onDone = () => {
        mixer.removeEventListener('finished', onDone);
        play('recover', true);
      };
      mixer.addEventListener('finished', onDone);
      return () => mixer.removeEventListener('finished', onDone);
    }
  }, [asleep, play, reaction, sad]);

  useFrame((_, dt) => {
    const mixer = mixerRef.current;
    if (mixer && !reduced) mixer.update(dt);
    const node = group.current;
    if (!node) return;
    const idle = reaction === 'idle' && !asleep && !sad && !reduced;
    const walking = reaction === 'walk';
    const w = wander.current;

    if (walking) {
      const t = performance.now() / 1000;
      w.x = Math.sin(t * 0.85) * 0.55;
      w.z = Math.cos(t * 0.85) * 0.4;
      w.yaw = THREE_QUARTER_YAW + t * 0.85 + Math.PI / 2;
    } else if (asleep || sad || reaction !== 'idle') {
      w.x += (0 - w.x) * 0.08;
      w.z += (0 - w.z) * 0.08;
      w.yaw += (THREE_QUARTER_YAW - w.yaw) * 0.08;
      w.look = 0;
      w.mode = 'idle';
    } else if (idle && interactive) {
      w.t += dt;
      if (w.mode === 'idle' && w.t > w.next) {
        const pick = Math.random();
        w.mode = pick < 0.35 ? 'look' : pick < 0.65 ? 'turn' : 'step';
        w.t = 0;
        if (w.mode === 'step') play('walk');
      }
      if (w.mode === 'look') {
        w.look = Math.sin(w.t * 2.2) * 0.7;
        if (w.t > 1.6) {
          w.mode = 'idle';
          w.t = 0;
          w.next = 3 + Math.random() * 3;
          w.look = 0;
        }
      } else if (w.mode === 'turn') {
        w.yaw = THREE_QUARTER_YAW + Math.sin(w.t * 1.4) * 0.55;
        if (w.t > 1.8) {
          w.mode = 'idle';
          w.t = 0;
          w.next = 3 + Math.random() * 3;
          w.yaw = THREE_QUARTER_YAW;
        }
      } else if (w.mode === 'step') {
        w.x += Math.sin(w.yaw) * dt * 0.55;
        w.z += Math.cos(w.yaw) * dt * 0.55;
        const reach = Math.hypot(w.x, w.z);
        if (reach > 0.7) {
          w.x *= 0.7 / reach;
          w.z *= 0.7 / reach;
        }
        if (w.t > 1.5) {
          play('idle');
          w.mode = 'idle';
          w.t = 0;
          w.next = 4 + Math.random() * 3;
        }
      }
    }

    node.position.set(w.x, asleep ? 0.02 : 0, w.z);
    node.rotation.y = w.yaw;
    node.scale.set(figure.body, figure.body, figure.body * figure.length);

    const wag = asleep || sad ? 0 : (performance.now() / 1000) * (1000 / Math.max(180, wagMs(happiness, asleep, sad))) * Math.PI * 2;
    applyMoodBones(scene, {
      sad,
      asleep,
      lookX: lookRef.current.x + w.look,
      lookY: lookRef.current.y,
      eat: reaction === 'feed',
      wag,
    });
  });

  return (
    <group ref={group} rotation={[0, THREE_QUARTER_YAW, 0]}>
      <primitive object={scene as Object3D} />
    </group>
  );
});

DogRig.displayName = 'DogRig';
export default DogRig;

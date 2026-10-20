'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { AnimationMixer, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import type { AnimationAction, Group, Object3D } from 'three';
import { generateGenome, type DogGenome, type LifeStage } from '@/lib/dog';
import { wagMs, type PortraitReaction } from './look';
import {
  applyDogLook,
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

export default function DogRig({
  genome,
  stage,
  reaction,
  asleep,
  sad = false,
  happiness = 70,
  look = { x: 0, y: 0 },
  reduced = false,
}: {
  genome?: DogGenome | null;
  stage: LifeStage;
  reaction: PortraitReaction;
  asleep: boolean;
  sad?: boolean;
  happiness?: number;
  look?: { x: number; y: number };
  reduced?: boolean;
}) {
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

  useEffect(() => {
    const colors = applyDogLook(scene, genes, stage).colors;
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
  }, [genes, gltf.animations, scene, stage]);

  useEffect(() => {
    const key = clipForReaction(reaction, sad, asleep);
    const mixer = mixerRef.current;
    const next = actions.current[key] ?? actions.current.idle;
    const prev = actions.current[current.current];
    if (!mixer || !next || current.current === key) return;
    prev?.fadeOut(0.28);
    next.reset();
    next.setEffectiveTimeScale(figure.timeScale * (sad ? 0.7 : 1));
    if (key === 'pet') {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(LoopRepeat, Infinity);
    }
    next.fadeIn(0.28).play();
    current.current = key;
    if (key === 'pet') {
      const recover = actions.current.recover;
      const onDone = () => {
        mixer.removeEventListener('finished', onDone);
        recover?.reset().fadeIn(0.2).setLoop(LoopOnce, 1).play();
      };
      mixer.addEventListener('finished', onDone);
      return () => mixer.removeEventListener('finished', onDone);
    }
  }, [asleep, figure.timeScale, reaction, sad]);

  useFrame((_, dt) => {
    const mixer = mixerRef.current;
    if (mixer && !reduced) mixer.update(dt);
    const wagSpeed = 1000 / Math.max(160, wagMs(happiness, asleep, sad));
    const amp = asleep || reduced ? 0.05 : sad ? 0.12 : 0.38;
    const t = performance.now() / 1000;
    const tail = ['Tail1', 'Tail2', 'Tail3', 'Tail4'].map((name) => findBone(scene, name));
    tail.forEach((bone, i) => {
      if (!bone) return;
      bone.rotation.z += Math.sin(t * wagSpeed * Math.PI * 2 + i * 0.45) * amp * (1 - i * 0.12);
    });
    const gaze = lookRef.current;
    const head = findBone(scene, 'Head');
    const neck = findBone(scene, 'Neck2');
    if (head && !asleep) {
      head.rotation.y += gaze.x * 0.45;
      head.rotation.x += gaze.y * 0.28 + (sad ? 0.18 : 0);
    }
    if (neck && !asleep) neck.rotation.y += gaze.x * 0.22;
    if (reaction === 'feed') {
      const neck1 = findBone(scene, 'Neck1');
      if (neck1) neck1.rotation.x += 0.35;
    }
  });

  return (
    <group
      ref={group}
      scale={[figure.body, figure.body, figure.body * figure.length]}
      position={[0, 0, 0]}
      rotation={[0, 0.55, 0]}
    >
      <primitive object={scene as Object3D} />
    </group>
  );
}

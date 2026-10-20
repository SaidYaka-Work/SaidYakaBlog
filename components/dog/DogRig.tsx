'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { AnimationMixer, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import type { AnimationAction, Group, Object3D } from 'three';
import { generateGenome, type DogGenome, type LifeStage } from '@/lib/dog';
import { wagMs, type PortraitReaction } from './look';
import type { DogGait, DogPose } from '@/lib/dog';
import { applyDrive as stepDrive, createYard } from '../../workers/dog/src/room';
import { EAT_STAND, EAT_YAW, SLEEP_ROLL, SLEEP_YAW, THREE_QUARTER_YAW, groundToFloor } from './frame';
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

export type DriveControl = {
  input: { ax: number; az: number; run: boolean };
  server: DogPose | null;
  youHold: boolean;
  localOnly: boolean;
  onPose?: (pose: DogPose) => void;
};

function clipForGait(gait: DogGait, sad: boolean, asleep: boolean) {
  if (asleep || gait === 'lie') return 'lie';
  if (gait === 'eat') return 'eat';
  if (gait === 'run') return 'trot';
  if (gait === 'walk') return 'walk';
  if (gait === 'sit') return 'idleAlt';
  if (gait === 'sniff' || sad) return 'sad';
  return 'idle';
}

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
  drive?: DriveControl | null;
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
    drive = null,
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
  const localYard = useRef(createYard(Date.now()));
  const driveRef = useRef(drive);
  driveRef.current = drive;
  useImperativeHandle(ref, () => group.current as Group);

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
    if (once || key === 'pet' || key === 'lie') {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(LoopRepeat, Infinity);
    }
    next.fadeIn(0.24).play();
    current.current = key;
  }, [figure.timeScale, sad]);

  useEffect(() => {
    if (driveRef.current && (driveRef.current.localOnly || driveRef.current.server)) return;
    const key = clipForReaction(reaction, sad, asleep);
    play(key, key === 'pet');
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
    const control = driveRef.current;
    const driving = Boolean(control && (control.localOnly || control.server || control.youHold));
    const eating = !driving && reaction === 'feed';
    const walking = !driving && reaction === 'walk';
    const eatAction = actions.current.eat;
    const w = wander.current;

    if (driving && control) {
      const now = Date.now();
      if (control.server && Math.hypot(localYard.current.pose.x - control.server.x, localYard.current.pose.z - control.server.z) > 2.4) {
        localYard.current.pose.x = control.server.x;
        localYard.current.pose.z = control.server.z;
        localYard.current.pose.yaw = control.server.yaw;
      }
      if (control.youHold || control.localOnly) {
        localYard.current = stepDrive(localYard.current, control.input.ax, control.input.az, control.input.run, dt, now);
        if (control.server) {
          const drift = Math.hypot(localYard.current.pose.x - control.server.x, localYard.current.pose.z - control.server.z);
          if (drift > 0.55) {
            localYard.current.pose.x += (control.server.x - localYard.current.pose.x) * 0.18;
            localYard.current.pose.z += (control.server.z - localYard.current.pose.z) * 0.18;
            localYard.current.pose.yaw = control.server.yaw;
          }
        }
        w.x = localYard.current.pose.x;
        w.z = localYard.current.pose.z;
        w.yaw = localYard.current.pose.yaw;
        const gait = control.server?.gait === 'eat' ? 'eat' : localYard.current.pose.gait;
        play(clipForGait(gait, sad, asleep && gait !== 'walk' && gait !== 'run'));
        control.onPose?.({ x: w.x, z: w.z, yaw: w.yaw, gait });
      } else if (control.server) {
        w.x += (control.server.x - w.x) * Math.min(1, 8 * dt);
        w.z += (control.server.z - w.z) * Math.min(1, 8 * dt);
        let diff = control.server.yaw - w.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        w.yaw += diff * Math.min(1, 8 * dt);
        play(clipForGait(control.server.gait, sad, asleep && control.server.gait === 'lie'));
        control.onPose?.(control.server);
      }
    }

    if (eating && eatAction && !driving) {
      const duration = eatAction.getClip().duration;
      eatAction.time = duration * 0.48;
      eatAction.paused = true;
    } else if (mixer && !reduced && !(asleep && !driving)) {
      mixer.update(dt);
    }
    const node = group.current;
    if (!node) return;
    const idle = !driving && reaction === 'idle' && !asleep && !sad && !reduced;
    const homeYaw = asleep ? SLEEP_YAW : eating ? EAT_YAW : THREE_QUARTER_YAW;

    if (!driving && walking) {
      const t = performance.now() / 1000;
      w.x = Math.sin(t * 0.7) * 0.32;
      w.z = Math.cos(t * 0.7) * 0.22;
      w.yaw = THREE_QUARTER_YAW + t * 0.7 + Math.PI / 2;
    } else if (!driving && (eating || asleep)) {
      if (eating) {
        w.x += (EAT_STAND.x - w.x) * 0.18;
        w.z += (EAT_STAND.z - w.z) * 0.18;
        w.yaw = EAT_YAW;
      } else {
        w.x += (0 - w.x) * 0.18;
        w.z += (0 - w.z) * 0.18;
        w.yaw = homeYaw;
      }
      w.look = 0;
      w.mode = 'idle';
    } else if (!driving && (sad || reaction !== 'idle')) {
      w.x += (0 - w.x) * 0.1;
      w.z += (0 - w.z) * 0.1;
      w.yaw += (THREE_QUARTER_YAW - w.yaw) * 0.12;
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
        w.x += Math.sin(w.yaw) * dt * 0.45;
        w.z += Math.cos(w.yaw) * dt * 0.45;
        const reach = Math.hypot(w.x, w.z);
        if (reach > 0.55) {
          w.x *= 0.55 / reach;
          w.z *= 0.55 / reach;
        }
        if (w.t > 1.5) {
          play('idle');
          w.mode = 'idle';
          w.t = 0;
          w.next = 4 + Math.random() * 3;
        }
      }
    }

    const lieDown = (asleep && !driving) || (driving && (localYard.current.pose.gait === 'lie' || control?.server?.gait === 'lie'));
    const breathe = lieDown && !reduced ? Math.sin((performance.now() / 1000) * 1.7) * 0.03 : 0;
    node.position.set(w.x, 0, w.z);
    node.rotation.set(0, w.yaw, lieDown ? SLEEP_ROLL : 0);
    node.scale.set(figure.body * (1 + breathe), figure.body, figure.body * figure.length);

    const wag = asleep || sad || lieDown ? 0 : (performance.now() / 1000) * (1000 / Math.max(180, wagMs(happiness, asleep, sad))) * Math.PI * 2;
    applyMoodBones(scene, {
      sad: sad || control?.server?.gait === 'sniff',
      asleep: lieDown,
      lookX: lookRef.current.x + w.look,
      lookY: lookRef.current.y,
      eat: eating || control?.server?.gait === 'eat' || localYard.current.pose.gait === 'eat',
      wag,
    });
    scene.traverse((child) => {
      const skinned = child as { isSkinnedMesh?: boolean; skeleton?: { update: () => void } };
      if (skinned.isSkinnedMesh) skinned.skeleton?.update();
    });
    groundToFloor(node, 0.012);
  });

  return (
    <group ref={group} rotation={[0, THREE_QUARTER_YAW, 0]}>
      <primitive object={scene as Object3D} />
    </group>
  );
});

DogRig.displayName = 'DogRig';
export default DogRig;

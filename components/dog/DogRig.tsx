'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { AnimationMixer, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial, TorusGeometry, Vector3 } from 'three';
import type { AnimationAction, Group, Object3D } from 'three';
import { generateGenome, type DogGenome, type LifeStage } from '@/lib/dog';
import { wagMs, type PortraitReaction } from './look';
import type { DogGait, DogPose } from '@/lib/dog';
import { applyDrive as stepDrive, createYard, tickYardAi } from '../../workers/dog/src/room';
import { applyWorldDrive, tickWorldAi, type FootprintGrid, type Ring } from '../../workers/dog/src/world';
import { frameMark } from './world/frameMark';
import { EAT_STAND, EAT_YAW, SLEEP_YAW, THREE_QUARTER_YAW, YARD_BODY } from './frame';
import {
  CLIP_BLEND,
  computeFootOffset,
  hopHeight,
  plantOnFloor,
  pushSample,
  pushTrail,
  reconcileDriver,
  sampleBuffer,
  strideTimeScale,
  stripRootMotion,
  type PoseSample,
  type TrailPoint,
} from './motion';
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
  serverRef?: { current: DogPose | null };
  youHold: boolean;
  localOnly: boolean;
  onPose?: (pose: DogPose) => void;
  realm?: 'home' | 'world';
  originKey?: string;
  buildings?: Ring[] | FootprintGrid;
  roads?: Ring[] | FootprintGrid;
  parks?: Ring[];
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
  roomy?: boolean;
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
    roomy = false,
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
  const footOffset = useRef<number | null>(null);
  const remoteBuf = useRef<PoseSample[]>([]);
  const hopAt = useRef(0);
  const lastStick = useRef(0);
  const trail = useRef<TrailPoint[]>([]);
  const lastOnPose = useRef(0);
  const originKey = useRef(drive?.originKey || '');
  useImperativeHandle(ref, () => group.current as Group);

  useEffect(() => {
    const colors = applyDogLook(scene, genes, stage, { asleep }).colors;
    const neck = findBone(scene, 'Neck1');
    if (neck && !roomy && !neck.getObjectByName('Collar')) {
      const collar = new Mesh(new TorusGeometry(0.16, 0.03, 8, 18), new MeshStandardMaterial({ color: colors.accessory, roughness: 0.45 }));
      collar.name = 'Collar';
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.02;
      neck.updateWorldMatrix(true, false);
      const boneScale = new Vector3();
      neck.getWorldScale(boneScale);
      const compensate = 1 / Math.max(0.08, (boneScale.x + boneScale.y + boneScale.z) / 3);
      if (Number.isFinite(compensate) && compensate < 8) collar.scale.setScalar(compensate);
      neck.add(collar);
    }
    const mixer = new AnimationMixer(scene);
    mixerRef.current = mixer;
    current.current = '';
    actions.current = {};
    footOffset.current = null;
    const names = gltf.animations.map((clip) => clip.name);
    for (const [key, aliases] of Object.entries(CLIPS)) {
      const name = clipName(names, aliases);
      const clip = gltf.animations.find((item) => item.name === name);
      if (clip) {
        stripRootMotion(clip);
        actions.current[key] = mixer.clipAction(clip);
      }
    }
    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [asleep, genes, gltf.animations, roomy, scene, stage]);

  const play = useCallback((key: string, once = false) => {
    const mixer = mixerRef.current;
    const next = actions.current[key] ?? actions.current.idle;
    const prev = actions.current[current.current];
    if (!mixer || !next || current.current === key) return;
    prev?.fadeOut(CLIP_BLEND);
    next.reset();
    next.setEffectiveTimeScale(figure.timeScale * (sad ? 0.7 : 1));
    if (once || key === 'lie') {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(LoopRepeat, Infinity);
    }
    next.fadeIn(CLIP_BLEND).play();
    current.current = key;
  }, [figure.timeScale, sad]);

  useEffect(() => {
    if (driveRef.current && (driveRef.current.localOnly || driveRef.current.server)) return;
    const key = clipForReaction(reaction, sad, asleep);
    play(key, key === 'pet');
    if (key === 'pet') hopAt.current = performance.now();
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
      const server = control.serverRef?.current ?? control.server;
      if (control.youHold || control.localOnly) {
        if (control.originKey && control.originKey !== originKey.current) {
          originKey.current = control.originKey;
          trail.current.length = 0;
          if (server) {
            localYard.current.pose.x = server.x;
            localYard.current.pose.z = server.z;
            localYard.current.pose.yaw = server.yaw;
          } else {
            localYard.current.pose.x = 0;
            localYard.current.pose.z = 0;
          }
        }
        const stick = Math.hypot(control.input.ax, control.input.az);
        if (stick >= 0.12) lastStick.current = now;
        const wanderAlone = control.localOnly && stick < 0.12 && now - lastStick.current > 700;
        if (control.realm === 'world') {
          const driveStart = performance.now();
          localYard.current = wanderAlone
            ? tickWorldAi(localYard.current, now, dt, {
                buildings: Array.isArray(control.buildings) ? control.buildings : undefined,
                roads: Array.isArray(control.roads) ? control.roads : undefined,
                parks: control.parks,
              })
            : applyWorldDrive(
                localYard.current,
                control.input.ax,
                control.input.az,
                control.input.run,
                dt,
                now,
                null,
                control.buildings ?? [],
                control.roads ?? [],
                control.parks ?? [],
              );
          frameMark.drive = performance.now() - driveStart;
        } else {
          localYard.current = wanderAlone
            ? tickYardAi(localYard.current, now, dt)
            : stepDrive(localYard.current, control.input.ax, control.input.az, control.input.run, dt, now);
        }
        pushTrail(trail.current, now, localYard.current.pose.x, localYard.current.pose.z);
        const mixed = reconcileDriver(localYard.current.pose, server, control.localOnly ? undefined : trail.current);
        localYard.current.pose.x = mixed.x;
        localYard.current.pose.z = mixed.z;
        localYard.current.pose.yaw = mixed.yaw;
        w.x = localYard.current.pose.x;
        w.z = localYard.current.pose.z;
        w.yaw = localYard.current.pose.yaw;
        const gait = server?.gait === 'eat' ? 'eat' : localYard.current.pose.gait;
        const clip = clipForGait(gait, sad, asleep && gait !== 'walk' && gait !== 'run');
        play(clip);
        const action = actions.current[clip];
        const speed = Math.hypot(localYard.current.pose.vx, localYard.current.pose.vz);
        action?.setEffectiveTimeScale(strideTimeScale(clip, speed, figure.timeScale * (sad ? 0.7 : 1)));
        if (now - lastOnPose.current >= 80) {
          lastOnPose.current = now;
          control.onPose?.({ x: w.x, z: w.z, yaw: w.yaw, gait });
        }
      } else if (server) {
        const last = remoteBuf.current[remoteBuf.current.length - 1];
        if (!last || last.at !== now) pushSample(remoteBuf.current, { at: now, ...server });
        const sampled = sampleBuffer(remoteBuf.current, now);
        if (sampled) {
          w.x = sampled.x;
          w.z = sampled.z;
          w.yaw = sampled.yaw;
          const clip = clipForGait(sampled.gait, sad, asleep && sampled.gait === 'lie');
          play(clip);
          const prev = remoteBuf.current[remoteBuf.current.length - 2];
          const last = remoteBuf.current[remoteBuf.current.length - 1];
          const span = prev && last ? Math.max(0.04, (last.at - prev.at) / 1000) : 0.08;
          const speed = prev && last ? Math.hypot(last.x - prev.x, last.z - prev.z) / span : 0;
          actions.current[clip]?.setEffectiveTimeScale(strideTimeScale(clip, speed, figure.timeScale * (sad ? 0.7 : 1)));
        }
        if (now - lastOnPose.current >= 80) {
          lastOnPose.current = now;
          control.onPose?.(server);
        }
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

    const liveServer = control?.serverRef?.current ?? control?.server;
    const lieDown = (asleep && !driving) || (driving && (localYard.current.pose.gait === 'lie' || liveServer?.gait === 'lie'));
    const yard = roomy ? YARD_BODY[stage] ?? 1 : 1;
    const hop = reaction === 'pet' && !driving ? hopHeight(hopAt.current, performance.now()) : 0;
    node.position.set(w.x, 0, w.z);
    node.rotation.set(0, w.yaw, 0);
    node.scale.set(figure.body * yard, figure.body * yard, figure.body * yard * figure.length);

    const wag = asleep || sad || lieDown ? 0 : (performance.now() / 1000) * (1000 / Math.max(180, wagMs(happiness, asleep, sad))) * Math.PI * 2;
    applyMoodBones(scene, {
      sad: sad || liveServer?.gait === 'sniff',
      asleep: lieDown,
      lookX: lookRef.current.x + w.look,
      lookY: lookRef.current.y,
      eat: eating || liveServer?.gait === 'eat' || localYard.current.pose.gait === 'eat',
      wag,
    });
    scene.traverse((child) => {
      const skinned = child as { isSkinnedMesh?: boolean; skeleton?: { update: () => void } };
      if (skinned.isSkinnedMesh) skinned.skeleton?.update();
    });
    if (footOffset.current === null) {
      node.updateWorldMatrix(true, true);
      const measured = computeFootOffset(node);
      footOffset.current = Math.abs(measured) > 0.12 ? 0 : measured;
    }
    plantOnFloor(node, footOffset.current, hop);
  });

  return (
    <group ref={group}>
      <primitive object={scene as Object3D} />
    </group>
  );
});

DogRig.displayName = 'DogRig';
export default DogRig;

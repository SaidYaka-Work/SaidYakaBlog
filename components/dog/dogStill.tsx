'use client';

import { useEffect, useState } from 'react';
import {
  AmbientLight,
  AnimationMixer,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';
import type { AnimationClip } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three-stdlib';
import type { DogGenome, LifeStage } from '@/lib/dog';
import { generateGenome } from '@/lib/dog';
import type { PortraitReaction } from './look';
import { CAMERA_YAW, THREE_QUARTER_YAW, clipPreviewTime, frameCamera } from './frame';
import { applyDogLook, applyMoodBones, breedFromGenome, clipForReaction, clipName, CLIPS, figureFromGenome, modelUrl } from './model';

type StillKey = {
  genome?: DogGenome | null;
  stage: LifeStage;
  reaction: PortraitReaction;
  asleep: boolean;
  night: boolean;
  sad?: boolean;
};

const cache = new Map<string, string>();
const loader = new GLTFLoader();
type LoadedGltf = { scene: import('three').Group; animations: AnimationClip[] };
const gltfs = new Map<string, Promise<LoadedGltf>>();

function loadGltf(url: string) {
  let pending = gltfs.get(url);
  if (!pending) {
    pending = loader.loadAsync(url);
    gltfs.set(url, pending);
  }
  return pending;
}

let renderChain: Promise<unknown> = Promise.resolve();

function queueStill<T>(work: () => Promise<T>) {
  const next = renderChain.then(work, work);
  renderChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function keyOf(opts: StillKey) {
  const genes = opts.genome ?? generateGenome('napping-biscuit');
  return [genes.seed, opts.stage, opts.reaction, opts.asleep ? 1 : 0, opts.night ? 1 : 0, opts.sad ? 1 : 0].join(':');
}

let renderer: WebGLRenderer | null = null;

function getRenderer() {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setSize(640, 500, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  return renderer;
}

function addStillPorch(scene: Scene, night: boolean, showBowl: boolean) {
  const ground = new Mesh(new CircleGeometry(4.2, 40), new MeshStandardMaterial({ color: night ? '#2a221c' : '#f0e0cc' }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const mat = new Mesh(new CircleGeometry(1.4, 36), new MeshStandardMaterial({ color: night ? '#8a3a18' : '#c46a3a' }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0.08, 0.012, 0.12);
  scene.add(mat);
  const ring = new Mesh(new RingGeometry(1.05, 1.18, 36), new MeshStandardMaterial({ color: '#e08a5a' }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0.08, 0.016, 0.12);
  scene.add(ring);
  const pot = new Mesh(new CylinderGeometry(0.14, 0.18, 0.28, 10), new MeshStandardMaterial({ color: '#c46a3a' }));
  pot.position.set(-1.7, 0.3, -1.1);
  scene.add(pot);
  const leaf = new Mesh(new SphereGeometry(0.28, 10, 10), new MeshStandardMaterial({ color: '#4a6a48' }));
  leaf.position.set(-1.7, 0.68, -1.1);
  scene.add(leaf);
  if (showBowl) {
    const bowl = new Mesh(new CylinderGeometry(0.18, 0.14, 0.08, 14), new MeshStandardMaterial({ color: '#c46a3a' }));
    bowl.position.set(1.05, 0.06, 0.85);
    scene.add(bowl);
  }
}

export async function renderDogStill(opts: StillKey) {
  const key = keyOf(opts);
  const hit = cache.get(key);
  if (hit) return hit;
  return queueStill(() => renderDogStillNow(opts, key));
}

async function renderDogStillNow(opts: StillKey, key: string) {
  const cached = cache.get(key);
  if (cached) return cached;
  const genes = opts.genome ?? generateGenome('napping-biscuit');
  const gltf = await loadGltf(modelUrl(breedFromGenome(genes)));
  const scene = new Scene();
  const sky = opts.night ? '#1a1612' : '#f3d6bc';
  scene.background = new Color(sky);
  scene.add(new AmbientLight(opts.night ? '#4a3a32' : '#fff4e6', opts.night ? 0.55 : 1.02));
  scene.add(new HemisphereLight(opts.night ? '#7a5a48' : '#e8eef6', opts.night ? '#2a221c' : '#d4b496', opts.night ? 0.7 : 1));
  const keyLight = new DirectionalLight(opts.night ? '#e8a87c' : '#ffe7c4', opts.night ? 0.55 : 1.15);
  keyLight.position.set(4.2, 6, 3);
  scene.add(keyLight);
  addStillPorch(scene, opts.night, opts.reaction === 'feed');
  const dog = SkeletonUtils.clone(gltf.scene);
  applyDogLook(dog, genes, opts.stage, { asleep: opts.asleep || opts.reaction === 'sleep' });
  const figure = figureFromGenome(genes, opts.stage);
  dog.scale.set(figure.body, figure.body, figure.body * figure.length);
  dog.rotation.y = THREE_QUARTER_YAW;
  if (opts.asleep || opts.reaction === 'sleep') {
    dog.rotation.x = 1.2;
    dog.position.y = 0.42;
  }
  scene.add(dog);
  const mixer = new AnimationMixer(dog);
  const names = gltf.animations.map((clip: { name: string }) => clip.name);
  const want = clipForReaction(opts.reaction, Boolean(opts.sad), opts.asleep);
  const clip = gltf.animations.find((item: { name: string }) => item.name === clipName(names, CLIPS[want] ?? CLIPS.idle));
  if (clip) {
    const action = mixer.clipAction(clip);
    action.play();
    mixer.update(clipPreviewTime(want, clip.duration));
  }
  applyMoodBones(dog, {
    sad: Boolean(opts.sad),
    asleep: opts.asleep || opts.reaction === 'sleep',
    eat: opts.reaction === 'feed',
    wag: opts.sad || opts.asleep ? 0 : 1.2,
  });
  if (opts.reaction === 'walk') {
    dog.position.set(0.35, 0, 0.12);
  }
  const camera = new PerspectiveCamera(36, 640 / 500, 0.1, 50);
  if (opts.reaction === 'walk') {
    camera.position.set(Math.sin(CAMERA_YAW) * 3.5, 1.5, Math.cos(CAMERA_YAW) * 4.1);
    camera.lookAt(0, 0.5, 0);
  } else {
    frameCamera(camera, dog, { pad: 1.5, yaw: CAMERA_YAW, pitch: 0.2, aspect: 640 / 500 });
  }
  const gl = getRenderer();
  gl.render(scene, camera);
  const url = gl.domElement.toDataURL('image/jpeg', 0.82);
  cache.set(key, url);
  mixer.stopAllAction();
  return url;
}

export default function DogStill({
  genome,
  stage,
  reaction,
  asleep,
  night,
  sad,
  className,
}: StillKey & { className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    renderDogStill({ genome, stage, reaction, asleep, night, sad })
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [genome, stage, reaction, asleep, night, sad]);

  return src ? (
    // Data-URL stills from the same GLB; next/image is a poor fit here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`biscuit-still ${className ?? ''}`} />
  ) : (
    <div className="biscuit-poster" />
  );
}

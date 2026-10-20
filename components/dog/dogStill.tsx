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
  PlaneGeometry,
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
import { BOWL, CAMERA_YAW, EAT_YAW, SLEEP_ROLL, THREE_QUARTER_YAW, clipPreviewTime, frameCamera, groundToFloor } from './frame';
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
  const ground = new Mesh(new PlaneGeometry(28, 28), new MeshStandardMaterial({ color: night ? '#1c1a18' : '#efe2d0' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);
  const mat = new Mesh(new CircleGeometry(1.32, 36), new MeshStandardMaterial({ color: night ? '#8a3a18' : '#c46a3a' }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0.02, 0.012, 0.08);
  scene.add(mat);
  const ring = new Mesh(new RingGeometry(1, 1.14, 36), new MeshStandardMaterial({ color: '#e08a5a' }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0.02, 0.016, 0.08);
  scene.add(ring);
  const pot = new Mesh(new CylinderGeometry(0.14, 0.18, 0.28, 10), new MeshStandardMaterial({ color: '#c46a3a' }));
  pot.position.set(1.5, 0.28, -0.8);
  scene.add(pot);
  const leaf = new Mesh(new SphereGeometry(0.26, 10, 10), new MeshStandardMaterial({ color: '#4a6a48' }));
  leaf.position.set(1.5, 0.64, -0.8);
  scene.add(leaf);
  if (showBowl) {
    const bowl = new Mesh(new CylinderGeometry(0.18, 0.14, 0.08, 14), new MeshStandardMaterial({ color: '#c46a3a' }));
    bowl.position.set(BOWL.x, BOWL.y, BOWL.z);
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
  const sky = opts.night ? '#0b1220' : '#f4ead8';
  scene.background = new Color(sky);
  scene.add(new AmbientLight(opts.night ? '#4a3a32' : '#fff4e6', opts.night ? 0.55 : 1.02));
  scene.add(new HemisphereLight(opts.night ? '#6a7a98' : '#f4ead8', opts.night ? '#1a1814' : '#d4b496', opts.night ? 0.7 : 1));
  const keyLight = new DirectionalLight(opts.night ? '#c8d4f0' : '#ffe7c4', opts.night ? 0.5 : 1.1);
  keyLight.position.set(4.2, 6, 3);
  scene.add(keyLight);
  addStillPorch(scene, opts.night, opts.reaction === 'feed');
  const dog = SkeletonUtils.clone(gltf.scene);
  applyDogLook(dog, genes, opts.stage, { asleep: opts.asleep || opts.reaction === 'sleep' });
  const figure = figureFromGenome(genes, opts.stage);
  const asleep = opts.asleep || opts.reaction === 'sleep';
  dog.scale.set(figure.body, figure.body, figure.body * figure.length);
  dog.rotation.set(0, opts.reaction === 'feed' ? EAT_YAW : THREE_QUARTER_YAW, asleep ? SLEEP_ROLL : 0);
  if (opts.reaction === 'walk') dog.position.set(0.2, 0, 0.08);
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
    asleep,
    eat: opts.reaction === 'feed',
    wag: opts.sad || asleep ? 0 : 1.2,
  });
  groundToFloor(dog, 0.012);
  const camera = new PerspectiveCamera(36, 640 / 500, 0.1, 80);
  frameCamera(camera, dog, {
    pad: 1.4,
    yaw: CAMERA_YAW,
    pitch: asleep ? 0.4 : 0.2,
    aspect: 640 / 500,
    minDist: asleep ? 3.7 : 3.15,
  });
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

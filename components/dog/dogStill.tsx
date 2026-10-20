'use client';

import { useEffect, useState } from 'react';
import {
  AmbientLight,
  AnimationMixer,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { AnimationClip } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three-stdlib';
import type { DogGenome, LifeStage } from '@/lib/dog';
import { generateGenome } from '@/lib/dog';
import type { PortraitReaction } from './look';
import { applyDogLook, breedFromGenome, clipForReaction, clipName, CLIPS, figureFromGenome, modelUrl } from './model';

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

export async function renderDogStill(opts: StillKey) {
  const key = keyOf(opts);
  const hit = cache.get(key);
  if (hit) return hit;
  const genes = opts.genome ?? generateGenome('napping-biscuit');
  const gltf = await loadGltf(modelUrl(breedFromGenome(genes)));
  const scene = new Scene();
  scene.background = new Color(opts.night ? '#1c1816' : '#f8ead6');
  scene.add(new AmbientLight(opts.night ? '#4a3a32' : '#fff4e6', opts.night ? 0.4 : 0.9));
  const keyLight = new DirectionalLight(opts.night ? '#e8a87c' : '#ffe7c4', opts.night ? 0.35 : 1.1);
  keyLight.position.set(4.2, 6, 3);
  scene.add(keyLight);
  const dog = SkeletonUtils.clone(gltf.scene);
  applyDogLook(dog, genes, opts.stage);
  const figure = figureFromGenome(genes, opts.stage);
  dog.scale.set(figure.body, figure.body, figure.body * figure.length);
  dog.rotation.y = 0.55;
  scene.add(dog);
  const mixer = new AnimationMixer(dog);
  const names = gltf.animations.map((clip: { name: string }) => clip.name);
  const want = clipForReaction(opts.reaction, Boolean(opts.sad), opts.asleep);
  const clip = gltf.animations.find((item: { name: string }) => item.name === clipName(names, CLIPS[want] ?? CLIPS.idle));
  if (clip) {
    const action = mixer.clipAction(clip);
    action.play();
    mixer.update(opts.reaction === 'pet' ? 0.35 : opts.asleep ? 1.2 : 0.45);
  }
  const camera = new PerspectiveCamera(36, 640 / 500, 0.1, 40);
  camera.position.set(3.35, 2.05, 4.15);
  camera.lookAt(0.1, 1.15, 0.2);
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

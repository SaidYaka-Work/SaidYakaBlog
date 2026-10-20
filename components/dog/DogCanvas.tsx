'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import { PerspectiveCamera, Vector3, type Group } from 'three';
import type { DogGenome, LifeStage } from '@/lib/dog';
import type { PortraitReaction } from './look';
import { CAMERA_YAW, frameCamera, projectMeshBounds } from './frame';
import DogRig from './DogRig';
import PorchWorld from './PorchWorld';

function EmptyReady({ onReady }: { onReady?: () => void }) {
  const notified = useRef(false);
  useFrame(() => {
    if (notified.current) return;
    notified.current = true;
    onReady?.();
  });
  return null;
}

function FramedCamera({
  target,
  host,
  compact,
  fill,
  asleep,
  onReady,
}: {
  target: RefObject<Group | null>;
  host: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  fill?: boolean;
  asleep?: boolean;
  onReady?: () => void;
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const from = useRef(new Vector3());
  const ready = useRef(false);

  useFrame((_, dt) => {
    const object = target.current;
    if (!object) return;
    camera.aspect = size.width / Math.max(1, size.height);
    from.current.copy(camera.position);
    const info = frameCamera(camera, object, {
      pad: fill ? 1.38 : compact ? 1.4 : 1.42,
      yaw: CAMERA_YAW,
      pitch: 0.2,
      aspect: camera.aspect,
      lift: 0,
      minDist: asleep ? 4.6 : fill ? 4.1 : 3.8,
    });
    if (!info) return;
    camera.up.set(0, 1, 0);
    camera.lookAt(info.center.x, info.center.y, info.center.z);
    camera.updateProjectionMatrix();
    if (ready.current) {
      camera.position.lerpVectors(from.current, camera.position, 1 - Math.exp(-dt * 4));
      camera.up.set(0, 1, 0);
      camera.lookAt(info.center.x, info.center.y, info.center.z);
      camera.updateProjectionMatrix();
    } else {
      ready.current = true;
      onReady?.();
    }
    const bounds = projectMeshBounds(object, camera);
    if (host.current && bounds) {
      host.current.dataset.inView = bounds.inView ? '1' : '0';
      host.current.dataset.fills = bounds.fills ? '1' : '0';
    }
  });
  return null;
}

export default function DogCanvas({
  genome,
  stage = 'adult',
  reaction,
  asleep,
  night,
  happiness = 70,
  hungry = false,
  sad = false,
  compact = false,
  interactive = false,
  fill = false,
  empty = false,
  onReady,
}: {
  genome?: DogGenome | null;
  stage?: LifeStage;
  reaction: PortraitReaction;
  asleep: boolean;
  night: boolean;
  happiness?: number;
  hungry?: boolean;
  sad?: boolean;
  compact?: boolean;
  interactive?: boolean;
  fill?: boolean;
  empty?: boolean;
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const dogRef = useRef<Group>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const update = () => {
      const box = node.getBoundingClientRect();
      const visible = !document.hidden && box.height > 0;
      const onscreen = box.bottom > 0 && box.top < window.innerHeight;
      setFrameloop(visible && onscreen ? 'always' : 'never');
    };
    update();
    const io = new IntersectionObserver(update, { threshold: 0.05 });
    io.observe(node);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const node = host.current;
    if (!node) return;
    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * 2 - 1;
      const y = ((event.clientY - box.top) / box.height) * 2 - 1;
      setLook({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
    };
    const onLeave = () => setLook({ x: 0, y: 0 });
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, [interactive]);

  return (
    <div
      ref={host}
      data-in-view="0"
      className={`biscuit-scene ${night ? 'is-night' : ''} ${compact ? 'is-compact' : ''} ${fill ? 'is-fill' : ''} is-${reaction}`}
    >
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [2.1, 1.5, 3.6], fov: fill ? 34 : compact ? 36 : 32, near: 0.1, far: 80 }}
        shadows
        frameloop={frameloop}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
      >
        <Suspense fallback={null}>
          <PorchWorld
            night={night}
            showBowl={hungry || reaction === 'feed'}
            compact={compact}
            walking={reaction === 'walk'}
          />
          {!empty && (
            <DogRig
              ref={dogRef}
              genome={genome}
              stage={stage}
              reaction={reaction}
              asleep={asleep}
              sad={sad}
              happiness={happiness}
              look={look}
              reduced={reduced}
              interactive={interactive}
            />
          )}
          {!empty && (
            <FramedCamera
              target={dogRef}
              host={host}
              compact={compact}
              fill={fill}
              asleep={asleep || reaction === 'sleep'}
              onReady={onReady}
            />
          )}
          {empty && <EmptyReady onReady={onReady} />}
        </Suspense>
      </Canvas>
      {!empty && reaction === 'pet' && (
        <span className="biscuit-hearts">
          <i />
          <i />
          <i />
        </span>
      )}
      {!empty && (asleep || reaction === 'sleep') && <span className="biscuit-zzz">Zzz</span>}
    </div>
  );
}

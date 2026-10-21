'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, lazy, useEffect, useRef, useState, type RefObject } from 'react';
import { ACESFilmicToneMapping, PerspectiveCamera, PointLight, SRGBColorSpace, Vector3, type Group, type Mesh } from 'three';
import type { DogCompanion, DogGenome, LifeStage } from '@/lib/dog';
import Companions from './Companions';
import type { PortraitReaction } from './look';
import { CAMERA_YAW, frameCamera, followYardCamera, projectMeshBounds } from './frame';
import DogRig, { type DriveControl } from './DogRig';
import PorchWorld from './PorchWorld';
import type { WorldColliders } from './world/useWorldTiles';

const WorldLayer = lazy(() => import('./world/WorldLayer'));

export type WorldView = {
  originLat: number;
  originLng: number;
  lat: number;
  lng: number;
  flight: number;
  nightHint?: boolean;
};

function FootShadow({ target }: { target: RefObject<Group | null> }) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const dog = target.current;
    const shadow = ref.current;
    if (!dog || !shadow) return;
    shadow.position.set(dog.position.x, 0.012, dog.position.z);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <circleGeometry args={[0.3, 24]} />
      <meshBasicMaterial color="#1c120c" transparent opacity={0.52} depthWrite={false} />
    </mesh>
  );
}

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
  stage,
  world,
  onReady,
  onAnchor,
}: {
  target: RefObject<Group | null>;
  host: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  fill?: boolean;
  asleep?: boolean;
  stage?: LifeStage;
  world?: WorldView | null;
  onReady?: () => void;
  onAnchor?: (pos: { x: number; y: number } | null) => void;
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const from = useRef(new Vector3());
  const look = useRef(new Vector3());
  const ready = useRef(false);

  const street = useRef(new Vector3());
  const lastAnchor = useRef({ x: -1, y: -1 });

  useFrame((_, dt) => {
    const object = target.current;
    if (!object) return;
    camera.aspect = size.width / Math.max(1, size.height);
    from.current.copy(camera.position);
    if (world) {
      const flight = Math.max(0, Math.min(1, world.flight));
      const yaw = object.rotation.y;
      const dist = 14.8 + flight * 170;
      const pitch = 0.5 + flight * 0.7;
      const height = 6.6 + flight * 210;
      street.current.set(
        object.position.x - Math.sin(yaw) * dist * Math.cos(pitch),
        height,
        object.position.z - Math.cos(yaw) * dist * Math.cos(pitch),
      );
      look.current.set(
        object.position.x + Math.sin(yaw) * (2.4 + flight * 6),
        1.15 + flight * 8,
        object.position.z + Math.cos(yaw) * (2.4 + flight * 6),
      );
      camera.near = flight > 0.5 ? 2 : 0.2;
      camera.far = 520;
      camera.up.set(0, 1, 0);
      if (!ready.current) {
        camera.position.copy(street.current);
        camera.lookAt(look.current);
        camera.updateProjectionMatrix();
        ready.current = true;
        onReady?.();
      } else {
        camera.position.lerpVectors(from.current, street.current, 1 - Math.exp(-dt * (flight > 0.08 ? 1.2 : 2)));
        camera.lookAt(look.current);
        camera.updateProjectionMatrix();
      }
    } else if (fill) {
      const info = followYardCamera(camera, object, {
        stage,
        asleep,
        aspect: camera.aspect,
      });
      if (!info) return;
      look.current.set(info.center.x, info.lookY, info.center.z);
      if (ready.current) {
        camera.position.lerpVectors(from.current, info.desired, 1 - Math.exp(-dt * 1.8));
        camera.up.set(0, 1, 0);
        camera.lookAt(look.current);
        camera.updateProjectionMatrix();
      } else {
        ready.current = true;
        onReady?.();
      }
    } else {
      const info = frameCamera(camera, object, {
        pad: compact ? 1.4 : 1.42,
        yaw: CAMERA_YAW,
        pitch: 0.2,
        aspect: camera.aspect,
        lift: 0,
        minDist: asleep ? 4.8 : 3.8,
      });
      if (!info) return;
      camera.up.set(0, 1, 0);
      camera.lookAt(info.center.x, info.center.y, info.center.z);
      camera.updateProjectionMatrix();
      if (ready.current) {
        camera.position.lerpVectors(from.current, camera.position, 1 - Math.exp(-dt * 2.2));
        camera.up.set(0, 1, 0);
        camera.lookAt(info.center.x, info.center.y, info.center.z);
        camera.updateProjectionMatrix();
      } else {
        ready.current = true;
        onReady?.();
      }
    }
    const bounds = projectMeshBounds(object, camera);
    if (host.current && bounds) {
      host.current.dataset.inView = bounds.inView ? '1' : '0';
      host.current.dataset.fills = bounds.fills ? '1' : '0';
      const x = (bounds.minX + bounds.maxX) * 0.5 * 0.5 + 0.5;
      const y = (1 - bounds.maxY) * 0.5;
      if (Math.abs(x - lastAnchor.current.x) > 0.012 || Math.abs(y - lastAnchor.current.y) > 0.012) {
        lastAnchor.current = { x, y };
        onAnchor?.({ x: Math.max(0.08, Math.min(0.92, x)), y: Math.max(0.12, Math.min(0.78, y)) });
      }
    }
  });
  return null;
}

function DogKeyLight({
  target,
  night,
}: {
  target: RefObject<Group | null>;
  night: boolean;
}) {
  const ref = useRef<PointLight>(null);
  useFrame(() => {
    const dog = target.current;
    const light = ref.current;
    if (!dog || !light) return;
    light.position.set(dog.position.x + 0.7, 2.35, dog.position.z + 1.15);
  });
  return (
    <pointLight
      ref={ref}
      color={night ? '#ffe2b4' : '#fff6e4'}
      intensity={night ? 1.55 : 0.22}
      distance={night ? 10 : 5}
      decay={2}
    />
  );
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
  drive = null,
  food = false,
  near = false,
  world = null,
  onWorldColliders,
  onReady,
  onAnchor,
  companions = [],
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
  drive?: DriveControl | null;
  food?: boolean;
  near?: boolean;
  world?: WorldView | null;
  onWorldColliders?: (colliders: WorldColliders) => void;
  onReady?: () => void;
  onAnchor?: (pos: { x: number; y: number } | null) => void;
  companions?: DogCompanion[];
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
        camera={{ position: world ? [0, 6.8, 15] : [3.4, 3.2, 6.4], fov: world ? 44 : fill ? 36 : compact ? 36 : 32, near: 0.1, far: world ? 560 : 80 }}
        shadows
        frameloop={frameloop}
        gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMappingExposure = night ? 1.16 : 0.92;
        }}
      >
        <Suspense fallback={null}>
          {world ? (
            <WorldLayer
              originLat={world.originLat}
              originLng={world.originLng}
              lat={world.lat}
              lng={world.lng}
              night={world.nightHint}
              onColliders={onWorldColliders}
            />
          ) : (
            <PorchWorld
              night={night}
              showBowl={hungry || food || reaction === 'feed'}
              compact={compact}
              walking={reaction === 'walk'}
              food={food || reaction === 'feed'}
              near={near || reaction === 'feed'}
              gate
            />
          )}
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
              drive={drive}
              roomy={fill}
            />
          )}
          {!empty && <Companions guests={companions} night={night} />}
          {!empty && <DogKeyLight target={dogRef} night={night} />}
          {!empty && fill && <FootShadow target={dogRef} />}
          {!empty && (
            <FramedCamera
              target={dogRef}
              host={host}
              compact={compact}
              fill={fill}
              asleep={asleep || reaction === 'sleep'}
              stage={stage}
              world={world}
              onReady={onReady}
              onAnchor={onAnchor}
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

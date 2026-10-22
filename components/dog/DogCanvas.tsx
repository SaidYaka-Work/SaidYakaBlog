'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, lazy, useEffect, useRef, useState, type RefObject } from 'react';
import { ACESFilmicToneMapping, PerspectiveCamera, PointLight, SRGBColorSpace, Vector3, type Group, type Mesh } from 'three';
import type { DogCompanion, DogGenome, LifeStage } from '@/lib/dog';
import Companions from './Companions';
import type { PortraitReaction } from './look';
import { CAMERA_YAW, clampOrbitPitchOffset, frameCamera, followYardCamera, worldOrbitPitch } from './frame';
import { installTimerClock } from './timerClock';
import DogRig, { type DriveControl } from './DogRig';
import WorldBowl from './WorldBowl';
import { asFootprintGrid, footprintClearance, resolveCameraXZ, HOME_PLACE } from '../../workers/dog/src/world';
import type { TileStatus, WorldColliders } from './world/useWorldTiles';
import { camFade, frameMark, liveBuildingGrid, liveHere, renderScale } from './world/frameMark';

const WorldLayer = lazy(() => import('./world/WorldLayer'));

export type WorldView = {
  originLat: number;
  originLng: number;
  lat: number;
  lng: number;
  flight: number;
  nightHint?: boolean;
};

function SizeSync({ host }: { host: RefObject<HTMLDivElement | null> }) {
  const gl = useThree((state) => state.gl);
  const set = useThree((state) => state.set);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const apply = () => {
      const box = node.getBoundingClientRect();
      const width = Math.max(1, box.width);
      const height = Math.max(1, box.height);
      const dpr = Math.min(renderScale.dpr, 1.25, window.devicePixelRatio || 1);
      gl.setPixelRatio(dpr);
      gl.setSize(width, height, false);
      set({ size: { width, height, top: box.top, left: box.left } });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(node);
    return () => ro.disconnect();
  }, [gl, host, set]);
  return null;
}

function PerfProbe() {
  const { gl } = useThree();
  const times = useRef<number[]>([]);
  const born = useRef(performance.now());
  useFrame((_, dt) => {
    const host = window as Window & {
      __DOG_PERF?: {
        fps: number;
        frameMs: number;
        p95: number;
        hitch: number;
        calls: number;
        triangles: number;
        geometries: number;
        textures: number;
        memMB: number;
        samples: number;
        tiles?: number;
        driveMs?: number;
        cameraMs?: number;
        tileMs?: number;
      };
    };
    const ms = dt * 1000;
    const ring = times.current;
    const warmed = performance.now() - born.current > 2800;
    if (warmed) {
      ring.push(ms);
      if (ring.length > 180) ring.shift();
    }
    const sorted = [...ring].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || ms;
    const hitch = ring.reduce((max, value) => Math.max(max, value), 0);
    const info = gl.info;
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const prev = host.__DOG_PERF;
    const fps = dt > 0 ? 1 / dt : 0;
    host.__DOG_PERF = {
      fps: prev ? prev.fps * 0.86 + fps * 0.14 : fps,
      frameMs: ms,
      p95,
      hitch,
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      tiles: prev?.tiles ?? 0,
      driveMs: frameMark.drive,
      cameraMs: frameMark.camera,
      tileMs: frameMark.tiles,
      memMB: mem ? Math.round(mem.usedJSHeapSize / 1e6) : 0,
      samples: (prev?.samples ?? 0) + 1,
    };
    if (ring.length > 40 && p95 > 48 && renderScale.dpr > 1) {
      renderScale.dpr = 1;
      gl.setPixelRatio(1);
    }
  });
  return null;
}

function DebugHud() {
  const [line, setLine] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    const tick = () => {
      const perf = (window as Window & { __DOG_PERF?: { fps: number; p95: number; hitch: number; calls: number; triangles: number; tiles?: number; geometries?: number; textures?: number; driveMs?: number; cameraMs?: number; tileMs?: number } }).__DOG_PERF;
      if (!perf) return;
      const compact =
        Boolean(document.querySelector('.dog-game.is-compact')) ||
        window.innerWidth <= 400 ||
        (window.visualViewport?.width ?? 400) <= 400;
      setLine(
        compact
          ? `${perf.fps.toFixed(0)} fps · p95 ${perf.p95.toFixed(0)}ms · hitch ${perf.hitch.toFixed(0)}ms\n${perf.triangles} tris · ${perf.tiles ?? 0} tiles · ${perf.calls} calls`
          : `${perf.fps.toFixed(0)} fps · p95 ${perf.p95.toFixed(1)}ms · hitch ${perf.hitch.toFixed(0)}ms · ${perf.calls} calls · ${perf.triangles} tris · ${perf.tiles ?? 0} tiles · geo ${perf.geometries ?? 0} · tex ${perf.textures ?? 0} · drv ${(perf.driveMs ?? 0).toFixed(1)} cam ${(perf.cameraMs ?? 0).toFixed(1)} til ${(perf.tileMs ?? 0).toFixed(1)}`,
      );
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);
  if (!line) return null;
  return <div className="dog-debug">{line}</div>;
}

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
  const dir = useRef(new Vector3());

  const street = useRef(new Vector3());
  const lastAnchor = useRef({ x: -1, y: -1 });
  const lastAnchorAt = useRef(0);
  const orbit = useRef({ yaw: 0, pitch: 0 });
  const pulledDist = useRef(14.8);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let down = false;
    let lastX = 0;
    let lastY = 0;
    let pointerId: number | null = null;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const hit = event.target;
      if (hit instanceof Element && hit.closest('.dog-stick, .dog-action, .dog-chip, .dog-travel, .dog-back')) return;
      if (event.pointerType === 'touch') {
        const box = node.getBoundingClientRect();
        if (event.clientX - box.left < 168 && box.bottom - event.clientY < 176) return;
      }
      event.preventDefault();
      down = true;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      node.setPointerCapture(event.pointerId);
      const canvas = node.querySelector('canvas');
      try {
        canvas?.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!down || pointerId !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      orbit.current.yaw -= dx * 0.005;
      orbit.current.pitch = clampOrbitPitchOffset(orbit.current.pitch + dy * 0.0035);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (down) event.preventDefault();
    };
    const onUp = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId !== pointerId) return;
      down = false;
      pointerId = null;
      try {
        node.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };
    node.addEventListener('pointerdown', onDown, { passive: false });
    node.addEventListener('pointermove', onMove, { passive: false });
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.removeEventListener('touchmove', onTouchMove);
    };
  }, [host]);

  useFrame((_, dt) => {
    const object = target.current;
    if (!object) return;
    liveHere.x = object.position.x;
    liveHere.z = object.position.z;
    liveHere.ready = true;
    camera.aspect = size.width / Math.max(1, size.height);
    from.current.copy(camera.position);
    if (world) {
      const flight = Math.max(0, Math.min(1, world.flight));
      const narrow = size.width < 400;
      const yaw = object.rotation.y + orbit.current.yaw;
      const dist = 14.8 + flight * 170;
      const pitch = worldOrbitPitch(orbit.current.pitch, flight);
      const lookY = (narrow ? 2.85 : 1.35) + flight * 8;
      const height = lookY + dist * Math.sin(pitch) + flight * 210;
      look.current.set(
        object.position.x + Math.sin(yaw) * (narrow ? 0.2 : 1.1 + flight * 6),
        lookY,
        object.position.z + Math.cos(yaw) * (narrow ? 0.2 : 1.1 + flight * 6),
      );
      street.current.set(
        object.position.x - Math.sin(yaw) * dist * Math.cos(pitch),
        height,
        object.position.z - Math.cos(yaw) * dist * Math.cos(pitch),
      );
      dir.current.copy(street.current).sub(object.position);
      dir.current.y = 0;
      const span = dir.current.length();
      const camStart = performance.now();
      const grid = asFootprintGrid(liveBuildingGrid.current);
      if (flight < 0.08 && span > 1) {
        const safe = resolveCameraXZ(object.position.x, object.position.z, street.current.x, street.current.z, 0.85, grid);
        const want = Math.hypot(safe.x - object.position.x, safe.z - object.position.z);
        pulledDist.current += (want - pulledDist.current) * Math.min(1, dt * 10);
        const used = Math.min(span, Math.max(0.35, Math.min(want, pulledDist.current)));
        if (dir.current.lengthSq() > 1e-6) dir.current.normalize();
        const minDist = 5.6;
        const extra = Math.max(0, minDist - used);
        street.current.set(
          object.position.x + dir.current.x * used,
          Math.max(height + extra * 1.35, look.current.y + 3.1 + extra * 0.8),
          object.position.z + dir.current.z * used,
        );
        const placed = resolveCameraXZ(object.position.x, object.position.z, street.current.x, street.current.z, 0.55, grid);
        street.current.x = placed.x;
        street.current.z = placed.z;
        const clear = footprintClearance(street.current.x, street.current.z, grid);
        camFade.fade = placed.inside || clear < 0.5 ? 1 : Math.max(0, camFade.fade - dt * 2.4);
      } else {
        camFade.fade = 0;
      }
      camFade.lookX = look.current.x;
      camFade.lookY = look.current.y;
      camFade.lookZ = look.current.z;
      camFade.camX = street.current.x;
      camFade.camY = street.current.y;
      camFade.camZ = street.current.z;
      frameMark.camera = performance.now() - camStart;
      camera.near = flight > 0.5 ? 2 : 0.35;
      camera.far = 180;
      camera.up.set(0, 1, 0);
      if (!ready.current) {
        camera.position.copy(street.current);
        camera.lookAt(look.current);
        camera.updateProjectionMatrix();
        ready.current = true;
        onReady?.();
      } else {
        camera.position.lerpVectors(from.current, street.current, 1 - Math.exp(-dt * (flight > 0.08 ? 1.05 : 2.4)));
        const settled = resolveCameraXZ(object.position.x, object.position.z, camera.position.x, camera.position.z, 0.5, grid);
        camera.position.x = settled.x;
        camera.position.z = settled.z;
        if (settled.inside || settled.clear < 0.5) {
          camFade.fade = 1;
          camera.position.y = Math.max(camera.position.y, look.current.y + 3.4);
        }
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
    const now = performance.now();
    if (now - lastAnchorAt.current > 200) {
      lastAnchorAt.current = now;
      const x = 0.5;
      const y = 0.38;
      if (Math.abs(x - lastAnchor.current.x) > 0.012 || Math.abs(y - lastAnchor.current.y) > 0.012) {
        lastAnchor.current = { x, y };
        onAnchor?.({ x, y });
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
  sad = false,
  compact = false,
  interactive = false,
  fill = false,
  empty = false,
  drive = null,
  food = false,
  near = false,
  bowl = null,
  world = null,
  onWorldColliders,
  onReady,
  onAnchor,
  companions = [],
  youId = null,
  lookAt = { x: 0, z: 0 },
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
  bowl?: { x: number; z: number } | null;
  world?: WorldView | null;
  onWorldColliders?: (colliders: WorldColliders) => void;
  onReady?: () => void;
  onAnchor?: (pos: { x: number; y: number } | null) => void;
  companions?: DogCompanion[];
  youId?: string | null;
  lookAt?: { x: number; z: number };
}) {
  const host = useRef<HTMLDivElement>(null);
  const dogRef = useRef<Group>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');
  const [reduced, setReduced] = useState(false);
  const [tileStatus, setTileStatus] = useState<TileStatus>('loading');

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
        dpr={[1, 1.25]}
        camera={{ position: [0, 6.8, 15], fov: 44, near: 0.1, far: 180 }}
        frameloop={frameloop}
        resize={{ debounce: 0, scroll: false }}
        gl={{
          antialias: typeof window === 'undefined' ? false : window.devicePixelRatio < 1.25,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        onCreated={({ gl, set }) => {
          installTimerClock(set);
          gl.toneMapping = ACESFilmicToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMappingExposure = night ? 1.16 : 0.92;
          const dpr = Math.min(renderScale.dpr, 1.25, window.devicePixelRatio || 1);
          gl.setPixelRatio(dpr);
          const width = Math.max(1, gl.domElement.clientWidth || 1);
          const height = Math.max(1, gl.domElement.clientHeight || 1);
          gl.setSize(width, height, false);
        }}
      >
        <SizeSync host={host} />
        <PerfProbe />
        <Suspense fallback={null}>
          {(() => {
            const view = world ?? {
              originLat: HOME_PLACE.lat,
              originLng: HOME_PLACE.lng,
              lat: HOME_PLACE.lat,
              lng: HOME_PLACE.lng,
              flight: 0,
              nightHint: night,
            };
            return (
              <WorldLayer
                originLat={view.originLat}
                originLng={view.originLng}
                lat={view.lat}
                lng={view.lng}
                night={view.nightHint}
                onColliders={onWorldColliders}
                onStatus={setTileStatus}
              />
            );
          })()}
          <WorldBowl
            x={bowl?.x ?? 1.15}
            z={bowl?.z ?? 0.55}
            night={night}
            food={food || reaction === 'feed'}
            near={near || reaction === 'feed'}
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
              drive={drive}
              roomy={fill}
            />
          )}
          {!empty && <Companions guests={companions} night={night} youId={youId} lookAt={lookAt} />}
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
              world={
                world ?? {
                  originLat: HOME_PLACE.lat,
                  originLng: HOME_PLACE.lng,
                  lat: HOME_PLACE.lat,
                  lng: HOME_PLACE.lng,
                  flight: 0,
                  nightHint: night,
                }
              }
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
      <DebugHud />
      {tileStatus === 'loading' && fill && (
        <p className="dog-tile-warn" role="status">
          Loading the neighborhood…
        </p>
      )}
      {tileStatus === 'failed' && (
        <p className="dog-tile-warn" role="status">
          City map didn’t load — park ground only. Check the network and reload.
        </p>
      )}
    </div>
  );
}

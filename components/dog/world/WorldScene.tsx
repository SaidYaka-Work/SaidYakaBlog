'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  Fog,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lngLatToLocal, sunDirection } from '../../../workers/dog/src/world';
import type { WorldTileData } from './decode';
import { crossingsAtIntersections, dressPlants, hash2, lampsAlongRoads, type Crossing, type Plant } from './dress';
import {
  LAYER_Y,
  createBuildJob,
  emptyTile,
  stepBuildJob,
  tileDistanceToPoint,
  type BuildJob,
  type BuiltTile,
} from './buildTile';
import { unpackGeometry, type PackedTile } from './packTile';
import { MAX_LIVE_TILES, evictTileCache } from './tileWindow';

function disposeBuilt(tile: BuiltTile) {
  tile.buildings.forEach((geo) => geo.dispose());
  tile.roofs.forEach((geo) => geo.dispose());
  tile.parks?.dispose();
  tile.water?.dispose();
  tile.sidewalks?.dispose();
  tile.roads?.dispose();
  tile.major?.dispose();
}

function facadeMaterial(night: boolean) {
  return new ShaderMaterial({
    vertexColors: true,
    side: DoubleSide,
    uniforms: {
      uNight: { value: night ? 1 : 0 },
      uFogColor: { value: new Color(night ? '#4a5c7a' : '#c8d6e4') },
      uFogNear: { value: 36 },
      uFogFar: { value: 220 },
      uHemiSky: { value: new Color(night ? '#9eb6e6' : '#fff1dc') },
      uHemiGround: { value: new Color(night ? '#3a342c' : '#c4a888') },
      uSunColor: { value: new Color(night ? '#d0def8' : '#ffe4bc') },
      uSunDir: { value: new Vector3(0.4, 0.8, 0.2) },
      uAmbient: { value: night ? 0.7 : 0.42 },
    },
    vertexShader: `
      attribute float aHeight;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vHeight;
      varying float vDist;
      void main() {
        vColor = color;
        vHeight = max(aHeight, 4.0);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uNight;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uHemiSky;
      uniform vec3 uHemiGround;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uAmbient;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vHeight;
      varying float vDist;
      void main() {
        vec3 nrm = normalize(vWorldNormal);
        float roof = smoothstep(0.48, 0.78, abs(nrm.y));
        float h = max(3.2, vHeight);
        float rows = max(3.0, floor(h / 2.8));
        float along = abs(nrm.x) > abs(nrm.z) ? vWorldPos.z : vWorldPos.x;
        float wy = fract((vWorldPos.y / h) * rows);
        float wx = fract(along / 2.4);
        float pane = step(0.16, wx) * step(wx, 0.84) * step(0.22, wy) * step(wy, 0.86);
        float id = fract(sin(dot(floor(vec2(along * 0.42, vWorldPos.y * rows * 0.32)), vec2(12.9898, 78.233))) * 43758.5453);
        float lit = step(0.34, id);
        vec3 windowDay = vec3(0.28, 0.38, 0.48);
        vec3 windowNight = mix(vec3(0.1, 0.12, 0.16), vec3(1.0, 0.82, 0.42), lit);
        vec3 wall = mix(vColor, mix(windowDay, windowNight, uNight), pane * (1.0 - roof));
        float ao = mix(0.55, 1.0, smoothstep(0.0, 2.8, vWorldPos.y));
        vec3 albedo = mix(wall * ao, vColor * 0.62, roof);
        vec3 hemi = mix(uHemiGround, uHemiSky, nrm.y * 0.5 + 0.5);
        float sun = max(0.0, dot(nrm, normalize(uSunDir)));
        vec3 litCol = albedo * (uAmbient + hemi * 0.7 + uSunColor * sun * 0.55);
        litCol += windowNight * pane * lit * uNight * (1.0 - roof) * 0.95;
        float fog = smoothstep(uFogNear, uFogFar, vDist);
        gl_FragColor = vec4(mix(litCol, uFogColor, fog), 1.0);
      }
    `,
  });
}

function roadMaterial(night: boolean, marked: boolean) {
  if (!marked) {
    return new MeshStandardMaterial({
      color: night ? '#2c2e32' : '#55544f',
      roughness: 0.94,
    });
  }
  return new ShaderMaterial({
    uniforms: {
      uNight: { value: night ? 1 : 0 },
      uFogColor: { value: new Color(night ? '#4a5c7a' : '#c8d6e4') },
      uFogNear: { value: 36 },
      uFogFar: { value: 220 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uNight;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec3 asphalt = mix(vec3(0.34, 0.33, 0.31), vec3(0.17, 0.18, 0.2), uNight);
        float center = smoothstep(0.468, 0.492, vUv.x) * smoothstep(0.532, 0.508, vUv.x);
        float dash = step(0.4, fract(vUv.y * 0.1));
        float edge = smoothstep(0.09, 0.03, vUv.x) + smoothstep(0.91, 0.97, vUv.x);
        float walk = step(0.82, fract(vUv.y * 0.03)) * step(0.1, vUv.x) * step(vUv.x, 0.9);
        vec3 paint = mix(vec3(0.94, 0.92, 0.84), vec3(1.0, 0.9, 0.5), uNight * 0.45);
        vec3 col = mix(asphalt, paint, clamp(center * dash + edge * 0.42 + walk * 0.82, 0.0, 1.0));
        float fog = smoothstep(uFogNear, uFogFar, length(vWorldPos - cameraPosition));
        gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
      }
    `,
  });
}

function waterMaterial(night: boolean) {
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: night ? 1 : 0 },
      uFogColor: { value: new Color(night ? '#4a5c7a' : '#c8d6e4') },
      uFogNear: { value: 36 },
      uFogFar: { value: 220 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying float vDist;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uNight;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorldPos;
      varying float vDist;
      void main() {
        float w = sin(vWorldPos.x * 0.22 + uTime * 0.7) * sin(vWorldPos.z * 0.18 + uTime * 0.55);
        vec3 deep = mix(vec3(0.28, 0.52, 0.64), vec3(0.16, 0.32, 0.46), uNight);
        vec3 crest = mix(vec3(0.72, 0.86, 0.92), vec3(0.45, 0.62, 0.78), uNight);
        vec3 col = mix(deep, crest, 0.5 + 0.5 * w);
        float fog = smoothstep(uFogNear, uFogFar, vDist);
        gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
      }
    `,
  });
  material.userData.uTime = material.uniforms.uTime;
  return material;
}

function crossingMaterial(night: boolean) {
  return new ShaderMaterial({
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    uniforms: {
      uNight: { value: night ? 1 : 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uNight;
      varying vec2 vUv;
      void main() {
        float stripe = step(0.45, fract(vUv.x * 7.0));
        vec3 paint = mix(vec3(0.93, 0.91, 0.84), vec3(1.0, 0.9, 0.55), uNight * 0.4);
        vec3 asphalt = mix(vec3(0.34, 0.33, 0.31), vec3(0.17, 0.18, 0.2), uNight);
        gl_FragColor = vec4(mix(asphalt, paint, stripe), 1.0);
      }
    `,
  });
}

function crossingMesh(crossings: Crossing[]) {
  const geos: BufferGeometry[] = [];
  for (const mark of crossings) {
    const across = Math.min(8, Math.max(5.4, mark.w));
    const along = 3.2;
    const geo = new PlaneGeometry(across, along, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.atan2(mark.dx, mark.dz));
    geo.translate(mark.x, LAYER_Y.mark, mark.z);
    geos.push(geo);
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged;
}

function SkyDome({ night }: { night: boolean }) {
  const ref = useRef<Mesh>(null);
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} renderOrder={-2}>
      <sphereGeometry args={[420, 16, 10]} />
      <shaderMaterial
        side={DoubleSide}
        depthWrite={false}
        uniforms={{
          uTop: { value: new Color(night ? '#2a4570' : '#8eb8dc') },
          uHorizon: { value: new Color(night ? '#7a6888' : '#f2d4b0') },
          uNight: { value: night ? 1 : 0 },
        }}
        vertexShader={`
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          uniform float uNight;
          varying vec3 vPos;
          void main() {
            vec3 dir = normalize(vPos);
            float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(uHorizon, uTop, pow(h, 0.82));
            float star = step(0.9965, fract(sin(dot(dir.xz * 72.0, vec2(12.9898, 78.233))) * 43758.5453));
            col += vec3(0.85, 0.9, 1.0) * star * uNight * smoothstep(0.35, 0.7, h);
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function stampInstances(mesh: InstancedMesh | null, place: (dummy: Object3D, i: number) => void, count: number) {
  if (!mesh) return;
  const dummy = new Object3D();
  for (let i = 0; i < count; i += 1) {
    dummy.position.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    place(dummy, i);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

const LEAF_DAY = ['#4a7a3e', '#6a944c', '#3f6e36', '#8aaa58', '#547844', '#c4b05a', '#3a6a42', '#7a9e46'];
const LEAF_NIGHT = ['#7a9a58', '#9ab46a', '#5f7a42', '#c0b46a', '#6a8648', '#88a85c', '#4e6e3c'];
const BUSH_DAY = ['#3f6a38', '#4a7640', '#356034', '#6a8a48', '#527848'];
const BUSH_NIGHT = ['#5a7a46', '#4e6e3e', '#678454', '#7a9258', '#567044'];

function stampColors(mesh: InstancedMesh | null, plants: Plant[], palette: string[]) {
  if (!mesh) return;
  const tint = new Color();
  for (let i = 0; i < plants.length; i += 1) {
    const pick = palette[Math.floor(hash2(plants[i].x, plants[i].z) * palette.length) % palette.length];
    tint.set(pick);
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function Forest({ plants, night }: { plants: Plant[]; night: boolean }) {
  const trunk = useRef<InstancedMesh>(null);
  const leaf = useRef<InstancedMesh>(null);
  const bush = useRef<InstancedMesh>(null);
  const trees = plants.filter((plant) => plant.kind === 'tree');
  const bushes = plants.filter((plant) => plant.kind === 'bush');
  useLayoutEffect(() => {
    const nextTrees = plants.filter((plant) => plant.kind === 'tree');
    const nextBushes = plants.filter((plant) => plant.kind === 'bush');
    stampInstances(
      trunk.current,
      (dummy, i) => {
        const tree = nextTrees[i];
        dummy.position.set(tree.x, 0.85 * tree.s, tree.z);
        dummy.scale.setScalar(tree.s);
      },
      nextTrees.length,
    );
    stampInstances(
      leaf.current,
      (dummy, i) => {
        const tree = nextTrees[i];
        dummy.position.set(tree.x, 2.2 * tree.s, tree.z);
        dummy.scale.set(tree.s * (0.9 + hash2(tree.z, tree.x) * 0.22), tree.s, tree.s * (0.9 + hash2(tree.x, tree.s) * 0.22));
        dummy.rotation.y = hash2(tree.x, tree.z) * Math.PI * 2;
      },
      nextTrees.length,
    );
    stampInstances(
      bush.current,
      (dummy, i) => {
        const item = nextBushes[i];
        dummy.position.set(item.x, 0.42 * item.s, item.z);
        dummy.scale.setScalar(item.s);
      },
      nextBushes.length,
    );
    stampColors(leaf.current, nextTrees, night ? LEAF_NIGHT : LEAF_DAY);
    stampColors(bush.current, nextBushes, night ? BUSH_NIGHT : BUSH_DAY);
  }, [night, plants]);
  if (!plants.length) return null;
  return (
    <group>
      {trees.length > 0 && (
        <>
          <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]}>
            <cylinderGeometry args={[0.18, 0.24, 1.7, 5]} />
            <meshBasicMaterial color="#8a5a38" />
          </instancedMesh>
          <instancedMesh ref={leaf} args={[undefined, undefined, trees.length]}>
            <coneGeometry args={[1.9, 3.8, 6]} />
            <meshBasicMaterial color={night ? '#8aaa62' : '#5f8a4e'} />
          </instancedMesh>
        </>
      )}
      {bushes.length > 0 && (
        <instancedMesh ref={bush} args={[undefined, undefined, bushes.length]}>
          <sphereGeometry args={[0.7, 7, 5]} />
          <meshBasicMaterial color={night ? '#6a8a52' : '#4a7a40'} />
        </instancedMesh>
      )}
    </group>
  );
}

function Lamps({ lamps, night }: { lamps: { x: number; z: number }[]; night: boolean }) {
  const poles = useRef<InstancedMesh>(null);
  const bulbs = useRef<InstancedMesh>(null);
  const pools = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    stampInstances(
      poles.current,
      (dummy, i) => {
        dummy.position.set(lamps[i].x, 1.7, lamps[i].z);
      },
      lamps.length,
    );
    stampInstances(
      bulbs.current,
      (dummy, i) => {
        dummy.position.set(lamps[i].x, 3.42, lamps[i].z);
      },
      lamps.length,
    );
    stampInstances(
      pools.current,
      (dummy, i) => {
        dummy.position.set(lamps[i].x, 0.055, lamps[i].z);
        dummy.rotation.x = -Math.PI / 2;
        dummy.scale.setScalar(night ? 1 : 0.35);
      },
      lamps.length,
    );
  }, [lamps, night]);
  if (!lamps.length) return null;
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, lamps.length]}>
        <cylinderGeometry args={[0.08, 0.1, 3.4, 5]} />
        <meshLambertMaterial color={night ? '#4a4a50' : '#5a5a5c'} emissive="#222224" emissiveIntensity={0.25} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, lamps.length]}>
        <sphereGeometry args={[0.24, 6, 6]} />
        <meshBasicMaterial color={night ? '#ffe2a0' : '#f4e8c8'} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[undefined, undefined, lamps.length]}>
        <circleGeometry args={[5.4, 12]} />
        <meshBasicMaterial color="#ffd080" transparent opacity={night ? 0.34 : 0.08} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

const PACK_LAYERS = ['buildings', 'roofs', 'parks', 'water', 'sidewalks', 'roads'] as const;

function applyPackedLayer(built: BuiltTile, packed: PackedTile, layer: (typeof PACK_LAYERS)[number]) {
  const geo = unpackGeometry(packed[layer]);
  if (!geo) return;
  if (layer === 'buildings') built.buildings = [geo];
  else if (layer === 'roofs') built.roofs = [geo];
  else built[layer] = geo;
}

function Benches({ benches, night }: { benches: Plant[]; night: boolean }) {
  const seats = useRef<InstancedMesh>(null);
  const left = useRef<InstancedMesh>(null);
  const right = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    stampInstances(
      seats.current,
      (dummy, i) => {
        dummy.position.set(benches[i].x, 0.28, benches[i].z);
        dummy.rotation.y = hash2(benches[i].x, benches[i].z) * Math.PI * 2;
      },
      benches.length,
    );
    stampInstances(
      left.current,
      (dummy, i) => {
        dummy.position.set(benches[i].x, 0.14, benches[i].z);
        dummy.rotation.y = hash2(benches[i].x, benches[i].z) * Math.PI * 2;
        dummy.translateX(-0.46);
      },
      benches.length,
    );
    stampInstances(
      right.current,
      (dummy, i) => {
        dummy.position.set(benches[i].x, 0.14, benches[i].z);
        dummy.rotation.y = hash2(benches[i].x, benches[i].z) * Math.PI * 2;
        dummy.translateX(0.46);
      },
      benches.length,
    );
  }, [benches]);
  if (!benches.length) return null;
  const color = night ? '#6a5040' : '#9a7a52';
  return (
    <group>
      <instancedMesh ref={seats} args={[undefined, undefined, benches.length]}>
        <boxGeometry args={[1.15, 0.08, 0.38]} />
        <meshLambertMaterial color={color} emissive="#2a1c12" emissiveIntensity={0.35} />
      </instancedMesh>
      <instancedMesh ref={left} args={[undefined, undefined, benches.length]}>
        <boxGeometry args={[0.08, 0.28, 0.34]} />
        <meshLambertMaterial color={color} emissive="#2a1c12" emissiveIntensity={0.35} />
      </instancedMesh>
      <instancedMesh ref={right} args={[undefined, undefined, benches.length]}>
        <boxGeometry args={[0.08, 0.28, 0.34]} />
        <meshLambertMaterial color={color} emissive="#2a1c12" emissiveIntensity={0.35} />
      </instancedMesh>
    </group>
  );
}

export default function WorldScene({
  tiles,
  lat,
  lng,
  originLat,
  originLng,
  nightHint,
  failed = false,
}: {
  tiles: WorldTileData[];
  lat: number;
  lng: number;
  originLat: number;
  originLng: number;
  nightHint?: boolean;
  failed?: boolean;
}) {
  const { scene, gl, camera } = useThree();
  const sun = useMemo(() => sunDirection(lat, lng, Date.now()), [lat, lng]);
  const night = nightHint ?? sun.night;
  const here = useMemo(() => lngLatToLocal(lat, lng, originLat, originLng), [lat, lng, originLat, originLng]);
  const [slim, setSlim] = useState(false);
  useEffect(() => {
    const sync = () => setSlim(window.innerWidth < 700);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  const hereRef = useRef(here);
  hereRef.current = here;
  const cache = useRef(new Map<string, BuiltTile>());
  const queue = useRef<WorldTileData[]>([]);
  const uploads = useRef<{ tile: WorldTileData; packed: PackedTile; layer: number }[]>([]);
  const pending = useRef<BuildJob | null>(null);
  const [ready, setReady] = useState<BuiltTile[]>([]);

  useEffect(() => {
    const wanted = new Set(tiles.map((tile) => tile.key));
    const evicted = evictTileCache(cache.current, wanted, (_key, built) => disposeBuilt(built), MAX_LIVE_TILES);
    queue.current = queue.current.filter((tile) => wanted.has(tile.key) && !cache.current.has(tile.key));
    uploads.current = uploads.current.filter((item) => wanted.has(item.tile.key) && !cache.current.has(item.tile.key));
    if (pending.current && !wanted.has(pending.current.tile.key)) pending.current = null;
    for (const tile of tiles) {
      if (cache.current.has(tile.key)) continue;
      if (tile.packed) {
        if (!uploads.current.some((item) => item.tile.key === tile.key)) {
          uploads.current.push({ tile, packed: tile.packed, layer: 0 });
        }
        continue;
      }
      if (queue.current.some((item) => item.key === tile.key)) continue;
      if (pending.current?.tile.key === tile.key) continue;
      queue.current.push(tile);
    }
    queue.current.sort(
      (a, b) => tileDistanceToPoint(a, hereRef.current) - tileDistanceToPoint(b, hereRef.current),
    );
    uploads.current.sort(
      (a, b) => tileDistanceToPoint(a.tile, hereRef.current) - tileDistanceToPoint(b.tile, hereRef.current),
    );
    if (evicted.length) setReady(Array.from(cache.current.values()));
  }, [tiles]);

  useEffect(() => () => {
    cache.current.forEach(disposeBuilt);
    cache.current.clear();
    queue.current = [];
    uploads.current = [];
    pending.current = null;
  }, []);

  const lamps = useMemo(
    () => lampsAlongRoads(tiles.flatMap((tile) => tile.roads), here, slim ? 6 : 10),
    [here, slim, tiles],
  );
  const plantMax = slim ? 48 : 96;
  const plants = useMemo(
    () => dressPlants(tiles.flatMap((tile) => tile.parks), tiles.flatMap((tile) => tile.roads), here, plantMax),
    [here, plantMax, tiles],
  );
  const benches = useMemo(
    () => plants.filter((plant) => plant.kind === 'bush').slice(0, slim ? 3 : 6),
    [plants, slim],
  );
  const crossings = useMemo(
    () => crossingsAtIntersections(tiles.flatMap((tile) => tile.roads), here, slim ? 3 : 5),
    [here, slim, tiles],
  );
  const crossingGeo = useMemo(() => crossingMesh(crossings), [crossings]);

  const facade = useMemo(() => facadeMaterial(night), [night]);
  const asphalt = useMemo(() => {
    const mat = roadMaterial(night, false);
    if ('polygonOffset' in mat) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1;
      mat.polygonOffsetUnits = -1;
    }
    return mat;
  }, [night]);
  const marked = useMemo(() => {
    const mat = roadMaterial(night, true);
    if ('polygonOffset' in mat) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
    }
    return mat;
  }, [night]);
  const water = useMemo(() => waterMaterial(night), [night]);
  const zebra = useMemo(() => crossingMaterial(night), [night]);
  const roofMat = useMemo(
    () => new MeshStandardMaterial({ color: night ? '#4a403c' : '#8a7468', roughness: 0.8 }),
    [night],
  );
  const parkMat = useMemo(
    () => new MeshStandardMaterial({ color: night ? '#4a6a42' : '#6f9a54' }),
    [night],
  );
  const walkMat = useMemo(
    () => new MeshStandardMaterial({ color: night ? '#6a665e' : '#d8cebe', roughness: 0.9 }),
    [night],
  );
  const groundMat = useMemo(
    () => new MeshStandardMaterial({ color: night ? '#2f3d2c' : '#6f8f52' }),
    [night],
  );
  useEffect(() => {
    const dir = facade.uniforms?.uSunDir?.value;
    if (dir && typeof dir.set === 'function') {
      dir.set(sun.x, Math.max(0.25, sun.y + (night ? 0.4 : 0)), sun.z);
    }
  }, [facade, night, sun.x, sun.y, sun.z]);

  const warmed = useRef(false);
  useEffect(() => {
    if (warmed.current || !ready.length) return;
    try {
      const renderer = gl as typeof gl & { compileAsync?: (s: object, c: object) => Promise<void> };
      if (typeof renderer.compileAsync === 'function') void renderer.compileAsync(scene, camera);
      else gl.compile(scene, camera);
      warmed.current = true;
    } catch (error) {
      console.warn('[dog] shader prewarm failed', error);
    }
  }, [camera, gl, ready.length, scene]);

  useFrame((_, dt) => {
    const clock = water.userData.uTime;
    if (clock) clock.value = (clock.value + dt) % 1000;
    const host = window as Window & { __DOG_PERF?: { tiles?: number; geometries?: number; textures?: number } };
    if (host.__DOG_PERF) {
      host.__DOG_PERF.tiles = cache.current.size;
      host.__DOG_PERF.geometries = gl.info.memory.geometries;
      host.__DOG_PERF.textures = gl.info.memory.textures;
    }
    let changed = false;
    const upload = uploads.current[0];
    if (upload) {
      if (!cache.current.has(upload.tile.key)) {
        cache.current.set(upload.tile.key, emptyTile(upload.tile.key));
      }
      const built = cache.current.get(upload.tile.key);
      const layer = PACK_LAYERS[upload.layer];
      if (built && layer) {
        applyPackedLayer(built, upload.packed, layer);
        changed = true;
      }
      upload.layer += 1;
      if (upload.layer >= PACK_LAYERS.length) {
        uploads.current.shift();
        evictTileCache(cache.current, tiles.map((tile) => tile.key), (_key, item) => disposeBuilt(item), MAX_LIVE_TILES);
      }
    } else {
      const budget = slim ? 4 : 6;
      const start = performance.now();
      if (!pending.current) {
        const next = queue.current.shift();
        if (next && !cache.current.has(next.key)) pending.current = createBuildJob(next, hereRef.current);
      }
      if (pending.current && performance.now() - start < budget) {
        const current = pending.current;
        const result = stepBuildJob(current);
        if (result.changed || result.done) {
          cache.current.set(current.tile.key, { ...(result.job?.built ?? current.built) });
          changed = true;
        }
        pending.current = result.done ? null : result.job;
        evictTileCache(cache.current, tiles.map((tile) => tile.key), (_key, item) => disposeBuilt(item), MAX_LIVE_TILES);
      }
    }
    if (changed) setReady(Array.from(cache.current.values()));
  });

  useEffect(() => {
    const fog = night ? '#4a5c7a' : '#c8d6e4';
    scene.background = new Color(fog);
    scene.fog = new Fog(fog, 36, slim ? 140 : 200);
    gl.setClearColor(fog, 1);
    gl.toneMappingExposure = night ? 1.22 : 0.9;
  }, [gl, night, scene, slim]);

  useEffect(() => () => {
    facade.dispose();
    asphalt.dispose();
    marked.dispose();
    water.dispose();
    zebra.dispose();
    roofMat.dispose();
    parkMat.dispose();
    walkMat.dispose();
    groundMat.dispose();
  }, [asphalt, facade, groundMat, marked, parkMat, roofMat, walkMat, water, zebra]);

  useEffect(() => () => {
    crossingGeo?.dispose();
  }, [crossingGeo]);

  return (
    <group>
      <SkyDome night={night} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} material={groundMat}>
        <planeGeometry args={[2400, 2400]} />
      </mesh>
      {failed && ready.every((tile) => !tile.buildings.length && !tile.roads) && (
        <group>
          {([[12, 8, 8, 14], [-14, 6, 7, 16], [8, -12, 9, 12], [-10, -8, 6, 10], [18, 2, 10, 18]] as const).map(
            ([x, z, w, h], index) => (
              <mesh key={`fallback-${index}`} position={[x, h / 2, z]} material={roofMat} userData={{ occlude: true }}>
                <boxGeometry args={[w, h, 6]} />
              </mesh>
            ),
          )}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={asphalt} renderOrder={2}>
            <planeGeometry args={[10, 90]} />
          </mesh>
        </group>
      )}
      <ambientLight intensity={night ? 0.62 : 0.26} color={night ? '#b4c6e4' : '#fff4e6'} />
      <hemisphereLight args={[night ? '#9eb6e6' : '#fff1dc', night ? '#3a342c' : '#c4a888', night ? 1.32 : 0.82]} />
      <directionalLight
        position={[sun.x, Math.max(8, sun.y + (night ? 6 : 0)), sun.z]}
        intensity={night ? 0.88 : 0.82}
        color={night ? '#d0def8' : '#ffe4bc'}
      />
      {ready.map((tile) => (
        <group key={tile.key}>
          {tile.parks && <mesh geometry={tile.parks} material={parkMat} />}
          {tile.sidewalks && (
            <mesh geometry={tile.sidewalks} material={walkMat} renderOrder={1} />
          )}
          {tile.roads && <mesh geometry={tile.roads} material={marked} renderOrder={3} />}
          {tile.water && <mesh geometry={tile.water} material={water} />}
          {tile.buildings.map((geo, index) => (
            <mesh key={`${tile.key}-b-${index}`} geometry={geo} material={facade} userData={{ occlude: true }} />
          ))}
          {tile.roofs.map((geo, index) => (
            <mesh key={`${tile.key}-r-${index}`} geometry={geo} material={roofMat} userData={{ occlude: true }} />
          ))}
        </group>
      ))}
      {crossingGeo && (
        <mesh geometry={crossingGeo} material={zebra} renderOrder={4} />
      )}
      <Forest plants={plants} night={night} />
      <Benches benches={benches} night={night} />
      <Lamps lamps={lamps} night={night} />
    </group>
  );
}


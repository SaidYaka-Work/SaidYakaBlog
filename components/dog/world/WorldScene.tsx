'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  DataTexture,
  DoubleSide,
  Fog,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  ShaderMaterial,
  UnsignedByteType,
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
  tileLodWanted,
  type BuildJob,
  type BuiltTile,
} from './buildTile';
import { unpackGeometry, type PackedTile } from './packTile';
import { KEEP_RING, MAX_CACHED_TILES, evictTileCache, wantedTileKeys } from './tileWindow';
import { camFade, dogHere, frameMark } from './frameMark';

export const FOG_NEAR = 28;
export const FOG_FAR = 130;
export const FOG_FAR_SLIM = 96;
export const SKY_RADIUS = 168;
export const TREE_SCALE = 0.65;

function fogFar(slim: boolean) {
  return slim ? FOG_FAR_SLIM : FOG_FAR;
}

function makeWindowTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const pane = u > 0.16 && u < 0.84 && v > 0.22 && v < 0.86;
      const i = (y * size + x) * 4;
      const tone = pane ? 255 : 0;
      data[i] = tone;
      data[i + 1] = tone;
      data[i + 2] = tone;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

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
  const windows = makeWindowTexture();
  const mat = new ShaderMaterial({
    vertexColors: true,
    side: DoubleSide,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uNight: { value: night ? 1 : 0 },
      uFogColor: { value: new Color(night ? '#4a5c7a' : '#c8d6e4') },
      uFogNear: { value: FOG_NEAR },
      uFogFar: { value: FOG_FAR },
      uWindow: { value: windows },
      uHemiSky: { value: new Color(night ? '#9eb6e6' : '#fff1dc') },
      uHemiGround: { value: new Color(night ? '#3a342c' : '#c4a888') },
      uSunColor: { value: new Color(night ? '#d0def8' : '#ffe4bc') },
      uSunDir: { value: new Vector3(0.4, 0.8, 0.2) },
      uAmbient: { value: night ? 0.7 : 0.42 },
      uLook: { value: new Vector3(0, 1.15, 0) },
      uCam: { value: new Vector3(0, 8, 14) },
      uFade: { value: 0 },
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
      uniform sampler2D uWindow;
      uniform vec3 uHemiSky;
      uniform vec3 uHemiGround;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uAmbient;
      uniform vec3 uLook;
      uniform vec3 uCam;
      uniform float uFade;
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
        float wy = (vWorldPos.y / h) * rows;
        float wx = along / 2.4;
        float pane = texture2D(uWindow, vec2(wx, wy)).r;
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
        vec2 a = vWorldPos.xz - uLook.xz;
        vec2 b = uCam.xz - uLook.xz;
        float span = max(dot(b, b), 0.001);
        float t = clamp(dot(a, b) / span, 0.0, 1.0);
        float occ = length(a - b * t);
        float distCam = length(vWorldPos.xz - uCam.xz);
        float corridor = uFade * (1.0 - smoothstep(2.2, 9.0, occ)) * smoothstep(0.04, 0.18, t) * (1.0 - smoothstep(0.82, 1.0, t));
        float nearCam = uFade * (1.0 - smoothstep(0.35, 2.4, distCam));
        float fade = max(corridor, nearCam);
        litCol = mix(litCol, uFogColor, fade * 0.78);
        gl_FragColor = vec4(mix(litCol, uFogColor, fog), (1.0 - fade * 0.55) * (1.0 - smoothstep(0.8, 1.0, fog)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  mat.userData.windows = windows;
  return mat;
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
      uFogNear: { value: FOG_NEAR },
      uFogFar: { value: FOG_FAR },
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
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
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
      uFogNear: { value: FOG_NEAR },
      uFogFar: { value: FOG_FAR },
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
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
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
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
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
      <sphereGeometry args={[SKY_RADIUS, 12, 8]} />
      <shaderMaterial
        side={DoubleSide}
        depthWrite={false}
        uniforms={{
          uTop: { value: new Color(night ? '#2a4570' : '#8eb8dc') },
          uHorizon: { value: new Color(night ? '#7a6888' : '#f2d4b0') },
          uNight: { value: night ? 1 : 0 },
          uFog: { value: new Color(night ? '#4a5c7a' : '#c8d6e4') },
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
          uniform vec3 uFog;
          varying vec3 vPos;
          void main() {
            vec3 dir = normalize(vPos);
            float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(uHorizon, uTop, pow(h, 0.82));
            // Fully fogged geometry is uFog; match it at and below the horizon so it never silhouettes.
            col = mix(uFog, col, smoothstep(0.02, 0.3, dir.y));
            float star = step(0.9965, fract(sin(dot(dir.xz * 72.0, vec2(12.9898, 78.233))) * 43758.5453));
            col += vec3(0.85, 0.9, 1.0) * star * uNight * smoothstep(0.35, 0.7, h);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}

function stampInstances(mesh: InstancedMesh | null, place: (dummy: Object3D, i: number) => void, count: number) {
  if (!mesh || count <= 0) return;
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
  if (mesh.instanceMatrix.array.length) mesh.computeBoundingSphere();
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

/** Cone leaves / trunks on the camera→dog line dither out so they never hide Biscuit. */
function treeFadeMaterial(color: string) {
  const mat = new MeshBasicMaterial({ color });
  const fade = { uLook: { value: new Vector3() }, uCam: { value: new Vector3(0, 8, 14) } };
  mat.userData.fade = fade;
  mat.customProgramCacheKey = () => 'dog-tree-fade';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fade);
    shader.vertexShader = `varying vec3 vTreeWp;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 treeWp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        treeWp = instanceMatrix * treeWp;
      #endif
      vTreeWp = (modelMatrix * treeWp).xyz;`,
    );
    shader.fragmentShader = `uniform vec3 uLook;\nuniform vec3 uCam;\nvarying vec3 vTreeWp;\n${shader.fragmentShader}`.replace(
      'void main() {',
      `void main() {
        vec2 ta = vTreeWp.xz - uLook.xz;
        vec2 tb = uCam.xz - uLook.xz;
        float tt = clamp(dot(ta, tb) / max(dot(tb, tb), 0.001), 0.0, 1.0);
        float treeFade = (1.0 - smoothstep(1.6, 3.2, length(ta - tb * tt))) * smoothstep(0.05, 0.2, tt) * (1.0 - smoothstep(0.9, 1.0, tt));
        vec2 cell = mod(floor(gl_FragCoord.xy), 2.0);
        float bayer = (cell.x * 2.0 + cell.y * 3.0 - cell.x * cell.y * 4.0 + 0.5) / 4.0;
        if (treeFade * 0.85 > bayer) discard;`,
    );
  };
  return mat;
}

function Forest({ plants, night }: { plants: Plant[]; night: boolean }) {
  const trunk = useRef<InstancedMesh>(null);
  const leaf = useRef<InstancedMesh>(null);
  const bush = useRef<InstancedMesh>(null);
  const trees = plants.filter((plant) => plant.kind === 'tree');
  const bushes = plants.filter((plant) => plant.kind === 'bush');
  const leafMat = useMemo(() => treeFadeMaterial(night ? '#8aaa62' : '#5f8a4e'), [night]);
  const trunkMat = useMemo(() => treeFadeMaterial('#8a5a38'), []);
  useEffect(() => () => leafMat.dispose(), [leafMat]);
  useEffect(() => () => trunkMat.dispose(), [trunkMat]);
  useFrame(() => {
    for (const mat of [leafMat, trunkMat]) {
      const u = mat.userData.fade as { uLook: { value: Vector3 }; uCam: { value: Vector3 } } | undefined;
      if (!u) continue;
      u.uLook.value.set(camFade.lookX, camFade.lookY, camFade.lookZ);
      u.uCam.value.set(camFade.camX, camFade.camY, camFade.camZ);
    }
  });
  useLayoutEffect(() => {
    const nextTrees = plants.filter((plant) => plant.kind === 'tree');
    const nextBushes = plants.filter((plant) => plant.kind === 'bush');
    stampInstances(
      trunk.current,
      (dummy, i) => {
        const tree = nextTrees[i];
        dummy.position.set(tree.x, 0.85 * tree.s * TREE_SCALE, tree.z);
        dummy.scale.setScalar(tree.s * TREE_SCALE);
      },
      nextTrees.length,
    );
    stampInstances(
      leaf.current,
      (dummy, i) => {
        const tree = nextTrees[i];
        dummy.position.set(tree.x, 2.2 * tree.s * TREE_SCALE, tree.z);
        dummy.scale.set(
          tree.s * TREE_SCALE * (0.9 + hash2(tree.z, tree.x) * 0.22),
          tree.s * TREE_SCALE,
          tree.s * TREE_SCALE * (0.9 + hash2(tree.x, tree.s) * 0.22),
        );
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
          <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]} material={trunkMat}>
            <cylinderGeometry args={[0.18, 0.24, 1.7, 4]} />
          </instancedMesh>
          <instancedMesh ref={leaf} args={[undefined, undefined, trees.length]} material={leafMat}>
            <coneGeometry args={[1.9, 3.8, 4]} />
          </instancedMesh>
        </>
      )}
      {bushes.length > 0 && (
        <instancedMesh ref={bush} args={[undefined, undefined, bushes.length]}>
          <sphereGeometry args={[0.7, 5, 4]} />
          <meshBasicMaterial color={night ? '#6a8a52' : '#4a7a40'} />
        </instancedMesh>
      )}
    </group>
  );
}

function Lamps({ lamps, night }: { lamps: { x: number; z: number }[]; night: boolean }) {
  const poles = useRef<InstancedMesh>(null);
  const bulbs = useRef<InstancedMesh>(null);
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
  }, [lamps]);
  if (!lamps.length) return null;
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, lamps.length]}>
        <cylinderGeometry args={[0.08, 0.1, 3.4, 4]} />
        <meshLambertMaterial color={night ? '#4a4a50' : '#5a5a5c'} emissive="#222224" emissiveIntensity={0.25} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, lamps.length]}>
        <sphereGeometry args={[0.24, 5, 4]} />
        <meshBasicMaterial color={night ? '#ffe2a0' : '#f4e8c8'} />
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
  warmTiles = [],
  lat,
  lng,
  originLat,
  originLng,
  nightHint,
  failed = false,
}: {
  tiles: WorldTileData[];
  warmTiles?: WorldTileData[];
  lat: number;
  lng: number;
  originLat: number;
  originLng: number;
  nightHint?: boolean;
  failed?: boolean;
}) {
  const { scene, gl, camera } = useThree();
  const sun = useMemo(() => sunDirection(originLat, originLng, Date.now()), [originLat, originLng]);
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
  // Dressing (lamps, plants, crossings) scans every road and park ring and sorts them.
  // `here` changes on every 4 Hz pose/location sync while walking; re-dress only per 12 m cell.
  const dressCellX = Math.round(here.x / 12);
  const dressCellZ = Math.round(here.z / 12);
  const dressHere = useMemo(() => ({ x: dressCellX * 12, z: dressCellZ * 12 }), [dressCellX, dressCellZ]);
  const cache = useRef(new Map<string, BuiltTile>());
  const queue = useRef<WorldTileData[]>([]);
  const uploads = useRef<{ tile: WorldTileData; packed: PackedTile; layer: number }[]>([]);
  const pending = useRef<BuildJob | null>(null);
  const builtFrom = useRef(new Map<string, WorldTileData>());
  const stale = useRef(new Set<string>());
  const [ready, setReady] = useState<BuiltTile[]>([]);

  useEffect(() => {
    const wanted = new Set(tiles.map((tile) => tile.key));
    const warming = warmTiles.length ? warmTiles : tiles;
    const centerKey = tiles[0]?.key.split('/').map(Number) ?? [];
    const keep = tiles[0]
      ? new Set(wantedTileKeys({ z: centerKey[0], x: centerKey[1], y: centerKey[2] }, KEEP_RING))
      : new Set(warming.map((tile) => tile.key));
    const evicted = evictTileCache(cache.current, keep, (_key, built) => disposeBuilt(built), MAX_CACHED_TILES);
    for (const key of evicted) {
      builtFrom.current.delete(key);
      stale.current.delete(key);
    }
    // Keep queued LOD swaps and rebuilds: their tile is already cached on purpose.
    queue.current = queue.current.filter((tile) => keep.has(tile.key));
    // Keep half-uploaded tiles: their cache entry exists, but layers are still pending.
    uploads.current = uploads.current.filter((item) => keep.has(item.tile.key));
    if (pending.current && !keep.has(pending.current.tile.key)) pending.current = null;
    for (const tile of tiles) {
      const prev = builtFrom.current.get(tile.key);
      builtFrom.current.set(tile.key, tile);
      if (prev && prev !== tile && cache.current.has(tile.key)) {
        // Re-decoded for a nearer focus: rebuild in place; the old build stays up until the new one is done.
        stale.current.add(tile.key);
        if (!queue.current.some((item) => item.key === tile.key)) queue.current.push(tile);
        continue;
      }
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
    const hereNow = dogHere(hereRef.current);
    queue.current.sort((a, b) => tileDistanceToPoint(a, hereNow) - tileDistanceToPoint(b, hereNow));
    uploads.current.sort(
      (a, b) => tileDistanceToPoint(a.tile, hereNow) - tileDistanceToPoint(b.tile, hereNow),
    );
    setReady(Array.from(cache.current.values()).filter((tile) => wanted.has(tile.key)));
  }, [tiles, warmTiles]);

  useEffect(() => () => {
    cache.current.forEach(disposeBuilt);
    cache.current.clear();
    queue.current = [];
    uploads.current = [];
    pending.current = null;
    builtFrom.current.clear();
    stale.current.clear();
  }, []);

  const lamps = useMemo(
    () => lampsAlongRoads(tiles.flatMap((tile) => tile.roads), dressHere, slim ? 5 : 8),
    [dressHere, slim, tiles],
  );
  const plantMax = slim ? 28 : 48;
  const plants = useMemo(
    () => dressPlants(tiles.flatMap((tile) => tile.parks), tiles.flatMap((tile) => tile.roads), dressHere, plantMax),
    [dressHere, plantMax, tiles],
  );
  const benches = useMemo(
    () => plants.filter((plant) => plant.kind === 'bush').slice(0, slim ? 3 : 6),
    [plants, slim],
  );
  const crossings = useMemo(
    () => crossingsAtIntersections(tiles.flatMap((tile) => tile.roads), dressHere, slim ? 3 : 5),
    [dressHere, slim, tiles],
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

  const ground = useRef<Mesh>(null);
  const lastLodCheck = useRef({ x: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY });
  const skipUpload = useRef(0);
  const compiled = useRef(false);
  const compile = useCallback(() => {
    if (compiled.current) return;
    compiled.current = true;
    try {
      const renderer = gl as typeof gl & { compileAsync?: (s: object, c: object) => Promise<void> };
      if (typeof renderer.compileAsync === 'function') void renderer.compileAsync(scene, camera);
      else gl.compile(scene, camera);
    } catch (error) {
      compiled.current = false;
      console.warn('[dog] shader prewarm failed', error);
    }
  }, [camera, gl, scene]);
  useEffect(() => {
    if (!ready.length) return;
    compile();
  }, [compile, ready.length]);

  useFrame((_, dt) => {
    const tileStart = performance.now();
    if (ground.current) {
      ground.current.position.x = Math.round(camera.position.x / 20) * 20;
      ground.current.position.z = Math.round(camera.position.z / 20) * 20;
    }
    const look = facade.uniforms.uLook?.value;
    const cam = facade.uniforms.uCam?.value;
    if (look && typeof look.set === 'function') look.set(camFade.lookX, camFade.lookY, camFade.lookZ);
    if (cam && typeof cam.set === 'function') cam.set(camFade.camX, camFade.camY, camFade.camZ);
    if (facade.uniforms.uFade) facade.uniforms.uFade.value = camFade.fade;
    const clock = water.userData.uTime;
    if (clock) clock.value = (clock.value + dt) % 1000;
    const host = window as Window & { __DOG_PERF?: { tiles?: number; geometries?: number; textures?: number } };
    if (host.__DOG_PERF) {
      host.__DOG_PERF.tiles = ready.length || cache.current.size;
      host.__DOG_PERF.geometries = gl.info.memory.geometries;
      host.__DOG_PERF.textures = gl.info.memory.textures;
    }
    let changed = false;
    const hereNow = dogHere(hereRef.current);
    if (Math.hypot(hereNow.x - lastLodCheck.current.x, hereNow.z - lastLodCheck.current.z) > 6) {
      lastLodCheck.current = { x: hereNow.x, z: hereNow.z };
      for (const tile of tiles) {
        const built = cache.current.get(tile.key);
        if (!built || uploads.current.some((item) => item.tile.key === tile.key)) continue;
        const wantedLod = tileLodWanted(tile, hereNow, built.lod);
        if (wantedLod === !!built.lod) continue;
        if (pending.current?.tile.key === tile.key) continue;
        if (!queue.current.some((item) => item.key === tile.key)) queue.current.push(tile);
      }
      queue.current.sort(
        (a, b) => tileDistanceToPoint(a, hereNow) - tileDistanceToPoint(b, hereNow),
      );
    }
    if (skipUpload.current > 0) {
      skipUpload.current -= 1;
      frameMark.tiles = performance.now() - tileStart;
      return;
    }
    const keepKeys = tiles[0]
      ? wantedTileKeys(
          {
            z: Number(tiles[0].key.split('/')[0]),
            x: Number(tiles[0].key.split('/')[1]),
            y: Number(tiles[0].key.split('/')[2]),
          },
          KEEP_RING,
        )
      : tiles.map((tile) => tile.key);
    const upload = uploads.current[0];
    if (upload) {
      if (!cache.current.has(upload.tile.key)) {
        cache.current.set(upload.tile.key, { ...emptyTile(upload.tile.key), lod: upload.packed.lod });
      }
      const built = cache.current.get(upload.tile.key);
      const layer = PACK_LAYERS[upload.layer];
      if (built && layer) {
        applyPackedLayer(built, upload.packed, layer);
        changed = tiles.some((tile) => tile.key === upload.tile.key);
        skipUpload.current = layer === 'buildings' || layer === 'roads' ? 2 : 1;
      }
      upload.layer += 1;
      if (upload.layer >= PACK_LAYERS.length) {
        uploads.current.shift();
        evictTileCache(cache.current, keepKeys, (_key, item) => disposeBuilt(item), MAX_CACHED_TILES);
      }
    } else {
      const budget = slim ? 4 : 6;
      const start = performance.now();
      if (!pending.current) {
        const next = queue.current.shift();
        if (next) {
          const existing = cache.current.get(next.key);
          const wantedLod = tileLodWanted(next, hereNow, existing?.lod);
          const rebuild = stale.current.delete(next.key);
          if (!existing || existing.lod !== wantedLod || rebuild) {
            pending.current = createBuildJob(next, hereNow, wantedLod);
          }
        }
      }
      if (pending.current && performance.now() - start < budget) {
        const current = pending.current;
        const existing = cache.current.get(current.tile.key);
        const replacing = Boolean(existing) && existing !== current.built;
        const result = stepBuildJob(current);
        if (result.done) {
          const nextBuilt = current.built;
          cache.current.set(current.tile.key, nextBuilt);
          if (replacing && existing) disposeBuilt(existing);
          changed = true;
        } else if (!replacing && (result.changed || result.done)) {
          cache.current.set(current.tile.key, current.built);
          changed = true;
        }
        pending.current = result.done ? null : result.job;
        evictTileCache(cache.current, keepKeys, (_key, item) => disposeBuilt(item), MAX_CACHED_TILES);
      }
    }
    const display = new Set(tiles.map((tile) => tile.key));
    if (changed) setReady(Array.from(cache.current.values()).filter((tile) => display.has(tile.key)));
    frameMark.tiles = performance.now() - tileStart;
  });

  useEffect(() => {
    const fog = night ? '#4a5c7a' : '#c8d6e4';
    const far = fogFar(slim);
    scene.background = new Color(fog);
    scene.fog = new Fog(fog, FOG_NEAR, far);
    for (const mat of [facade, asphalt, marked, water, zebra] as { uniforms?: Record<string, { value: unknown }> }[]) {
      if (mat.uniforms?.uFogNear) mat.uniforms.uFogNear.value = FOG_NEAR;
      if (mat.uniforms?.uFogFar) mat.uniforms.uFogFar.value = far;
    }
    gl.setClearColor(fog, 1);
    gl.toneMappingExposure = night ? 1.22 : 0.9;
  }, [asphalt, facade, gl, marked, night, scene, slim, water, zebra]);

  useEffect(() => () => {
    const windows = facade.userData.windows as { dispose?: () => void } | undefined;
    windows?.dispose?.();
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
      <SkyDome key={night ? 'night' : 'day'} night={night} />
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} material={groundMat}>
        <planeGeometry args={[360, 360]} />
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
          {tile.roads && <mesh geometry={tile.roads} material={asphalt} renderOrder={3} />}
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


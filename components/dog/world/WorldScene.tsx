'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  Shape,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lngLatToLocal, sunDirection } from '../../../workers/dog/src/world';
import type { WorldTileData } from './decode';
import { centroid, crossingsAtIntersections, dressPlants, facadeTint, hash2, isMajorRoad, lampsAlongRoads, ringBounds, type Crossing, type Plant } from './dress';

function shapeFrom(ring: { x: number; z: number }[]) {
  const shape = new Shape();
  shape.moveTo(ring[0].x, ring[0].z);
  for (let i = 1; i < ring.length; i += 1) shape.lineTo(ring[i].x, ring[i].z);
  shape.closePath();
  return shape;
}

function mergeAll(geos: BufferGeometry[]) {
  if (!geos.length) return [] as BufferGeometry[];
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged ? [merged] : [];
}

type BuiltTile = {
  key: string;
  buildings: BufferGeometry[];
  roofs: BufferGeometry[];
  parks: BufferGeometry | null;
  water: BufferGeometry | null;
  sidewalks: BufferGeometry | null;
  roads: BufferGeometry | null;
  major: BufferGeometry | null;
};

function disposeBuilt(tile: BuiltTile) {
  tile.buildings.forEach((geo) => geo.dispose());
  tile.roofs.forEach((geo) => geo.dispose());
  tile.parks?.dispose();
  tile.water?.dispose();
  tile.sidewalks?.dispose();
  tile.roads?.dispose();
  tile.major?.dispose();
}

function tileAnchor(tile: WorldTileData) {
  if (tile.labels[0]) return tile.labels[0];
  if (tile.buildings[0]) return centroid(tile.buildings[0].ring);
  if (tile.roads[0]?.line[0]) return tile.roads[0].line[0];
  return { x: 0, z: 0 };
}

function pushBuilding(building: WorldTileData['buildings'][number], walls: BufferGeometry[], roofs: BufferGeometry[], withRoof: boolean) {
  try {
    const height = Math.max(3.2, building.height - building.min);
    const geo = new ExtrudeGeometry(shapeFrom(building.ring), {
      depth: height,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, building.min, 0);
    const mid = centroid(building.ring);
    paintBuilding(geo, facadeTint(mid.x, mid.z), height);
    walls.push(geo);
    if (!withRoof) return;
    const box = ringBounds(building.ring);
    if (box.w > 1.2 && box.d > 1.2) {
      const cap = new BoxGeometry(box.w + 0.2, 0.32, box.d + 0.2);
      cap.translate((box.minX + box.maxX) / 2, building.min + height + 0.1, (box.minZ + box.maxZ) / 2);
      roofs.push(cap);
    }
  } catch {
    // skip a broken ring
  }
}

function paintBuilding(geo: BufferGeometry, tint: readonly number[], height: number) {
  const count = geo.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const heights = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = tint[0];
    colors[i * 3 + 1] = tint[1];
    colors[i * 3 + 2] = tint[2];
    heights[i] = height;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.setAttribute('aHeight', new BufferAttribute(heights, 1));
}

function emptyTile(key: string): BuiltTile {
  return {
    key,
    buildings: [],
    roofs: [],
    parks: null,
    water: null,
    sidewalks: null,
    roads: null,
    major: null,
  };
}

type RibbonCursor = { road: number; seg: number; geos: BufferGeometry[] };

function pushRibbonSegs(tile: WorldTileData, pad: number, y: number, majorOnly: boolean, cursor: RibbonCursor, limit: number) {
  let made = 0;
  while (cursor.road < tile.roads.length && made < limit) {
    const road = tile.roads[cursor.road];
    if (majorOnly && !isMajorRoad(road.width, road.klass)) {
      cursor.road += 1;
      cursor.seg = 1;
      continue;
    }
    if (cursor.seg < 1) cursor.seg = 1;
    while (cursor.seg < road.line.length && made < limit) {
      const a = road.line[cursor.seg - 1];
      const b = road.line[cursor.seg];
      cursor.seg += 1;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.4) continue;
      const half = road.width * 0.5 + pad;
      const nx = (-dz / len) * half;
      const nz = (dx / len) * half;
      const ring = [
        { x: a.x + nx, z: a.z + nz },
        { x: b.x + nx, z: b.z + nz },
        { x: b.x - nx, z: b.z - nz },
        { x: a.x - nx, z: a.z - nz },
      ];
      try {
        const geo = new ExtrudeGeometry(shapeFrom(ring), { depth: 0.05, bevelEnabled: false, curveSegments: 1 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, y, 0);
        const count = geo.getAttribute('position').count;
        const uv = new Float32Array(count * 2);
        const pos = geo.getAttribute('position');
        for (let v = 0; v < count; v += 1) {
          const px = pos.getX(v);
          const pz = pos.getZ(v);
          const along = ((px - a.x) * dx + (pz - a.z) * dz) / (len * len);
          const across = ((px - a.x) * -dz + (pz - a.z) * dx) / (len * half * 2) + 0.5;
          uv[v * 2] = across;
          uv[v * 2 + 1] = along * len;
        }
        geo.setAttribute('uv', new BufferAttribute(uv, 2));
        cursor.geos.push(geo);
        made += 1;
      } catch {
        // skip
      }
    }
    if (cursor.seg >= road.line.length) {
      cursor.road += 1;
      cursor.seg = 1;
    }
  }
  return cursor.road >= tile.roads.length;
}

function takeMerged(geos: BufferGeometry[]) {
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged ?? null;
}

function flattenRings(rings: { x: number; z: number }[][], y = 0.012) {
  const geos: BufferGeometry[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    try {
      const geo = new ExtrudeGeometry(shapeFrom(ring), { depth: 0.04, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, y, 0);
      geos.push(geo);
    } catch {
      // skip
    }
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged;
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
      uSunDir: { value: [0.4, 0.8, 0.2] },
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
    const acrossX = -mark.dz;
    const acrossZ = mark.dx;
    const half = mark.w * 0.5;
    const along = 3.2;
    const ring = [
      { x: mark.x + mark.dx * along + acrossX * half, z: mark.z + mark.dz * along + acrossZ * half },
      { x: mark.x - mark.dx * along + acrossX * half, z: mark.z - mark.dz * along + acrossZ * half },
      { x: mark.x - mark.dx * along - acrossX * half, z: mark.z - mark.dz * along - acrossZ * half },
      { x: mark.x + mark.dx * along - acrossX * half, z: mark.z + mark.dz * along - acrossZ * half },
    ];
    try {
      const geo = new ExtrudeGeometry(shapeFrom(ring), { depth: 0.04, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.012, 0);
      const count = geo.getAttribute('position').count;
      const uv = new Float32Array(count * 2);
      const pos = geo.getAttribute('position');
      for (let v = 0; v < count; v += 1) {
        const px = pos.getX(v) - mark.x;
        const pz = pos.getZ(v) - mark.z;
        uv[v * 2] = (px * acrossX + pz * acrossZ) / mark.w + 0.5;
        uv[v * 2 + 1] = (px * mark.dx + pz * mark.dz) / (along * 2) + 0.5;
      }
      geo.setAttribute('uv', new BufferAttribute(uv, 2));
      geos.push(geo);
    } catch {
      // skip
    }
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
            <meshStandardMaterial color="#6a4a32" />
          </instancedMesh>
          <instancedMesh ref={leaf} args={[undefined, undefined, trees.length]}>
            <coneGeometry args={[1.9, 3.8, 6]} />
            <meshStandardMaterial color={night ? '#7a9a58' : '#4f7a48'} />
          </instancedMesh>
        </>
      )}
      {bushes.length > 0 && (
        <instancedMesh ref={bush} args={[undefined, undefined, bushes.length]}>
          <sphereGeometry args={[0.7, 7, 5]} />
          <meshStandardMaterial color={night ? '#5a7a46' : '#3f6a38'} />
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
        <meshStandardMaterial color={night ? '#3a3a3e' : '#4a4a4c'} metalness={0.3} roughness={0.5} />
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

export default function WorldScene({
  tiles,
  lat,
  lng,
  originLat,
  originLng,
  nightHint,
}: {
  tiles: WorldTileData[];
  lat: number;
  lng: number;
  originLat: number;
  originLng: number;
  nightHint?: boolean;
}) {
  const { scene, gl } = useThree();
  const sun = useMemo(() => sunDirection(lat, lng, Date.now()), [lat, lng]);
  const night = nightHint ?? sun.night;
  const here = useMemo(() => lngLatToLocal(lat, lng, originLat, originLng), [lat, lng, originLat, originLng]);
  const slim = typeof window !== 'undefined' && window.innerWidth < 700;
  const hereRef = useRef(here);
  hereRef.current = here;
  const cache = useRef(new Map<string, BuiltTile>());
  const queue = useRef<WorldTileData[]>([]);
  const pending = useRef<{
    tile: WorldTileData;
    lod: boolean;
    walls: BufferGeometry[];
    roofs: BufferGeometry[];
    index: number;
    list: WorldTileData['buildings'];
    dress: 'buildings' | 'merge' | 'parks' | 'water' | 'sidewalks' | 'roads' | 'major';
    built: BuiltTile;
    ribbon: RibbonCursor | null;
  } | null>(null);
  const [ready, setReady] = useState<BuiltTile[]>([]);

  useEffect(() => {
    const wanted = new Set(tiles.map((tile) => tile.key));
    let removed = false;
    cache.current.forEach((built, key) => {
      if (wanted.has(key)) return;
      disposeBuilt(built);
      cache.current.delete(key);
      removed = true;
    });
    queue.current = queue.current.filter((tile) => wanted.has(tile.key) && !cache.current.has(tile.key));
    if (pending.current && !wanted.has(pending.current.tile.key)) pending.current = null;
    for (const tile of tiles) {
      if (cache.current.has(tile.key)) continue;
      if (queue.current.some((item) => item.key === tile.key)) continue;
      if (pending.current?.tile.key === tile.key) continue;
      queue.current.push(tile);
    }
    if (removed) setReady(Array.from(cache.current.values()));
  }, [tiles]);

  useEffect(() => () => {
    cache.current.forEach(disposeBuilt);
    cache.current.clear();
    queue.current = [];
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
  const benchMat = useMemo(
    () => new MeshStandardMaterial({ color: night ? '#5a4638' : '#8a6a48', roughness: 0.86 }),
    [night],
  );
  useEffect(() => {
    if (facade.uniforms?.uSunDir) {
      facade.uniforms.uSunDir.value = [sun.x, Math.max(0.25, sun.y + (night ? 0.4 : 0)), sun.z];
    }
  }, [facade, night, sun.x, sun.y, sun.z]);

  useFrame((_, dt) => {
    const clock = water.userData.uTime;
    if (clock) clock.value = (clock.value + dt) % 1000;
    const budget = slim ? 5 : 8;
    const start = performance.now();
    let changed = false;
    while (performance.now() - start < budget) {
      if (!pending.current) {
        const next = queue.current.shift();
        if (!next) break;
        if (cache.current.has(next.key)) continue;
        const anchor = tileAnchor(next);
        const lod = Math.hypot(anchor.x - hereRef.current.x, anchor.z - hereRef.current.z) > 88;
        const list = lod
          ? next.buildings.filter((building) => building.area > 28).slice(0, 80)
          : next.buildings.slice(0, 160);
        pending.current = {
          tile: next,
          lod,
          walls: [],
          roofs: [],
          index: 0,
          list,
          dress: 'buildings',
          built: emptyTile(next.key),
          ribbon: null,
        };
      }
      const job = pending.current;
      if (job.dress === 'buildings') {
        const end = Math.min(job.list.length, job.index + 8);
        for (; job.index < end; job.index += 1) {
          pushBuilding(job.list[job.index], job.walls, job.roofs, !job.lod);
        }
        if (job.index < job.list.length) break;
        job.dress = 'merge';
        break;
      }
      if (job.dress === 'merge') {
        if (job.walls.length) {
          job.built.buildings.push(...mergeAll(job.walls.splice(0, 16)));
          break;
        }
        if (job.roofs.length) {
          job.built.roofs.push(...mergeAll(job.roofs.splice(0, 16)));
          break;
        }
        cache.current.set(job.tile.key, job.built);
        changed = true;
        job.dress = 'parks';
        break;
      }
      if (job.dress === 'parks') {
        const rings = job.lod ? job.tile.parks.slice(0, 6) : job.tile.parks.slice(0, 16);
        const cursor = job.ribbon ?? { road: 0, seg: 1, geos: [] };
        const next = Math.min(rings.length, cursor.road + 3);
        const chunk = flattenRings(rings.slice(cursor.road, next), 0.004);
        if (chunk) cursor.geos.push(chunk);
        cursor.road = next;
        job.ribbon = cursor;
        if (cursor.road < rings.length) break;
        job.built.parks = takeMerged(cursor.geos);
        job.dress = 'water';
        job.ribbon = { road: 0, seg: 1, geos: [] };
        break;
      }
      if (job.dress === 'sidewalks' || job.dress === 'roads' || job.dress === 'major') {
        const cursor = job.ribbon ?? { road: 0, seg: 1, geos: [] };
        job.ribbon = cursor;
        const pad = job.dress === 'sidewalks' ? 1.15 : 0;
        const y = job.dress === 'sidewalks' ? 0.002 : job.dress === 'major' ? 0.01 : 0.008;
        const done = pushRibbonSegs(job.tile, pad, y, job.dress === 'major', cursor, 8);
        if (!done) break;
        const merged = takeMerged(cursor.geos);
        if (job.dress === 'sidewalks') job.built.sidewalks = merged;
        else if (job.dress === 'roads') job.built.roads = merged;
        else job.built.major = merged;
        cache.current.set(job.tile.key, { ...job.built });
        changed = true;
        if (job.dress === 'sidewalks') {
          job.dress = 'roads';
          job.ribbon = { road: 0, seg: 1, geos: [] };
          break;
        }
        if (job.dress === 'roads' && !job.lod) {
          job.dress = 'major';
          job.ribbon = { road: 0, seg: 1, geos: [] };
          break;
        }
        pending.current = null;
        break;
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
    benchMat.dispose();
  }, [asphalt, benchMat, facade, groundMat, marked, parkMat, roofMat, walkMat, water, zebra]);

  useEffect(() => () => {
    crossingGeo?.dispose();
  }, [crossingGeo]);

  return (
    <group>
      <SkyDome night={night} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} material={groundMat}>
        <planeGeometry args={[2400, 2400]} />
      </mesh>
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
          {tile.roads && <mesh geometry={tile.roads} material={asphalt} renderOrder={2} />}
          {tile.major && <mesh geometry={tile.major} material={marked} renderOrder={3} />}
          {tile.water && <mesh geometry={tile.water} material={water} />}
          {tile.buildings.map((geo, index) => (
            <mesh key={`${tile.key}-b-${index}`} geometry={geo} material={facade} userData={{ occlude: true }} />
          ))}
          {tile.roofs.map((geo, index) => (
            <mesh key={`${tile.key}-r-${index}`} geometry={geo} material={roofMat} userData={{ occlude: true }} />
          ))}
        </group>
      ))}
      {crossingGeo && <mesh geometry={crossingGeo} material={zebra} />}
      <Forest plants={plants} night={night} />
      {benches.map((bench) => (
        <group key={`bench-${bench.x}:${bench.z}`} position={[bench.x, 0, bench.z]} rotation={[0, hash2(bench.x, bench.z) * Math.PI * 2, 0]}>
          <mesh position={[0, 0.28, 0]} material={benchMat}>
            <boxGeometry args={[1.15, 0.08, 0.38]} />
          </mesh>
          <mesh position={[-0.46, 0.14, 0]} material={benchMat}>
            <boxGeometry args={[0.08, 0.28, 0.34]} />
          </mesh>
          <mesh position={[0.46, 0.14, 0]} material={benchMat}>
            <boxGeometry args={[0.08, 0.28, 0.34]} />
          </mesh>
        </group>
      ))}
      <Lamps lamps={lamps} night={night} />
    </group>
  );
}


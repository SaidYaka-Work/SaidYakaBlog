'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Path,
  Shape,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sunDirection } from '../../../workers/dog/src/world';
import type { WorldTileData } from './decode';

function shapeFrom(ring: { x: number; z: number }[]) {
  const shape = new Shape();
  shape.moveTo(ring[0].x, ring[0].z);
  for (let i = 1; i < ring.length; i += 1) shape.lineTo(ring[i].x, ring[i].z);
  shape.closePath();
  return shape;
}

function extrudeBuildings(tiles: WorldTileData[], lod: boolean) {
  const geos: BufferGeometry[] = [];
  for (const tile of tiles) {
    const list = lod ? tile.buildings.filter((b) => b.area > 80).slice(0, 80) : tile.buildings;
    for (const building of list) {
      try {
        const geo = new ExtrudeGeometry(shapeFrom(building.ring), {
          depth: Math.max(3.2, building.height - building.min),
          bevelEnabled: false,
          curveSegments: 1,
        });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, building.min, 0);
        geos.push(geo);
      } catch {
        // skip a broken ring
      }
    }
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged;
}

function flattenRings(rings: { x: number; z: number }[][]) {
  const geos: BufferGeometry[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    try {
      const shape = shapeFrom(ring);
      if (ring.length > 8) {
        const hole = new Path();
        // keep simple fills; no holes
        void hole;
      }
      const geo = new ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.01, 0);
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

function roadRibbon(tiles: WorldTileData[]) {
  const geos: BufferGeometry[] = [];
  for (const tile of tiles) {
    for (const road of tile.roads) {
      for (let i = 1; i < road.line.length; i += 1) {
        const a = road.line[i - 1];
        const b = road.line[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.4) continue;
        const nx = (-dz / len) * (road.width * 0.5);
        const nz = (dx / len) * (road.width * 0.5);
        const ring = [
          { x: a.x + nx, z: a.z + nz },
          { x: b.x + nx, z: b.z + nz },
          { x: b.x - nx, z: b.z - nz },
          { x: a.x - nx, z: a.z - nz },
        ];
        try {
          const geo = new ExtrudeGeometry(shapeFrom(ring), { depth: 0.05, bevelEnabled: false, curveSegments: 1 });
          geo.rotateX(-Math.PI / 2);
          geo.translate(0, 0.02, 0);
          geos.push(geo);
        } catch {
          // skip
        }
      }
    }
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return merged;
}

export default function WorldScene({
  tiles,
  lat,
  lng,
  nightHint,
}: {
  tiles: WorldTileData[];
  lat: number;
  lng: number;
  nightHint?: boolean;
}) {
  const { scene, gl } = useThree();
  const sun = useMemo(() => sunDirection(lat, lng, Date.now()), [lat, lng]);
  const night = nightHint ?? sun.night;

  const meshes = useMemo(() => {
    const near = tiles;
    return {
      buildings: extrudeBuildings(near, false),
      parks: flattenRings(near.flatMap((tile) => tile.parks)),
      water: flattenRings(near.flatMap((tile) => tile.water)),
      roads: roadRibbon(near),
    };
  }, [tiles]);

  useEffect(() => {
    const sky = night ? '#0e1624' : '#dce6f0';
    scene.background = new Color(sky);
    gl.setClearColor(sky, 1);
    return () => {
      meshes.buildings?.dispose();
      meshes.parks?.dispose();
      meshes.water?.dispose();
      meshes.roads?.dispose();
    };
  }, [gl, meshes, night, scene]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color={night ? '#1a1e18' : '#d8c4a4'} />
      </mesh>
      <hemisphereLight args={[night ? '#6a7a98' : '#fff4e6', night ? '#14120e' : '#c8b090', night ? 0.55 : 0.95]} />
      <directionalLight
        position={[sun.x, sun.y, sun.z]}
        intensity={night ? 0.28 : 1.05}
        color={night ? '#c8d4f0' : '#ffe4c4'}
      />
      {meshes.parks && (
        <mesh geometry={meshes.parks} receiveShadow>
          <meshStandardMaterial color={night ? '#2a3a28' : '#9cba7a'} />
        </mesh>
      )}
      {meshes.water && (
        <mesh geometry={meshes.water}>
          <meshStandardMaterial color={night ? '#1a3048' : '#7aa4c4'} roughness={0.18} metalness={0.12} />
        </mesh>
      )}
      {meshes.roads && (
        <mesh geometry={meshes.roads} receiveShadow>
          <meshStandardMaterial color={night ? '#2a2a2c' : '#c4b8a8'} />
        </mesh>
      )}
      {meshes.buildings && (
        <mesh geometry={meshes.buildings} castShadow>
          <meshStandardMaterial color={night ? '#6a5a4e' : '#efe4d4'} roughness={0.62} side={DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

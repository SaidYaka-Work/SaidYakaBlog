'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BackSide, CanvasTexture, Color, SRGBColorSpace } from 'three';
import { BED, BLOCKERS, FEEDER, ROOM_HALF } from '../../workers/dog/src/room';

function makeRugTexture(fill: string, ring: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0, Math.PI * 2);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function FenceRing({ night }: { night: boolean }) {
  const wood = night ? '#3a2a20' : '#8a6a48';
  const span = ROOM_HALF * 2 + 0.16;
  const posts = [-3, -1.8, -0.6, 0.6, 1.8, 3];
  const sides = [
    { pos: [0, 0, -ROOM_HALF] as const, rot: 0 },
    { pos: [0, 0, ROOM_HALF] as const, rot: 0 },
    { pos: [-ROOM_HALF, 0, 0] as const, rot: Math.PI / 2 },
    { pos: [ROOM_HALF, 0, 0] as const, rot: Math.PI / 2 },
  ];
  return (
    <group>
      {sides.map((side) => (
        <group key={`${side.pos[0]}-${side.pos[2]}`} position={[...side.pos]} rotation={[0, side.rot, 0]}>
          <mesh position={[0, 0.46, 0]}>
            <boxGeometry args={[span, 0.05, 0.06]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[span, 0.05, 0.06]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          {posts.map((x) => (
            <mesh key={x} position={[x, 0.36, 0]}>
              <boxGeometry args={[0.07, 0.72, 0.07]} />
              <meshStandardMaterial color={wood} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function DogBed({ night }: { night: boolean }) {
  return (
    <group position={[BED.x, 0, BED.z]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0.2]} receiveShadow>
        <circleGeometry args={[0.52, 20]} />
        <meshStandardMaterial color={night ? '#4a2c22' : '#8b4a32'} />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.44, 0.1, 18]} />
        <meshStandardMaterial color={night ? '#6a3a28' : '#c46a3a'} />
      </mesh>
      <mesh position={[0.02, 0.14, -0.02]} castShadow>
        <sphereGeometry args={[0.28, 14, 10]} />
        <meshStandardMaterial color={night ? '#7a4a34' : '#e0a07a'} />
      </mesh>
    </group>
  );
}

function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.24, 10]} />
        <meshStandardMaterial color="#c46a3a" />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color="#4a6a48" />
      </mesh>
      <mesh position={[0.1, 0.6, 0.08]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#3d5a42" />
      </mesh>
    </group>
  );
}

export default function PorchWorld({
  night,
  showBowl,
  compact = false,
  food = false,
}: {
  night: boolean;
  showBowl: boolean;
  compact?: boolean;
  walking?: boolean;
  food?: boolean;
}) {
  const { scene, gl } = useThree();
  const rug = useMemo(
    () => makeRugTexture(night ? '#8a3a18' : '#c46a3a', '#e08a5a'),
    [night],
  );

  useEffect(() => {
    const sky = night ? '#101828' : '#e8eef6';
    scene.background = new Color(sky);
    gl.setClearColor(sky, 1);
  }, [gl, night, scene]);

  const size = ROOM_HALF * 2 + 0.5;

  return (
    <group>
      <mesh>
        <sphereGeometry args={[28, 24, 16]} />
        <meshBasicMaterial color={night ? '#101828' : '#e8eef6'} side={BackSide} />
      </mesh>
      <hemisphereLight args={[night ? '#6a7a98' : '#fff6ea', night ? '#1a1814' : '#d4b496', night ? 0.7 : 1.05]} />
      <directionalLight
        position={[5, 7, 3.5]}
        intensity={night ? 0.45 : 1}
        color={night ? '#c8d4f0' : '#ffe6c4'}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={18}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-3.5, 2.2, 1.5]} intensity={night ? 0.08 : 0.16} color="#f0d0b0" />
      {!compact && <pointLight position={[1.4, 1.6, 1.2]} intensity={night ? 1.2 : 0.3} color="#fbe8c8" distance={7} />}
      {!compact && <pointLight position={[-1.4, 1.1, 1.3]} intensity={night ? 0.7 : 0.22} color="#ffd8b0" distance={5} />}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={night ? '#1c2018' : '#e2b892'} />
      </mesh>
      {rug && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.02, 0.012, 0.08]} receiveShadow>
          <planeGeometry args={[1.9, 1.9]} />
          <meshBasicMaterial map={rug} transparent />
        </mesh>
      )}

      {!compact && <FenceRing night={night} />}
      {!compact && <DogBed night={night} />}
      {!compact && <Plant x={BLOCKERS[0].x} z={BLOCKERS[0].z} />}
      {!compact && <Plant x={BLOCKERS[1].x} z={BLOCKERS[1].z} />}

      {!compact && (
        <mesh position={[BLOCKERS[2].x, 0.12, BLOCKERS[2].z]} castShadow>
          <sphereGeometry args={[0.16, 14, 14]} />
          <meshStandardMaterial color={night ? '#7a3a28' : '#d45a3a'} />
        </mesh>
      )}

      <group position={[FEEDER.x, FEEDER.y, FEEDER.z]} visible={showBowl || !compact}>
        <mesh position={[0, -0.02, 0.32]} receiveShadow>
          <boxGeometry args={[0.7, 0.04, 0.7]} />
          <meshStandardMaterial color={night ? '#3a2a20' : '#b88858'} />
        </mesh>
        <mesh castShadow>
          <cylinderGeometry args={[0.22, 0.17, 0.1, 16]} />
          <meshStandardMaterial color="#c46a3a" />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.03, 16]} />
          <meshStandardMaterial color={food ? '#d4a05a' : '#e8c4a0'} />
        </mesh>
      </group>
    </group>
  );
}

'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Group } from 'three';
import { BOWL } from './frame';

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

function HorizonFence({ night }: { night: boolean }) {
  const wood = night ? '#3a2a20' : '#8a6a48';
  const posts = [-3.2, -1.9, -0.6, 0.7, 2, 3.3];
  return (
    <group position={[0, 0, -3.35]}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[7.2, 0.04, 0.04]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[7.2, 0.04, 0.04]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      {posts.map((x) => (
        <mesh key={x} position={[x, 0.32, 0]}>
          <boxGeometry args={[0.06, 0.64, 0.06]} />
          <meshStandardMaterial color={wood} />
        </mesh>
      ))}
    </group>
  );
}

export default function PorchWorld({
  night,
  showBowl,
  compact = false,
  walking = false,
}: {
  night: boolean;
  showBowl: boolean;
  compact?: boolean;
  walking?: boolean;
}) {
  const hills = useRef<Group>(null);
  const { scene, gl } = useThree();
  const rug = useMemo(
    () => makeRugTexture(night ? '#8a3a18' : '#c46a3a', '#e08a5a'),
    [night],
  );

  useEffect(() => {
    scene.background = null;
    gl.setClearColor(0x000000, 0);
  }, [gl, scene]);

  useFrame((_, dt) => {
    if (!hills.current) return;
    if (walking) {
      hills.current.position.x -= dt * 0.35;
      if (hills.current.position.x < -1.6) hills.current.position.x += 1.6;
    } else {
      hills.current.position.x += (0 - hills.current.position.x) * 0.04;
    }
  });

  return (
    <group>
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color={night ? '#141820' : '#e2b892'} />
      </mesh>
      {rug && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.02, 0.012, 0.08]} receiveShadow>
          <planeGeometry args={[2.24, 2.24]} />
          <meshBasicMaterial map={rug} transparent />
        </mesh>
      )}

      {!compact && <HorizonFence night={night} />}

      <group ref={hills}>
        <mesh position={[-2.4, 0.04, -3.9]} scale={[1, 0.38, 1]}>
          <sphereGeometry args={[0.7, 12, 10]} />
          <meshStandardMaterial color={night ? '#243044' : '#d8c8b0'} />
        </mesh>
        <mesh position={[2.1, 0.03, -4.1]} scale={[1, 0.34, 1]}>
          <sphereGeometry args={[0.86, 12, 10]} />
          <meshStandardMaterial color={night ? '#1e2838' : '#d0bea4'} />
        </mesh>
      </group>

      {!compact && (
        <>
          <mesh position={[1.55, 0.28, -0.85]} castShadow>
            <cylinderGeometry args={[0.14, 0.18, 0.28, 10]} />
            <meshStandardMaterial color="#c46a3a" />
          </mesh>
          <mesh position={[1.55, 0.64, -0.85]} castShadow>
            <sphereGeometry args={[0.26, 12, 12]} />
            <meshStandardMaterial color="#4a6a48" />
          </mesh>
          <mesh position={[1.66, 0.78, -0.74]}>
            <sphereGeometry args={[0.16, 10, 10]} />
            <meshStandardMaterial color="#3d5a42" />
          </mesh>
        </>
      )}

      <group position={[BOWL.x, BOWL.y, BOWL.z]} visible={showBowl || !compact}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.16, 0.09, 16]} />
          <meshStandardMaterial color="#c46a3a" />
        </mesh>
        <mesh position={[0, 0.035, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.02, 16]} />
          <meshStandardMaterial color="#e8c4a0" />
        </mesh>
      </group>
    </group>
  );
}

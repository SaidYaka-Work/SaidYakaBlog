'use client';

import { useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { useRef } from 'react';
import type { Group } from 'three';
import { localSky, type SkyMood } from './look';

const SKY: Record<SkyMood, string> = {
  dawn: '#f6c8b0',
  day: '#f8ead6',
  dusk: '#f0a878',
  night: '#1c1816',
};

export default function PorchWorld({
  night,
  showBowl,
  compact = false,
}: {
  night: boolean;
  showBowl: boolean;
  compact?: boolean;
}) {
  const sky = night ? 'night' : localSky();
  const sway = useRef<Group>(null);

  useFrame((state) => {
    if (compact) return;
    const t = state.clock.elapsedTime;
    state.camera.position.x = 3.35 + Math.sin(t * 0.16) * 0.14;
    state.camera.position.y = 2.05 + Math.sin(t * 0.12) * 0.06;
    state.camera.position.z = 4.15 + Math.cos(t * 0.1) * 0.08;
    state.camera.lookAt(0.1, 1.15, 0.2);
    if (sway.current) sway.current.position.x = Math.sin(t * 0.2) * 0.03;
  });

  return (
    <group ref={sway}>
      <color attach="background" args={[SKY[sky]]} />
      <hemisphereLight args={[night ? '#4a3a32' : '#fff4e6', night ? '#16120f' : '#c4a888', night ? 0.35 : 0.85]} />
      <directionalLight
        position={[4.5, 6.5, 3]}
        intensity={night ? 0.28 : 1.15}
        color={night ? '#e8a87c' : '#ffe7c4'}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3, 2.4, -2]} intensity={night ? 0.08 : 0.28} color="#c47848" />
      {!compact && <pointLight position={[-2.6, 1.8, 0.2]} intensity={night ? 3.2 : 0.6} color="#fbe8c8" distance={6} />}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color={night ? '#2a221c' : '#f3e6d4'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.15, 0.01, 0.35]} receiveShadow>
        <circleGeometry args={[1.55, 32]} />
        <meshStandardMaterial color={night ? '#8a3a18' : '#c46a3a'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.15, 0.015, 0.35]}>
        <ringGeometry args={[1.15, 1.28, 32]} />
        <meshStandardMaterial color="#e08a5a" />
      </mesh>

      {!compact && (
        <>
          <mesh position={[-3.1, 1.4, -0.4]} castShadow>
            <boxGeometry args={[0.28, 2.8, 4.2]} />
            <meshStandardMaterial color={night ? '#2a221c' : '#f7efe4'} />
          </mesh>
          <mesh position={[-2.94, 1.55, 0.15]}>
            <boxGeometry args={[0.08, 1.1, 1.3]} />
            <meshStandardMaterial color="#c46a3a" emissive={night ? '#e8a87c' : '#fbe8c8'} emissiveIntensity={night ? 0.8 : 0.15} />
          </mesh>
          <mesh position={[-2.2, 0.85, 2.1]} castShadow>
            <boxGeometry args={[0.14, 1.7, 0.14]} />
            <meshStandardMaterial color="#e8d4bc" />
          </mesh>
          <mesh position={[2.4, 0.85, 2.15]} castShadow>
            <boxGeometry args={[0.14, 1.7, 0.14]} />
            <meshStandardMaterial color="#e8d4bc" />
          </mesh>
          <mesh position={[0.1, 1.55, 2.15]}>
            <boxGeometry args={[4.6, 0.08, 0.08]} />
            <meshStandardMaterial color="#c47848" />
          </mesh>
          <mesh position={[2.7, 0.28, -1.3]} castShadow>
            <cylinderGeometry args={[0.18, 0.22, 0.36, 10]} />
            <meshStandardMaterial color="#c46a3a" />
          </mesh>
          <mesh position={[2.7, 0.7, -1.3]}>
            <sphereGeometry args={[0.28, 10, 10]} />
            <meshStandardMaterial color="#4a6a48" />
          </mesh>
        </>
      )}

      {showBowl && (
        <group position={[1.15, 0.08, 1.05]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.18, 0.1, 16]} />
            <meshStandardMaterial color="#c46a3a" />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
            <meshStandardMaterial color="#e8c4a0" />
          </mesh>
        </group>
      )}

      <ContactShadows position={[0, 0.002, 0]} opacity={night ? 0.45 : 0.28} scale={6} blur={2.2} far={2.8} />
    </group>
  );
}

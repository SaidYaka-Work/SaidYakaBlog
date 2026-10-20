'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, Color, ShaderMaterial } from 'three';
import type { Group } from 'three';
import { localSky, type SkyMood } from './look';

const SKY: Record<SkyMood, { top: string; bot: string }> = {
  dawn: { top: '#f3d8c6', bot: '#edd0b8' },
  day: { top: '#e8eef6', bot: '#f3d6bc' },
  dusk: { top: '#e8c4a8', bot: '#dca888' },
  night: { top: '#1e1c22', bot: '#141210' },
};

function GradientSky({ mood }: { mood: SkyMood }) {
  const material = useMemo(() => {
    const colors = SKY[mood];
    return new ShaderMaterial({
      uniforms: {
        uTop: { value: new Color(colors.top) },
        uBot: { value: new Color(colors.bot) },
      },
      vertexShader: `
        varying float vH;
        void main() {
          vH = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBot;
        varying float vH;
        void main() {
          float h = smoothstep(-0.25, 0.72, vH);
          gl_FragColor = vec4(mix(uBot, uTop, h), 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
    });
  }, [mood]);
  return (
    <mesh material={material} scale={[-1, 1, 1]}>
      <sphereGeometry args={[22, 24, 16]} />
    </mesh>
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
  const mood = night ? 'night' : localSky();
  const hills = useRef<Group>(null);
  const { scene, gl } = useThree();
  const sky = SKY[mood];

  useEffect(() => {
    scene.background = new Color(sky.bot);
    gl.setClearColor(sky.bot, 1);
  }, [gl, scene, sky.bot]);

  useFrame((_, dt) => {
    if (!hills.current) return;
    if (walking) {
      hills.current.position.x -= dt * 0.7;
      if (hills.current.position.x < -2.4) hills.current.position.x += 2.4;
    } else {
      hills.current.position.x += (0 - hills.current.position.x) * 0.04;
    }
  });

  return (
    <group>
      <GradientSky mood={mood} />
      <hemisphereLight args={[night ? '#7a5a48' : '#fff6ea', night ? '#2a221c' : '#d4b496', night ? 0.75 : 1.1]} />
      <directionalLight
        position={[5, 7, 3.5]}
        intensity={night ? 0.5 : 1.05}
        color={night ? '#e8a87c' : '#ffe6c4'}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={18}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-3.5, 2.2, 1.5]} intensity={night ? 0.12 : 0.32} color="#e08a5a" />
      {!compact && <pointLight position={[1.4, 1.6, 1.2]} intensity={night ? 1.6 : 0.35} color="#fbe8c8" distance={7} />}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[4.2, 48]} />
        <meshStandardMaterial color={night ? '#2a221c' : '#f0e0cc'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.08, 0.012, 0.12]} receiveShadow>
        <circleGeometry args={[1.35, 40]} />
        <meshStandardMaterial color={night ? '#8a3a18' : '#c46a3a'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.08, 0.016, 0.12]}>
        <ringGeometry args={[1.02, 1.16, 40]} />
        <meshStandardMaterial color="#e08a5a" />
      </mesh>

      <group ref={hills}>
        <mesh position={[-1.8, 0.12, -2.4]} rotation={[-0.1, 0.2, 0]}>
          <sphereGeometry args={[0.95, 16, 12]} />
          <meshStandardMaterial color={night ? '#3d2c22' : '#e2c4a8'} />
        </mesh>
        <mesh position={[1.6, 0.1, -2.6]}>
          <sphereGeometry args={[1.15, 16, 12]} />
          <meshStandardMaterial color={night ? '#32261e' : '#d8b496'} />
        </mesh>
      </group>

      {!compact && (
        <>
          <mesh position={[-1.55, 0.28, -0.95]} castShadow>
            <cylinderGeometry args={[0.14, 0.18, 0.28, 10]} />
            <meshStandardMaterial color="#c46a3a" />
          </mesh>
          <mesh position={[-1.55, 0.64, -0.95]} castShadow>
            <sphereGeometry args={[0.26, 12, 12]} />
            <meshStandardMaterial color="#4a6a48" />
          </mesh>
          <mesh position={[-1.66, 0.78, -0.84]}>
            <sphereGeometry args={[0.16, 10, 10]} />
            <meshStandardMaterial color="#3d5a42" />
          </mesh>
        </>
      )}

      <group position={[0.95, 0.07, 0.82]} visible={showBowl || !compact}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.16, 0.09, 16]} />
          <meshStandardMaterial color="#c46a3a" />
        </mesh>
        <mesh position={[0, 0.035, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.02, 16]} />
          <meshStandardMaterial color="#e8c4a0" />
        </mesh>
      </group>

      <ContactShadows position={[0, 0.003, 0]} opacity={night ? 0.4 : 0.22} scale={7} blur={2.6} far={3} />
    </group>
  );
}

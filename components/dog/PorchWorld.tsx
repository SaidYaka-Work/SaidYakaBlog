'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { Color, ShaderMaterial } from 'three';
import type { Group } from 'three';
import type { SkyMood } from './look';
import { BOWL } from './frame';

const SKY: Record<SkyMood, { top: string; bot: string }> = {
  dawn: { top: '#f6e6d6', bot: '#f0c8a8' },
  day: { top: '#f7f1e6', bot: '#f3d2b0' },
  dusk: { top: '#e8c4b0', bot: '#d89878' },
  night: { top: '#0b1220', bot: '#1a2438' },
};

function SkyBackdrop({ mood }: { mood: SkyMood }) {
  const material = useMemo(() => {
    const colors = SKY[mood];
    return new ShaderMaterial({
      uniforms: {
        uTop: { value: new Color(colors.top) },
        uBot: { value: new Color(colors.bot) },
        uLine: { value: new Color(mood === 'night' ? '#243044' : '#c9a888') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.999, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBot;
        uniform vec3 uLine;
        varying vec2 vUv;
        void main() {
          float h = smoothstep(0.0, 0.74, vUv.y);
          vec3 col = mix(uBot, uTop, h);
          float horizon = smoothstep(0.26, 0.3, vUv.y) * (1.0 - smoothstep(0.3, 0.34, vUv.y));
          col = mix(col, uLine, horizon * 0.4);
          float star = 0.0;
          if (uTop.b > 0.12 && uTop.r < 0.2) {
            vec2 g = floor(vUv * vec2(42.0, 24.0));
            float n = fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453);
            star = step(0.93, n) * step(0.52, vUv.y);
          }
          col = mix(col, vec3(0.91, 0.93, 0.97), star);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false,
    });
  }, [mood]);

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
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
  const mood = night ? 'night' : 'day';
  const hills = useRef<Group>(null);
  const { scene, gl } = useThree();
  const sky = SKY[mood];

  useEffect(() => {
    scene.background = new Color(sky.top);
    gl.setClearColor(sky.top, 1);
  }, [gl, scene, sky.top]);

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
      <SkyBackdrop mood={mood} />
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
      <directionalLight position={[-3.5, 2.2, 1.5]} intensity={night ? 0.1 : 0.28} color="#e08a5a" />
      {!compact && <pointLight position={[1.4, 1.6, 1.2]} intensity={night ? 1.2 : 0.3} color="#fbe8c8" distance={7} />}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color={night ? '#1c1a18' : '#efe2d0'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.02, 0.012, 0.08]} receiveShadow>
        <circleGeometry args={[1.32, 40]} />
        <meshStandardMaterial color={night ? '#8a3a18' : '#c46a3a'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.02, 0.016, 0.08]}>
        <ringGeometry args={[1, 1.14, 40]} />
        <meshStandardMaterial color="#e08a5a" />
      </mesh>

      {!compact && <HorizonFence night={night} />}

      <group ref={hills}>
        <mesh position={[-2.4, 0.08, -3.9]}>
          <sphereGeometry args={[0.55, 12, 10]} />
          <meshStandardMaterial color={night ? '#243044' : '#d8c8b0'} />
        </mesh>
        <mesh position={[2.1, 0.06, -4.1]}>
          <sphereGeometry args={[0.7, 12, 10]} />
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

      <ContactShadows position={[0, 0.003, 0]} opacity={night ? 0.4 : 0.22} scale={7} blur={2.6} far={3} />
    </group>
  );
}

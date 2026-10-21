'use client';

import { Html } from '@react-three/drei';
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

function FenceSide({
  wood,
  span,
  posts,
  gap = 0,
}: {
  wood: string;
  span: number;
  posts: number[];
  gap?: number;
}) {
  const rail = gap > 0 ? (span - gap * 2) / 2 : span;
  const offset = gap > 0 ? (rail + gap * 2) / 2 : 0;
  return (
    <>
      {gap > 0 ? (
        <>
          <mesh position={[-offset, 0.46, 0]}>
            <boxGeometry args={[rail, 0.05, 0.06]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[offset, 0.46, 0]}>
            <boxGeometry args={[rail, 0.05, 0.06]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[-offset, 0.24, 0]}>
            <boxGeometry args={[rail, 0.05, 0.06]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[offset, 0.24, 0]}>
            <boxGeometry args={[rail, 0.05, 0.06]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[-gap, 0.42, 0]}>
            <boxGeometry args={[0.08, 0.84, 0.08]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[gap, 0.42, 0]}>
            <boxGeometry args={[0.08, 0.84, 0.08]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0, 0.86, 0]}>
            <boxGeometry args={[gap * 2 + 0.16, 0.07, 0.07]} />
            <meshStandardMaterial color={wood} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.46, 0]}>
            <boxGeometry args={[span, 0.05, 0.06]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[span, 0.05, 0.06]} />
            <meshStandardMaterial color={wood} />
          </mesh>
        </>
      )}
      {posts.filter((x) => Math.abs(x) >= gap + 0.15).map((x) => (
        <mesh key={x} position={[x, 0.36, 0]}>
          <boxGeometry args={[0.07, 0.72, 0.07]} />
          <meshStandardMaterial color={wood} />
        </mesh>
      ))}
    </>
  );
}

function PorchLamp({ night }: { night: boolean }) {
  return (
    <group position={[-2.55, 0, -2.55]}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 2.1, 8]} />
        <meshStandardMaterial color={night ? '#4a4038' : '#6a5850'} metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0.18, 2.02, 0]} castShadow>
        <boxGeometry args={[0.42, 0.05, 0.07]} />
        <meshStandardMaterial color={night ? '#4a4038' : '#6a5850'} />
      </mesh>
      <mesh position={[0.34, 1.88, 0]}>
        <boxGeometry args={[0.22, 0.28, 0.22]} />
        <meshStandardMaterial
          color={night ? '#f6d090' : '#f0e0b8'}
          emissive={night ? '#ffb85a' : '#000000'}
          emissiveIntensity={night ? 1.4 : 0}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0.34, 1.88, 0]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshBasicMaterial color={night ? '#ffe6b0' : '#f8ecd0'} />
      </mesh>
      {night && <pointLight position={[0.34, 1.9, 0]} color="#ffc878" intensity={2.4} distance={8.5} decay={2} />}
    </group>
  );
}

function FenceRing({ night, gate = false }: { night: boolean; gate?: boolean }) {
  const wood = night ? '#6a4e38' : '#8a6a48';
  const span = ROOM_HALF * 2 + 0.16;
  const posts = [-3, -1.8, -0.6, 0.6, 1.8, 3];
  const sides = [
    { pos: [0, 0, -ROOM_HALF] as const, rot: 0, gap: gate ? 0.62 : 0 },
    { pos: [0, 0, ROOM_HALF] as const, rot: 0, gap: 0 },
    { pos: [-ROOM_HALF, 0, 0] as const, rot: Math.PI / 2, gap: 0 },
    { pos: [ROOM_HALF, 0, 0] as const, rot: Math.PI / 2, gap: 0 },
  ];
  return (
    <group>
      {sides.map((side) => (
        <group key={`${side.pos[0]}-${side.pos[2]}`} position={[...side.pos]} rotation={[0, side.rot, 0]}>
          <FenceSide wood={wood} span={span} posts={posts} gap={side.gap} />
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
        <meshStandardMaterial color={night ? '#6a3c2c' : '#8b4a32'} />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.44, 0.1, 18]} />
        <meshStandardMaterial color={night ? '#8a4a32' : '#c46a3a'} />
      </mesh>
      <mesh position={[0.02, 0.14, -0.02]} castShadow>
        <sphereGeometry args={[0.28, 14, 10]} />
        <meshStandardMaterial color={night ? '#9a5c40' : '#e0a07a'} />
      </mesh>
    </group>
  );
}

function FeederStation({ night, food, near }: { night: boolean; food: boolean; near: boolean }) {
  const wood = night ? '#5a4030' : '#a87848';
  const enamel = night ? '#d4c4aa' : '#f3e6d0';
  const trim = night ? '#b05a32' : '#c46a3a';
  return (
    <group position={[FEEDER.x, 0, FEEDER.z]}>
      <mesh position={[0, 0.025, 0.1]} receiveShadow>
        <boxGeometry args={[0.92, 0.05, 0.84]} />
        <meshStandardMaterial color={wood} roughness={0.72} />
      </mesh>
      <mesh position={[-0.16, 0.28, -0.18]} castShadow>
        <boxGeometry args={[0.07, 0.5, 0.07]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[0.16, 0.28, -0.18]} castShadow>
        <boxGeometry args={[0.07, 0.5, 0.07]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[0, 0.52, -0.16]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.28]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[0, 0.78, -0.14]} castShadow>
        <boxGeometry args={[0.38, 0.36, 0.3]} />
        <meshStandardMaterial color={enamel} roughness={0.38} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.98, -0.14]} castShadow>
        <boxGeometry args={[0.42, 0.06, 0.34]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position={[0, 0.58, 0.02]} rotation={[0.55, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.08, 0.22]} />
        <meshStandardMaterial color={night ? '#6a6a70' : '#9aa0a6'} metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.12, 0.2]} castShadow>
        <cylinderGeometry args={[0.24, 0.18, 0.1, 20]} />
        <meshStandardMaterial color={trim} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.16, 0.2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.03, 18]} />
        <meshStandardMaterial color={food ? '#d4a05a' : '#efe0c8'} />
      </mesh>
      {food && (
        <>
          <mesh position={[-0.04, 0.18, 0.18]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#c48a3a" />
          </mesh>
          <mesh position={[0.05, 0.18, 0.22]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#b87832" />
          </mesh>
        </>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0.12]}>
        <ringGeometry args={[0.3, 0.5, 28]} />
        <meshBasicMaterial color="#ffc078" transparent opacity={near ? 0.62 : 0.14} />
      </mesh>
      {near && <pointLight position={[0, 0.7, 0.15]} intensity={0.85} color="#ffd8a0" distance={2.4} />}
      {near && (
        <Html position={[0, 1.22, 0.08]} center sprite occlude={false} style={{ pointerEvents: 'none' }}>
          <span className="dog-feed-key">E</span>
        </Html>
      )}
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
  near = false,
  gate = false,
}: {
  night: boolean;
  showBowl: boolean;
  compact?: boolean;
  walking?: boolean;
  food?: boolean;
  near?: boolean;
  gate?: boolean;
}) {
  const { scene, gl } = useThree();
  const rug = useMemo(
    () => makeRugTexture(night ? '#8a3a18' : '#c46a3a', '#e08a5a'),
    [night],
  );

  useEffect(() => {
    const sky = night ? '#3a5078' : '#e8eef6';
    scene.background = new Color(sky);
    gl.setClearColor(sky, 1);
    gl.toneMappingExposure = night ? 1.18 : 0.92;
  }, [gl, night, scene]);

  const size = ROOM_HALF * 2 + 0.5;

  return (
    <group>
      <mesh>
        <sphereGeometry args={[36, 24, 16]} />
        <shaderMaterial
          side={BackSide}
          depthWrite={false}
          uniforms={{
            uTop: { value: new Color(night ? '#2e4a74' : '#c5d8ec') },
            uHorizon: { value: new Color(night ? '#7a6888' : '#f3d8bc') },
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
            varying vec3 vPos;
            void main() {
              float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
              gl_FragColor = vec4(mix(uHorizon, uTop, pow(h, 0.85)), 1.0);
            }
          `}
        />
      </mesh>
      <ambientLight intensity={night ? 0.58 : 0.28} color={night ? '#b4c6e4' : '#fff4e6'} />
      <hemisphereLight args={[night ? '#a8c4ee' : '#fff6ea', night ? '#3a342c' : '#d4b496', night ? 1.25 : 0.95]} />
      <directionalLight
        position={[5, 7, 3.5]}
        intensity={night ? 0.82 : 0.88}
        color={night ? '#d4e2f8' : '#ffe6c4'}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={18}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-3.5, 2.2, 1.5]} intensity={night ? 0.22 : 0.14} color="#f0d0b0" />
      {!compact && <PorchLamp night={night} />}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={night ? '#4a5040' : '#e2b892'} />
      </mesh>
      {rug && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.02, 0.012, 0.08]} receiveShadow>
          <planeGeometry args={[1.9, 1.9]} />
          <meshBasicMaterial map={rug} transparent />
        </mesh>
      )}

      {!compact && <FenceRing night={night} gate={gate} />}
      {!compact && <DogBed night={night} />}
      {!compact && <Plant x={BLOCKERS[0].x} z={BLOCKERS[0].z} />}
      {!compact && <Plant x={BLOCKERS[1].x} z={BLOCKERS[1].z} />}

      {!compact && (
        <mesh position={[BLOCKERS[2].x, 0.12, BLOCKERS[2].z]} castShadow>
          <sphereGeometry args={[0.16, 14, 14]} />
          <meshStandardMaterial color={night ? '#7a3a28' : '#d45a3a'} />
        </mesh>
      )}

      {(showBowl || !compact) && <FeederStation night={night} food={food} near={near && !compact} />}
    </group>
  );
}

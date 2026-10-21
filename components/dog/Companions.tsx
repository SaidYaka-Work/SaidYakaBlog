'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Group, Mesh, Vector3 } from 'three';
import type { DogCompanion, DogEmote } from '@/lib/dog';
import { EMOTE_SET } from './emotes';

const EMOTE_MARK = Object.fromEntries(EMOTE_SET.map((item) => [item.kind, item])) as Record<
  DogEmote,
  { kind: DogEmote; label: string; color: string }
>;

const PASTELS = ['#f4b48a', '#7ed9b0', '#c6b4f4', '#f2d06a', '#f2a0b8', '#8ec8ea'] as const;

function hash01(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i += 1) n = (n * 33 + id.charCodeAt(i)) >>> 0;
  return (n % 10_000) / 10_000;
}

function pastelFromId(id: string, night: boolean) {
  const slot = Math.floor(hash01(id) * 17 + hash01(`${id}:hue`) * 11) % PASTELS.length;
  const coat = new Color(PASTELS[slot]);
  if (night) coat.offsetHSL(0, 0.06, 0.08);
  return coat;
}

function EmoteBurst({ kind }: { kind: DogEmote }) {
  const bits = useRef<(Mesh | null)[]>([]);
  const born = useRef(0);
  const mark = EMOTE_MARK[kind];
  useFrame((state) => {
    if (!born.current) born.current = state.clock.elapsedTime;
    const age = state.clock.elapsedTime - born.current;
    bits.current.forEach((mesh, i) => {
      if (!mesh) return;
      const ang = (i / 10) * Math.PI * 2 + 0.4;
      const lift = 0.18 + age * 0.42;
      const rad = 0.12 + age * 0.58;
      mesh.position.set(Math.cos(ang) * rad, lift, Math.sin(ang) * rad);
      const fade = Math.max(0, 1 - age / 1.15);
      mesh.scale.setScalar(0.55 + fade * 0.7);
      const mat = mesh.material as { opacity?: number };
      if (typeof mat.opacity === 'number') mat.opacity = fade;
    });
  });
  return (
    <group position={[0, 0.38, 0]}>
      <Html center distanceFactor={5.2} style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <div className="dog-emote-pop" aria-hidden="true">
          {mark.label}
        </div>
      </Html>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} ref={(node) => { bits.current[i] = node; }}>
          <sphereGeometry args={[0.028, 7, 7]} />
          <meshBasicMaterial color={mark.color} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function PawMark({ color, opacity }: { color: Color; opacity: number }) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <mesh position={[0, -0.01, 0]}>
        <circleGeometry args={[0.055, 10]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {[
        [-0.05, 0.07],
        [0.05, 0.07],
        [-0.09, 0.03],
        [0.09, 0.03],
      ].map(([x, y]) => (
        <mesh key={`${x}:${y}`} position={[x, y, 0]}>
          <circleGeometry args={[0.022, 8]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Spirit({
  companion,
  night,
  you,
  lookAt,
}: {
  companion: DogCompanion;
  night: boolean;
  you: boolean;
  lookAt: { x: number; z: number };
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const crumbs = useRef<(Group | null)[]>([]);
  const last = useRef(new Vector3(companion.x, 0, companion.z));
  const history = useRef<Vector3[]>([]);
  const coat = useMemo(() => pastelFromId(companion.id, night), [companion.id, night]);
  const glow = useMemo(() => coat.clone().offsetHSL(0, 0.08, 0.16), [coat]);
  const blush = useMemo(() => coat.clone().offsetHSL(-0.02, 0.22, -0.08), [coat]);
  const phase = hash01(companion.id) * Math.PI * 2;

  useFrame((state, dt) => {
    const group = root.current;
    const float = body.current;
    if (!group || !float) return;
    const ease = 1 - Math.exp(-dt * 10);
    group.position.x += (companion.x - group.position.x) * ease;
    group.position.z += (companion.z - group.position.z) * ease;
    const dx = lookAt.x - group.position.x;
    const dz = lookAt.z - group.position.z;
    if (Math.hypot(dx, dz) > 0.04) group.rotation.y = Math.atan2(dx, dz);
    const bob = Math.sin(state.clock.elapsedTime * 1.85 + phase) * 0.045;
    float.position.y = 0.16 + bob;
    const here = last.current;
    const moved = Math.hypot(companion.x - here.x, companion.z - here.z);
    if (moved > 0.04) {
      history.current = [here.clone(), ...history.current].slice(0, 5);
      here.set(companion.x, 0, companion.z);
    }
    crumbs.current.forEach((node, i) => {
      if (!node) return;
      const spot = history.current[i];
      if (!spot) {
        node.visible = false;
        return;
      }
      node.visible = true;
      node.position.set(spot.x - companion.x, 0.02, spot.z - companion.z);
      node.scale.setScalar(0.78 - i * 0.1);
    });
  });

  return (
    <group ref={root} position={[companion.x, 0, companion.z]}>
      {you && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[0.16, 0.22, 28]} />
          <meshBasicMaterial color="#ffe7a8" transparent opacity={night ? 0.82 : 0.68} depthWrite={false} />
        </mesh>
      )}
      <PawMark color={glow} opacity={you ? 0.42 : 0.28} />
      <group ref={body}>
        <mesh>
          <sphereGeometry args={[0.132, 16, 14]} />
          <meshStandardMaterial
            color={coat}
            emissive={glow}
            emissiveIntensity={night ? 0.62 : 0.34}
            roughness={0.38}
            metalness={0.04}
          />
        </mesh>
        <mesh position={[0, -0.02, 0.02]} scale={[0.92, 0.78, 0.88]}>
          <sphereGeometry args={[0.12, 14, 12]} />
          <meshStandardMaterial color={coat} roughness={0.42} />
        </mesh>
        <mesh position={[-0.07, 0.11, 0.01]} rotation={[0.15, 0, -0.55]} scale={[0.55, 0.78, 0.38]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={coat} roughness={0.45} />
        </mesh>
        <mesh position={[0.07, 0.11, 0.01]} rotation={[0.15, 0, 0.55]} scale={[0.55, 0.78, 0.38]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={coat} roughness={0.45} />
        </mesh>
        <mesh position={[-0.038, 0.028, 0.112]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#2a221c" />
        </mesh>
        <mesh position={[0.038, 0.028, 0.112]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#2a221c" />
        </mesh>
        <mesh position={[-0.03, 0.036, 0.124]}>
          <sphereGeometry args={[0.007, 6, 6]} />
          <meshBasicMaterial color="#fff8ee" />
        </mesh>
        <mesh position={[0.046, 0.036, 0.124]}>
          <sphereGeometry args={[0.007, 6, 6]} />
          <meshBasicMaterial color="#fff8ee" />
        </mesh>
        <mesh position={[0, -0.008, 0.126]}>
          <sphereGeometry args={[0.016, 8, 8]} />
          <meshBasicMaterial color="#3a2c26" />
        </mesh>
        <mesh position={[-0.058, -0.012, 0.09]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshBasicMaterial color={blush} transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <mesh position={[0.058, -0.012, 0.09]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshBasicMaterial color={blush} transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <mesh position={[0.1, -0.02, -0.04]} rotation={[0.4, 0.6, 0.2]} scale={[0.7, 0.38, 0.45]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={coat} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.01, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial color={glow} transparent opacity={night ? 0.2 : 0.1} depthWrite={false} />
        </mesh>
        {companion.emote && <EmoteBurst key={`${companion.id}:${companion.emote}`} kind={companion.emote} />}
      </group>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} ref={(node) => { crumbs.current[i] = node; }} visible={false}>
          <PawMark color={glow} opacity={0.2 - i * 0.03} />
        </group>
      ))}
    </group>
  );
}

export default function Companions({
  guests,
  night,
  youId = null,
  lookAt = { x: 0, z: 0 },
}: {
  guests: DogCompanion[];
  night: boolean;
  youId?: string | null;
  lookAt?: { x: number; z: number };
}) {
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return guests.filter((guest) => {
      if (seen.has(guest.id)) return false;
      seen.add(guest.id);
      return true;
    });
  }, [guests]);
  if (!unique.length) return null;
  return (
    <group>
      {unique.map((guest) => (
        <Spirit key={guest.id} companion={guest} night={night} you={guest.id === youId} lookAt={lookAt} />
      ))}
    </group>
  );
}

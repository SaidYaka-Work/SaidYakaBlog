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

function hash01(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i += 1) n = (n * 33 + id.charCodeAt(i)) >>> 0;
  return (n % 10_000) / 10_000;
}

function pastelFromId(id: string, night: boolean) {
  const hue = hash01(id) * 360;
  const sat = night ? 42 : 48;
  const lit = night ? 70 : 74;
  return new Color(`hsl(${hue.toFixed(1)}, ${sat}%, ${lit}%)`);
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
    <group position={[0, 0.42, 0]}>
      <Html center distanceFactor={5.2} style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <div className="dog-emote-pop" aria-hidden="true">
          {mark.label}
        </div>
      </Html>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} ref={(node) => { bits.current[i] = node; }}>
          <sphereGeometry args={[0.032, 7, 7]} />
          <meshBasicMaterial color={mark.color} transparent opacity={0.9} depthWrite={false} />
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
  const crumbs = useRef<(Mesh | null)[]>([]);
  const last = useRef(new Vector3(companion.x, 0, companion.z));
  const history = useRef<Vector3[]>([]);
  const coat = useMemo(() => pastelFromId(companion.id, night), [companion.id, night]);
  const glow = useMemo(() => coat.clone().lerp(new Color('#fff6e8'), 0.45), [coat]);
  const phase = hash01(companion.id) * Math.PI * 2;

  useFrame((state) => {
    const group = root.current;
    const float = body.current;
    if (!group || !float) return;
    group.position.set(companion.x, 0, companion.z);
    const dx = lookAt.x - companion.x;
    const dz = lookAt.z - companion.z;
    if (Math.hypot(dx, dz) > 0.04) group.rotation.y = Math.atan2(dx, dz);
    const bob = Math.sin(state.clock.elapsedTime * 1.7 + phase) * 0.05;
    float.position.y = 0.2 + bob;
    const here = last.current;
    const moved = Math.hypot(companion.x - here.x, companion.z - here.z);
    if (moved > 0.04) {
      history.current = [here.clone(), ...history.current].slice(0, 5);
      here.set(companion.x, 0, companion.z);
    }
    crumbs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const spot = history.current[i];
      if (!spot) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      mesh.position.set(spot.x - companion.x, 0.08, spot.z - companion.z);
      mesh.scale.setScalar(0.55 - i * 0.08);
      const mat = mesh.material as { opacity?: number };
      if (typeof mat.opacity === 'number') mat.opacity = 0.28 - i * 0.04;
    });
  });

  return (
    <group ref={root} position={[companion.x, 0, companion.z]}>
      {you && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.2, 0.28, 24]} />
          <meshBasicMaterial color="#ffe7a8" transparent opacity={night ? 0.7 : 0.55} depthWrite={false} />
        </mesh>
      )}
      <group ref={body}>
        <mesh>
          <sphereGeometry args={[0.16, 14, 12]} />
          <meshStandardMaterial
            color={coat}
            emissive={glow}
            emissiveIntensity={night ? 0.55 : 0.28}
            roughness={0.45}
            metalness={0.05}
            transparent
            opacity={0.94}
          />
        </mesh>
        <mesh position={[-0.07, 0.12, 0.02]} rotation={[0.15, 0, -0.45]} scale={[0.55, 0.7, 0.4]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={coat} roughness={0.5} />
        </mesh>
        <mesh position={[0.07, 0.12, 0.02]} rotation={[0.15, 0, 0.45]} scale={[0.55, 0.7, 0.4]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={coat} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.12]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#3a2e28" />
        </mesh>
        <mesh position={[0, -0.02, 0]}>
          <sphereGeometry args={[0.2, 10, 10]} />
          <meshBasicMaterial color={glow} transparent opacity={night ? 0.22 : 0.12} depthWrite={false} />
        </mesh>
        {companion.emote && <EmoteBurst kind={companion.emote} />}
      </group>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} ref={(node) => { crumbs.current[i] = node; }} visible={false}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={glow} transparent opacity={0.2} depthWrite={false} />
        </mesh>
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

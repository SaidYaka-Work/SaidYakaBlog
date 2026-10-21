'use client';

import { useMemo } from 'react';
import type { DogCompanion, DogEmote } from '@/lib/dog';

const EMOTE_MARK: Record<DogEmote, { color: string; label: string }> = {
  wave: { color: '#7eb6ff', label: '👋' },
  heart: { color: '#f07080', label: '💛' },
  sit: { color: '#c8b080', label: '✧' },
  treat: { color: '#e8a050', label: '🦴' },
  clap: { color: '#f4e08a', label: '✦' },
};

const COATS = ['#8a7a6c', '#6e6460', '#9a8a78', '#746860', '#847868'];

function Guest({ companion, night }: { companion: DogCompanion; night: boolean }) {
  const coat = COATS[Math.abs(companion.id.charCodeAt(0) + companion.id.length) % COATS.length];
  const mark = companion.emote ? EMOTE_MARK[companion.emote] : null;
  return (
    <group position={[companion.x, 0, companion.z]} rotation={[0, companion.yaw, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.28, 4, 8]} />
        <meshStandardMaterial color={night ? '#5a524c' : coat} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.58, 0.04]} castShadow>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshStandardMaterial color={night ? '#6a6058' : coat} roughness={0.65} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.2, 12]} />
        <meshBasicMaterial color="#1c120c" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {mark && (
        <mesh position={[0, 1.05, 0]}>
          <sphereGeometry args={[0.14, 10, 8]} />
          <meshBasicMaterial color={mark.color} />
        </mesh>
      )}
    </group>
  );
}

export default function Companions({
  guests,
  night,
}: {
  guests: DogCompanion[];
  night: boolean;
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
        <Guest key={guest.id} companion={guest} night={night} />
      ))}
    </group>
  );
}

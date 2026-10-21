'use client';

/** Portable enamel bowl that sits beside Biscuit in the city. */
export default function WorldBowl({
  x,
  z,
  night,
  food,
  near,
}: {
  x: number;
  z: number;
  night: boolean;
  food: boolean;
  near: boolean;
}) {
  const enamel = night ? '#d4c4aa' : '#f3e6d0';
  const trim = night ? '#b05a32' : '#c46a3a';
  const mat = night ? '#3a4a38' : '#6f8a5c';
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.03, 16]} />
        <meshStandardMaterial color={mat} roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.22, 0.17, 0.1, 16]} />
        <meshStandardMaterial color={trim} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.03, 18]} />
        <meshStandardMaterial color={food ? '#d4a05a' : enamel} />
      </mesh>
      {food && (
        <>
          <mesh position={[-0.03, 0.15, 0.02]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#c9843c" />
          </mesh>
          <mesh position={[0.04, 0.15, -0.01]}>
            <sphereGeometry args={[0.024, 8, 8]} />
            <meshStandardMaterial color="#b87333" />
          </mesh>
        </>
      )}
      {near && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.46, 0.52, 24]} />
          <meshBasicMaterial color="#f2d48a" transparent opacity={night ? 0.35 : 0.5} />
        </mesh>
      )}
    </group>
  );
}

import { DEPOT } from '../../systems/promethia'

/**
 * DepotMarker
 * The hardstand on the south headland that ground routes start from.
 *
 * TALOS is Phase 6 and does not exist yet, so this marks the bay rather than
 * the vehicle — a route drawn from an unmarked patch of track looks like it
 * begins nowhere. The bay is left visibly empty, which is honest about the
 * robot not being here yet.
 */
export function DepotMarker() {
  return (
    <group position={[DEPOT.x, 0, DEPOT.z]}>
      {/* Hardstand */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow>
        <planeGeometry args={[4.4, 3.4]} />
        <meshStandardMaterial color="#6e6a61" roughness={0.94} metalness={0} />
      </mesh>

      {/* Painted bay outline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.065, 0]} raycast={() => null}>
        <ringGeometry args={[1.72, 1.86, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color="#c8c2b2" transparent opacity={0.75} depthWrite={false} />
      </mesh>

      {/* Charging post — the reason the bay is where it is */}
      <mesh position={[1.7, 0.6, -1.3]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 1.2, 0.22]} />
        <meshStandardMaterial color="#4d5155" roughness={0.6} metalness={0.35} />
      </mesh>
      <mesh position={[1.7, 1.28, -1.3]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.26]} />
        <meshStandardMaterial
          color="#2e7d4f"
          emissive="#2e7d4f"
          emissiveIntensity={0.35}
          roughness={0.5}
        />
      </mesh>

      {/* Wheel stops */}
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.11, 1.4]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.12, 0.16]} />
          <meshStandardMaterial color="#8a8375" roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

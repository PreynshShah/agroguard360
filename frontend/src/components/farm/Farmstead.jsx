import { FARM_WIDTH, FARM_DEPTH } from '../../systems/farmLayout'

/**
 * Farmstead
 * A house and a barn set back beyond the north-west corner of the field.
 *
 * These are read at distance, so they are built from plain boxes and prisms —
 * the silhouette and the proportions do the work, not the detail. Roof pitch,
 * eave overhang and a chimney are what make a box read as a house; anything
 * finer would be invisible from the field and cost frames for nothing.
 */
export function Farmstead() {
  const x = -FARM_WIDTH / 2 - 26
  const z = -FARM_DEPTH / 2 - 20

  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI * 0.12, 0]}>
      <House />
      <group position={[16, 0, 7]} rotation={[0, -Math.PI * 0.06, 0]}>
        <Barn />
      </group>
      {/* Yard: a patch of packed dirt tying the buildings together. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.03, 4]} receiveShadow>
        <planeGeometry args={[34, 22]} />
        <meshStandardMaterial color="#8a7c68" roughness={0.98} metalness={0} />
      </mesh>
    </group>
  )
}

function House() {
  return (
    <group>
      {/* Walls */}
      <mesh position={[0, 2.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[9, 4.2, 7]} />
        <meshStandardMaterial color="#c8bda9" roughness={0.9} metalness={0} />
      </mesh>

      {/* Pitched roof — a 3-sided prism rotated to sit as a gable. */}
      <mesh position={[0, 5.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[5.1, 5.1, 9.6, 4, 1]} />
        <meshStandardMaterial color="#7a4a38" roughness={0.85} metalness={0} />
      </mesh>

      {/* Chimney */}
      <mesh position={[2.6, 6.2, 1.4]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 2.4, 0.8]} />
        <meshStandardMaterial color="#8d6b57" roughness={0.92} metalness={0} />
      </mesh>

      {/* Door and windows, inset slightly so they catch shadow */}
      <mesh position={[0, 1.1, 3.53]} castShadow>
        <boxGeometry args={[1.1, 2.2, 0.12]} />
        <meshStandardMaterial color="#4f3b2c" roughness={0.8} metalness={0} />
      </mesh>
      {[-2.8, 2.8].map((wx) => (
        <mesh key={wx} position={[wx, 2.4, 3.53]} castShadow>
          <boxGeometry args={[1.4, 1.2, 0.1]} />
          <meshStandardMaterial
            color="#6d7a7d"
            roughness={0.35}
            metalness={0.15}
            emissive="#2b3436"
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
    </group>
  )
}

function Barn() {
  return (
    <group>
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 6, 8]} />
        <meshStandardMaterial color="#8a5a44" roughness={0.92} metalness={0} />
      </mesh>

      <mesh position={[0, 7.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[5.9, 5.9, 12.4, 4, 1]} />
        <meshStandardMaterial color="#6a6259" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Barn door */}
      <mesh position={[0, 2, 4.03]} castShadow>
        <boxGeometry args={[4, 4, 0.14]} />
        <meshStandardMaterial color="#5e4636" roughness={0.86} metalness={0} />
      </mesh>
    </group>
  )
}

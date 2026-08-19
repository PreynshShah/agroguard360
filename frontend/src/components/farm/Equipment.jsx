import { BLOCK_WIDTH, BLOCK_DEPTH, FIELD } from '../../systems/farmLayout'

/**
 * Equipment
 * Small implements parked on the south headland: a tipping trailer, stacked
 * crates, seed sacks and a tool rack.
 *
 * These exist mostly to give the field a sense of scale and occupancy. A farm
 * with no equipment in it looks like a render; a farm with a trailer parked
 * slightly crooked on the headland looks like somewhere people work. The
 * crooked parking is deliberate.
 */
export function Equipment() {
  const headlandZ = BLOCK_DEPTH / 2 + FIELD.borderWidth / 2

  return (
    <group>
      <group position={[-BLOCK_WIDTH * 0.22, 0, headlandZ]} rotation={[0, 0.22, 0]}>
        <Trailer />
      </group>

      <group position={[BLOCK_WIDTH * 0.1, 0, headlandZ + 0.4]} rotation={[0, -0.35, 0]}>
        <CrateStack />
      </group>

      <group position={[BLOCK_WIDTH * 0.24, 0, headlandZ - 0.6]} rotation={[0, 0.1, 0]}>
        <SeedSacks />
      </group>

      <group position={[-BLOCK_WIDTH * 0.42, 0, headlandZ - 0.3]} rotation={[0, -0.08, 0]}>
        <ToolRack />
      </group>
    </group>
  )
}

function Trailer() {
  const bedY = 0.85

  return (
    <group>
      {/* Bed */}
      <mesh position={[0, bedY, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 0.16, 1.9]} />
        <meshStandardMaterial color="#6b6257" roughness={0.85} metalness={0.2} />
      </mesh>

      {/* Side and end boards */}
      {[-0.95, 0.95].map((z) => (
        <mesh key={z} position={[0, bedY + 0.36, z]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 0.72, 0.08]} />
          <meshStandardMaterial color="#7d6a52" roughness={0.9} metalness={0.05} />
        </mesh>
      ))}
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} position={[x, bedY + 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.72, 1.9]} />
          <meshStandardMaterial color="#7d6a52" roughness={0.9} metalness={0.05} />
        </mesh>
      ))}

      {/* Axle */}
      <mesh position={[0.2, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.9, 8]} />
        <meshStandardMaterial color="#4e4a45" roughness={0.7} metalness={0.45} />
      </mesh>

      {/* Wheels */}
      {[-1.0, 1.0].map((z) => (
        <mesh
          key={z}
          position={[0.2, 0.42, z]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.42, 0.42, 0.22, 18]} />
          <meshStandardMaterial color="#33312f" roughness={0.92} metalness={0} />
        </mesh>
      ))}

      {/* Draw bar and hitch */}
      <mesh position={[-2.3, 0.6, 0]} rotation={[0, 0, 0.12]} castShadow>
        <boxGeometry args={[1.8, 0.1, 0.12]} />
        <meshStandardMaterial color="#5a544c" roughness={0.72} metalness={0.4} />
      </mesh>
      <mesh position={[-3.15, 0.5, 0]} castShadow>
        <torusGeometry args={[0.13, 0.04, 8, 14]} />
        <meshStandardMaterial color="#4e4a45" roughness={0.7} metalness={0.5} />
      </mesh>

      {/* Support leg, down because it's parked */}
      <mesh position={[-2.0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.56, 8]} />
        <meshStandardMaterial color="#4e4a45" roughness={0.7} metalness={0.45} />
      </mesh>
    </group>
  )
}

function CrateStack() {
  // Each crate offset and rotated a little — hand-stacked, not machine-placed.
  const crates = [
    { x: 0, y: 0.18, z: 0, r: 0 },
    { x: 0.06, y: 0.54, z: -0.04, r: 0.09 },
    { x: -0.05, y: 0.9, z: 0.05, r: -0.13 },
    { x: 0.75, y: 0.18, z: 0.15, r: 0.3 },
  ]

  return (
    <group>
      {crates.map((crate, i) => (
        <mesh
          key={i}
          position={[crate.x, crate.y, crate.z]}
          rotation={[0, crate.r, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.62, 0.34, 0.44]} />
          <meshStandardMaterial color={i % 2 ? '#8a7a55' : '#7e6f4e'} roughness={0.92} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

function SeedSacks() {
  const sacks = [
    { x: 0, z: 0, r: 0.2, s: 1 },
    { x: 0.5, z: 0.18, r: -0.5, s: 0.92 },
    { x: 0.22, z: -0.42, r: 0.9, s: 0.96 },
  ]

  return (
    <group>
      {sacks.map((sack, i) => (
        <mesh
          key={i}
          position={[sack.x, 0.22 * sack.s, sack.z]}
          rotation={[0, sack.r, 0]}
          scale={sack.s}
          castShadow
          receiveShadow
        >
          {/* A slightly squashed capsule reads as a slumped sack. */}
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshStandardMaterial color="#a89a7d" roughness={0.96} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

function ToolRack() {
  return (
    <group>
      {/* Frame */}
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 1.4, 0.08]} />
          <meshStandardMaterial color="#6b6257" roughness={0.8} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.32, 0]} castShadow>
        <boxGeometry args={[1.5, 0.08, 0.08]} />
        <meshStandardMaterial color="#6b6257" roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Hand tools leaning at slightly different angles */}
      {[-0.42, -0.1, 0.26, 0.55].map((x, i) => (
        <group key={x} position={[x, 0, 0.06]} rotation={[0.06 + i * 0.03, 0, 0.05 - i * 0.045]}>
          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.028, 1.24, 6]} />
            <meshStandardMaterial color="#8a7350" roughness={0.9} metalness={0} />
          </mesh>
          <mesh position={[0, 0.08, 0.02]} castShadow>
            <boxGeometry args={[0.2, 0.24, 0.03]} />
            <meshStandardMaterial color="#5c5b57" roughness={0.55} metalness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

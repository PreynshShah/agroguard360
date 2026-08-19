import { BLOCK_WIDTH, BLOCK_DEPTH, FIELD } from '../../systems/farmLayout'

/**
 * WaterTank
 * An elevated storage tank at the north-east corner of the block.
 *
 * Elevated rather than ground-level for a reason that matters later: gravity
 * feed is how a field this size gets pressure without a pump, and the tank's
 * height is what the irrigation header connects to.
 */
export function WaterTank() {
  const x = BLOCK_WIDTH / 2 + FIELD.borderWidth - 1
  const z = -BLOCK_DEPTH / 2 - FIELD.borderWidth + 1

  const legHeight = 4.2
  const tankRadius = 2.3
  const tankHeight = 3.6

  // Four legs at the corners of a square footprint.
  const legOffset = tankRadius * 0.66
  const legs = [
    [legOffset, legOffset],
    [-legOffset, legOffset],
    [legOffset, -legOffset],
    [-legOffset, -legOffset],
  ]

  return (
    <group position={[x, 0, z]}>
      {/* Concrete pads */}
      {legs.map(([lx, lz], i) => (
        <mesh key={`pad-${i}`} position={[lx, 0.08, lz]} receiveShadow castShadow>
          <boxGeometry args={[0.7, 0.16, 0.7]} />
          <meshStandardMaterial color="#b0aca2" roughness={0.95} metalness={0} />
        </mesh>
      ))}

      {/* Legs */}
      {legs.map(([lx, lz], i) => (
        <mesh key={`leg-${i}`} position={[lx, legHeight / 2, lz]} castShadow receiveShadow>
          <boxGeometry args={[0.18, legHeight, 0.18]} />
          <meshStandardMaterial color="#6d6a63" roughness={0.6} metalness={0.55} />
        </mesh>
      ))}

      {/* Cross-bracing — thin diagonals read as a real frame, not four sticks */}
      {[0, Math.PI / 2].map((rotation, i) => (
        <group key={`brace-${i}`} rotation={[0, rotation, 0]}>
          <mesh position={[0, legHeight * 0.45, legOffset]} rotation={[0, 0, Math.PI / 3.4]} castShadow>
            <boxGeometry args={[0.08, legOffset * 2.5, 0.08]} />
            <meshStandardMaterial color="#6d6a63" roughness={0.6} metalness={0.55} />
          </mesh>
          <mesh position={[0, legHeight * 0.45, -legOffset]} rotation={[0, 0, -Math.PI / 3.4]} castShadow>
            <boxGeometry args={[0.08, legOffset * 2.5, 0.08]} />
            <meshStandardMaterial color="#6d6a63" roughness={0.6} metalness={0.55} />
          </mesh>
        </group>
      ))}

      {/* Platform the tank sits on */}
      <mesh position={[0, legHeight + 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[tankRadius * 1.9, 0.16, tankRadius * 1.9]} />
        <meshStandardMaterial color="#5f5c56" roughness={0.65} metalness={0.5} />
      </mesh>

      {/* Tank body — galvanised steel, weathered rather than shiny */}
      <mesh position={[0, legHeight + tankHeight / 2 + 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[tankRadius, tankRadius, tankHeight, 24]} />
        <meshStandardMaterial color="#98a0a2" roughness={0.52} metalness={0.62} />
      </mesh>

      {/* Corrugation bands */}
      {[0.28, 0.62].map((t, i) => (
        <mesh key={`band-${i}`} position={[0, legHeight + 0.16 + tankHeight * t, 0]} castShadow>
          <cylinderGeometry args={[tankRadius + 0.04, tankRadius + 0.04, 0.14, 24]} />
          <meshStandardMaterial color="#7e878a" roughness={0.55} metalness={0.6} />
        </mesh>
      ))}

      {/* Domed lid */}
      <mesh position={[0, legHeight + tankHeight + 0.16, 0]} castShadow>
        <sphereGeometry args={[tankRadius, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#8d9598" roughness={0.5} metalness={0.62} />
      </mesh>

      {/* Access ladder */}
      <group position={[0, 0, tankRadius + 0.1]}>
        {[-0.24, 0.24].map((lx) => (
          <mesh key={lx} position={[lx, (legHeight + tankHeight) / 2, 0]} castShadow>
            <boxGeometry args={[0.05, legHeight + tankHeight, 0.05]} />
            <meshStandardMaterial color="#767068" roughness={0.6} metalness={0.5} />
          </mesh>
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={`rung-${i}`} position={[0, 0.6 + i * 0.66, 0]} castShadow>
            <boxGeometry args={[0.48, 0.04, 0.04]} />
            <meshStandardMaterial color="#767068" roughness={0.6} metalness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Downpipe from tank to the field header */}
      <mesh position={[-tankRadius * 0.5, legHeight * 0.5, -0.6]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, legHeight, 10]} />
        <meshStandardMaterial color="#5a6b74" roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  )
}

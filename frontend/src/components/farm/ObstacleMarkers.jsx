import { useMemo } from 'react'

/**
 * ObstacleMarkers
 * Draws the blockages the route has to work around.
 *
 * Without these the routing looks broken rather than clever — a path that
 * suddenly detours around empty ground reads as a bug, not as avoidance. Each
 * obstacle is drawn as the thing it claims to be, so the detour has a visible
 * cause.
 *
 * Fixed structures are skipped: the water tank is already standing in the
 * scene, and drawing a barrier on top of it would only clutter the view.
 */
export function ObstacleMarkers({ obstacles }) {
  const visible = useMemo(
    () => (obstacles ?? []).filter((obstacle) => obstacle.kind !== 'structure'),
    [obstacles],
  )

  if (visible.length === 0) return null

  return (
    <group>
      {visible.map((obstacle) => (
        <Obstacle key={obstacle.id} obstacle={obstacle} />
      ))}
    </group>
  )
}

function Obstacle({ obstacle }) {
  const along = Math.max(obstacle.width, obstacle.depth)
  const runsEastWest = obstacle.width >= obstacle.depth

  if (obstacle.kind === 'hazard') {
    return (
      <group position={[obstacle.x, 0, obstacle.z]}>
        {/* Standing water: a dark, faintly reflective sheet sitting in the track */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.085, 0]} raycast={() => null}>
          <planeGeometry args={[obstacle.width, obstacle.depth]} />
          <meshStandardMaterial
            color="#3f4c52"
            roughness={0.12}
            metalness={0.35}
            transparent
            opacity={0.72}
          />
        </mesh>
      </group>
    )
  }

  if (obstacle.kind === 'vehicle') {
    // Stacked pallets — low, matte, obviously in the way.
    const count = Math.max(2, Math.round(along / 5))
    return (
      <group position={[obstacle.x, 0, obstacle.z]}>
        {Array.from({ length: count }, (_, i) => {
          const offset = (i - (count - 1) / 2) * (along / count)
          return (
            <mesh
              key={i}
              position={[runsEastWest ? offset : 0, 0.42, runsEastWest ? 0 : offset]}
              castShadow
              receiveShadow
              raycast={() => null}
            >
              <boxGeometry args={[2.0, 0.84, 1.5]} />
              <meshStandardMaterial color="#8a7a5c" roughness={0.92} metalness={0} />
            </mesh>
          )
        })}
      </group>
    )
  }

  // Works: barrier boards with hazard banding, plus cones at the ends.
  const boards = Math.max(2, Math.round(along / 8))

  return (
    <group position={[obstacle.x, 0, obstacle.z]}>
      {Array.from({ length: boards }, (_, i) => {
        const offset = (i - (boards - 1) / 2) * (along / boards)
        return (
          <group
            key={i}
            position={[runsEastWest ? offset : 0, 0, runsEastWest ? 0 : offset]}
            rotation={[0, runsEastWest ? 0 : Math.PI / 2, 0]}
          >
            {/* Board */}
            <mesh position={[0, 0.62, 0]} castShadow raycast={() => null}>
              <boxGeometry args={[3.0, 0.3, 0.09]} />
              <meshStandardMaterial color="#c2b393" roughness={0.85} metalness={0} />
            </mesh>
            {/* Banding */}
            <mesh position={[0, 0.62, 0.05]} raycast={() => null}>
              <boxGeometry args={[1.1, 0.3, 0.02]} />
              <meshStandardMaterial color="#9a5238" roughness={0.85} metalness={0} />
            </mesh>
            {/* Legs */}
            {[-1.2, 1.2].map((lx) => (
              <mesh key={lx} position={[lx, 0.31, 0]} castShadow raycast={() => null}>
                <boxGeometry args={[0.07, 0.62, 0.07]} />
                <meshStandardMaterial color="#6b6257" roughness={0.9} metalness={0.05} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

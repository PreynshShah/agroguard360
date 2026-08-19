import { HOME_PAD } from '../../systems/droneConfig'

/**
 * LandingPad
 * A portable landing mat on the south headland.
 *
 * It exists so the aircraft has a visible home. Watching a drone descend onto
 * bare soil leaves you unsure whether it landed where it was supposed to; a
 * marked pad answers that at a glance, and it is what a real operator would
 * put down to keep the gimbal out of the dirt.
 */
export function LandingPad() {
  return (
    <group position={[HOME_PAD.x, 0, HOME_PAD.z]}>
      {/* Mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]} receiveShadow>
        <circleGeometry args={[HOME_PAD.radius, 40]} />
        <meshStandardMaterial color="#2f3336" roughness={0.92} metalness={0} />
      </mesh>

      {/* Outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.058, 0]}>
        <ringGeometry args={[HOME_PAD.radius * 0.82, HOME_PAD.radius * 0.9, 40]} />
        <meshStandardMaterial color="#d9d4c6" roughness={0.85} metalness={0} />
      </mesh>

      {/* Centre H, the standard landing mark, built from two posts and a bar */}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.059, 0]}>
          <planeGeometry args={[0.09, 0.52]} />
          <meshStandardMaterial color="#d9d4c6" roughness={0.85} metalness={0} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.059, 0]}>
        <planeGeometry args={[0.31, 0.09]} />
        <meshStandardMaterial color="#d9d4c6" roughness={0.85} metalness={0} />
      </mesh>

      {/* Weighted corners, so the mat doesn't lift in rotor wash */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([dx, dz], i) => (
        <mesh
          key={i}
          position={[dx * HOME_PAD.radius * 0.72, 0.075, dz * HOME_PAD.radius * 0.72]}
          castShadow
        >
          <cylinderGeometry args={[0.06, 0.07, 0.045, 10]} />
          <meshStandardMaterial color="#4a4d50" roughness={0.8} metalness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

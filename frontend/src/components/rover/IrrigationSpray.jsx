import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

import { TALOS_FORM, NOZZLE_BY_FORM } from '../../models/TalosModel'

/**
 * IrrigationSpray
 * Water leaving the nozzle, and the ground darkening under it.
 *
 * Rendered inside the rover's own group, so it inherits the vehicle's position
 * and heading and stays glued to the boom without any transform maths of its
 * own — the nozzle tip is a fixed point in rover-local space.
 *
 * Droplets are one InstancedMesh with a recycling pool. Each has a launch
 * offset in the cycle, so they leave the nozzle in a continuous stream rather
 * than in visible pulses, and each follows a real ballistic arc rather than
 * sliding down a straight line — a fan nozzle throws water outward and gravity
 * brings it down, and the curve is most of what makes it read as water.
 */

/**
 * Nozzle tip in the machine's own local space, taken from whichever body TALOS
 * is wearing — the rover's side boom or the humanoid's hand-held wand.
 */
const NOZZLE = NOZZLE_BY_FORM[TALOS_FORM] ?? NOZZLE_BY_FORM.rover

const DROPLET_COUNT = 90
const GRAVITY = -9.81
/** Seconds a droplet lives before it is relaunched. */
const LIFETIME = 0.52

export function IrrigationSpray({ rover }) {
  const meshRef = useRef()
  const patchRef = useRef()
  const wetness = useRef(0)

  // Fixed per-droplet launch parameters, so each takes a consistent path.
  const droplets = useMemo(
    () =>
      Array.from({ length: DROPLET_COUNT }, (_, i) => {
        // Deterministic pseudo-random, so the spray looks the same every run.
        const r1 = fract(Math.sin(i * 12.9898) * 43758.5453)
        const r2 = fract(Math.sin(i * 78.233) * 26421.1234)
        const r3 = fract(Math.sin(i * 39.425) * 15731.7531)

        const spread = 0.55
        return {
          // Stagger the launch times across the lifetime for a steady stream.
          offset: (i / DROPLET_COUNT) * LIFETIME,
          vx: (r1 - 0.5) * spread,
          vz: (r2 - 0.5) * spread,
          vy: -0.35 - r3 * 0.5,
          scale: 0.012 + r3 * 0.016,
        }
      }),
    [],
  )

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const pumping = Boolean(rover.pumping)

    // Fade the spray in and out rather than switching it, so the pump starting
    // and stopping reads as a pressure change instead of a hard cut.
    wetness.current = THREE.MathUtils.clamp(
      wetness.current + (pumping ? delta * 3.2 : -delta * 2.4),
      0,
      1,
    )

    const visible = wetness.current > 0.01
    mesh.visible = visible

    if (visible) {
      const dummy = new THREE.Object3D()
      const time = state.clock.elapsedTime

      droplets.forEach((droplet, i) => {
        // Position within this droplet's own cycle.
        const t = ((time + droplet.offset) % LIFETIME)

        dummy.position.set(
          NOZZLE.x + droplet.vx * t,
          NOZZLE.y + droplet.vy * t + 0.5 * GRAVITY * t * t,
          NOZZLE.z + droplet.vz * t,
        )

        // Stop at the ground rather than falling through it.
        if (dummy.position.y < 0.015) dummy.position.y = 0.015

        // Droplets stretch as they accelerate — a falling drop is not a sphere.
        const stretch = 1 + t * 1.8
        dummy.scale.set(droplet.scale, droplet.scale * stretch, droplet.scale)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })

      mesh.instanceMatrix.needsUpdate = true
      mesh.material.opacity = 0.55 * wetness.current
    }

    // Wetted ground: grows while the pump runs and stays afterwards, because
    // soil does not dry the instant a pump stops.
    if (patchRef.current) {
      const soak = pumping
        ? Math.min(1, (patchRef.current.userData.soak ?? 0) + delta * 0.35)
        : (patchRef.current.userData.soak ?? 0)

      patchRef.current.userData.soak = soak
      patchRef.current.visible = soak > 0.01
      patchRef.current.scale.setScalar(0.55 + soak * 0.7)
      patchRef.current.material.opacity = soak * 0.5
    }
  })

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, DROPLET_COUNT]}
        raycast={() => null}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial
          color="#a8cdd6"
          transparent
          opacity={0.55}
          roughness={0.12}
          metalness={0.1}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Damp soil under the nozzle */}
      <mesh
        ref={patchRef}
        position={[NOZZLE.x, 0.075, NOZZLE.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
        renderOrder={2}
      >
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial
          color="#5b6a5a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.MultiplyBlending}
        />
      </mesh>
    </group>
  )
}

const fract = (v) => v - Math.floor(v)

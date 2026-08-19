import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

import { PegasusModel, PEGASUS_ROTOR_SPIN, PEGASUS_SPEC } from '../../models/PegasusModel'
import { ProjectedShadow } from './ProjectedShadow'

/**
 * DroneRig
 * Everything that moves PEGASUS, kept separate from everything that draws it.
 *
 * The split matters: this component never touches geometry, and the model
 * never touches flight state. Replacing the procedural airframe with a GLB
 * changes nothing here, as long as the replacement still exposes four rotor
 * groups.
 *
 * All animation is written straight to object transforms inside useFrame.
 * Nothing here triggers a React render — at sixty frames a second, going
 * through state would spend more time reconciling than flying.
 */
export function DroneRig({ controller }) {
  const groupRef = useRef()
  const bodyRef = useRef()
  const gimbalRef = useRef()
  const beaconRef = useRef()

  // Four stable refs, one per rotor, handed down to whichever model is mounted.
  const rotorRefs = [useRef(), useRef(), useRef(), useRef()]

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime
    controller.update(delta)

    const craft = controller.craft
    const group = groupRef.current
    if (!group) return

    // Position and heading on the outer group.
    group.position.copy(craft.position)
    group.rotation.y = craft.yaw

    // Bank and pitch on an inner group, so tilt never affects heading.
    if (bodyRef.current) {
      bodyRef.current.rotation.x = craft.pitch
      bodyRef.current.rotation.z = craft.roll
    }

    // Counter-rotate the gimbal so the camera holds level while the airframe
    // banks — the same job the real stabiliser does.
    if (gimbalRef.current) {
      gimbalRef.current.rotation.x = -craft.pitch
      gimbalRef.current.rotation.z = -craft.roll
    }

    // Rotors. Adjacent motors turn opposite ways, which is why the spin
    // directions come from the model rather than being assumed here.
    rotorRefs.forEach((ref, i) => {
      if (ref.current) ref.current.rotation.y = craft.rotorAngle * PEGASUS_ROTOR_SPIN[i]
    })

    // Anti-collision beacon: a double-blink about once a second, bright only
    // while powered up.
    if (beaconRef.current) {
      const powered = craft.mode !== 'idle'
      const t = elapsed % 1.4
      const flash = powered && (t < 0.08 || (t > 0.2 && t < 0.28))
      beaconRef.current.material.emissiveIntensity = flash ? 5.5 : 0.15
    }
  })

  return (
    <>
      <group
        ref={groupRef}
        position={[
          controller.craft.position.x,
          controller.craft.position.y,
          controller.craft.position.z,
        ]}
      >
        <group ref={bodyRef}>
          <PegasusModel
            rotorRefs={rotorRefs}
            navLightRef={beaconRef}
            gimbalRef={gimbalRef}
          />
        </group>
      </group>

      <ProjectedShadow craft={controller.craft} radius={PEGASUS_SPEC.wheelbase * 0.62} />
    </>
  )
}

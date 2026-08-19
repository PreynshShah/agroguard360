import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

import { OperatorModel } from '../models/OperatorModel'
import { OPERATOR_STATION } from '../systems/droneConfig'

/**
 * Operator
 * Places the worker on the headland and turns them to watch the aircraft.
 *
 * The tracking is the point. A figure frozen at a fixed angle reads as set
 * dressing; one whose body follows the drone reads as someone flying it. The
 * turn is heavily damped so it is a slow shift of stance, not a turret.
 *
 * When PEGASUS is on the pad, they face into the field instead.
 */
export function Operator({ craft }) {
  const groupRef = useRef()
  const restingHeading = useRef(OPERATOR_STATION.heading)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    let desired = restingHeading.current

    if (craft && craft.mode !== 'idle') {
      // Face the aircraft. atan2 of the offset gives the heading; the model
      // faces -Z, which is what the extra half turn accounts for.
      const dx = craft.position.x - OPERATOR_STATION.x
      const dz = craft.position.z - OPERATOR_STATION.z
      desired = Math.atan2(dx, dz) + Math.PI
    }

    // Shortest-path damping, so crossing the -π/π seam doesn't spin them
    // the long way round.
    const current = group.rotation.y
    let diff = desired - current
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2

    group.rotation.y = current + diff * (1 - Math.exp(-1.8 * Math.min(delta, 0.05)))
  })

  return (
    <group
      ref={groupRef}
      position={[OPERATOR_STATION.x, 0, OPERATOR_STATION.z]}
      rotation={[0, OPERATOR_STATION.heading, 0]}
    >
      <OperatorModel />
    </group>
  )
}

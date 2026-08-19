import { useMemo, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

import {
  ZONES,
  FIELD,
  BLOCK_WIDTH,
  BLOCK_DEPTH,
} from '../../systems/farmLayout'

/**
 * Irrigation
 * The pipework only — no water behaviour, no scheduling, no control logic.
 * Phase 2 is showing what is physically in the field.
 *
 * The run is laid out the way a real gravity-fed system would be: a main
 * header along the north edge from the tank, laterals branching south down
 * each inter-zone track, and risers at intervals along the laterals.
 *
 * Risers are instanced because there are dozens of them and they are all the
 * same part — which is exactly true of real irrigation fittings too.
 */
export function Irrigation() {
  const pipeRadius = 0.11
  const pipeY = 0.16

  const headerZ = -BLOCK_DEPTH / 2 - FIELD.borderWidth / 2
  const headerLength = BLOCK_WIDTH + FIELD.borderWidth * 2

  // Laterals run down the three inter-column tracks plus both outer edges.
  const lateralXs = useMemo(() => {
    const step = FIELD.zoneWidth + FIELD.pathWidth
    const inner = []
    for (let i = 0; i < FIELD.cols.length - 1; i++) {
      inner.push((i - (FIELD.cols.length - 1) / 2 + 0.5) * step)
    }
    const outer = BLOCK_WIDTH / 2 + FIELD.pathWidth / 2
    return [-outer, ...inner, outer]
  }, [])

  const lateralLength = BLOCK_DEPTH + FIELD.borderWidth

  return (
    <group>
      {/* Main header, east–west along the north headland */}
      <mesh
        position={[0, pipeY, headerZ]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[pipeRadius * 1.35, pipeRadius * 1.35, headerLength, 12]} />
        <PipeMaterial />
      </mesh>

      {/* Laterals, north–south */}
      {lateralXs.map((x, i) => (
        <group key={`lateral-${i}`}>
          <mesh
            position={[x, pipeY, headerZ + lateralLength / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[pipeRadius, pipeRadius, lateralLength, 10]} />
            <PipeMaterial />
          </mesh>

          {/* Elbow where the lateral meets the header */}
          <mesh position={[x, pipeY, headerZ]} castShadow>
            <sphereGeometry args={[pipeRadius * 1.5, 10, 8]} />
            <PipeMaterial />
          </mesh>

          {/* Inline valve near the head of each lateral */}
          <mesh position={[x, pipeY + 0.16, headerZ + 1.6]} castShadow>
            <boxGeometry args={[0.18, 0.32, 0.18]} />
            <meshStandardMaterial color="#6e5f4a" roughness={0.7} metalness={0.25} />
          </mesh>
        </group>
      ))}

      <SprinklerRisers lateralXs={lateralXs} headerZ={headerZ} pipeY={pipeY} />
    </group>
  )
}

/**
 * SprinklerRisers
 * Vertical stand-pipes spaced along each lateral, level with every zone.
 * One InstancedMesh for the risers, one for their heads.
 */
function SprinklerRisers({ lateralXs, headerZ, pipeY }) {
  const riserRef = useRef()
  const headRef = useRef()

  const positions = useMemo(() => {
    const out = []
    // One riser per zone row along every lateral, aligned to zone centres.
    const zoneZs = [...new Set(ZONES.map((zone) => zone.centerZ))]

    for (const x of lateralXs) {
      for (const z of zoneZs) {
        // Two risers per zone edge, at the quarter points, so coverage looks
        // plausible rather than one lonely pipe per zone.
        out.push({ x, z: z - FIELD.zoneDepth * 0.25 })
        out.push({ x, z: z + FIELD.zoneDepth * 0.25 })
      }
    }

    return out
  }, [lateralXs])

  useLayoutEffect(() => {
    const riser = riserRef.current
    const head = headRef.current
    if (!riser || !head) return

    const dummy = new THREE.Object3D()
    const riserHeight = 0.85

    positions.forEach((p, i) => {
      dummy.position.set(p.x, pipeY + riserHeight / 2, p.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      riser.setMatrixAt(i, dummy.matrix)

      dummy.position.set(p.x, pipeY + riserHeight, p.z)
      dummy.updateMatrix()
      head.setMatrixAt(i, dummy.matrix)
    })

    riser.instanceMatrix.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
    riser.computeBoundingSphere()
    head.computeBoundingSphere()
  }, [positions, pipeY])

  return (
    <group>
      <instancedMesh
        ref={riserRef}
        args={[undefined, undefined, positions.length]}
        castShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.045, 0.045, 0.85, 8]} />
        <PipeMaterial />
      </instancedMesh>

      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, positions.length]}
        castShadow
        raycast={() => null}
      >
        <sphereGeometry args={[0.085, 8, 6]} />
        <meshStandardMaterial color="#57616a" roughness={0.55} metalness={0.4} />
      </instancedMesh>
    </group>
  )
}

/**
 * Weathered PVC. Agricultural pipe is dusty and matte, not the bright blue
 * that plastic pipe renders as when it comes straight out of a colour picker.
 */
function PipeMaterial() {
  return <meshStandardMaterial color="#7c8a8f" roughness={0.72} metalness={0.12} />
}

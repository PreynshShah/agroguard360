import { useMemo, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

import { BLOCK_WIDTH, BLOCK_DEPTH, FARM_WIDTH, FARM_DEPTH, makeRandom } from '../../systems/farmLayout'
import { createGrassBladeGeometry } from './plantGeometry'

const BLADE_COUNT = 9000

/**
 * GrassVerges
 * Loose grass on the margins around the farm block.
 *
 * Blades are scattered in the ring between the farm's outer edge and the wider
 * turf, and skipped anywhere they would grow through a path or a crop bed. One
 * InstancedMesh, one draw call.
 *
 * Blades are clustered into tufts rather than spread evenly: real grass grows
 * in clumps, and even scattering is another tell of a generated scene.
 */
export function GrassVerges() {
  const meshRef = useRef()
  const geometry = useMemo(() => createGrassBladeGeometry({ height: 0.34 }), [])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  const blades = useMemo(() => {
    const random = makeRandom(555)
    const out = []

    // Keep-out box: the farm block plus its perimeter track.
    const keepOutX = FARM_WIDTH / 2
    const keepOutZ = FARM_DEPTH / 2

    // Scatter tufts, then blades within each tuft.
    const tuftCount = Math.ceil(BLADE_COUNT / 7)
    const spread = FARM_WIDTH * 1.5

    for (let t = 0; t < tuftCount && out.length < BLADE_COUNT; t++) {
      const tuftX = (random() - 0.5) * spread * 2
      const tuftZ = (random() - 0.5) * spread * 2

      // Skip tufts that land on the working farm surface.
      if (Math.abs(tuftX) < keepOutX && Math.abs(tuftZ) < keepOutZ) continue

      // Thin out with distance so the near verges look dense and the far
      // ground stays cheap.
      const distance = Math.hypot(tuftX, tuftZ)
      if (distance > FARM_WIDTH * 0.95 && random() > 0.35) continue

      const perTuft = 5 + Math.floor(random() * 5)
      for (let b = 0; b < perTuft && out.length < BLADE_COUNT; b++) {
        out.push({
          x: tuftX + (random() - 0.5) * 0.55,
          z: tuftZ + (random() - 0.5) * 0.55,
          scale: 0.65 + random() * 0.8,
          rotation: random() * Math.PI * 2,
          lean: (random() - 0.5) * 0.45,
          shade: 0.78 + random() * 0.42,
        })
      }
    }

    return out
  }, [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    blades.forEach((blade, i) => {
      dummy.position.set(blade.x, 0.01, blade.z)
      dummy.rotation.set(blade.lean * 0.5, blade.rotation, blade.lean)
      dummy.scale.set(1, blade.scale, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Slight yellow-green drift so the verge isn't one flat colour.
      color.setRGB(blade.shade * 0.95, blade.shade, blade.shade * 0.72)
      mesh.setColorAt(i, color)
    })

    mesh.count = blades.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [blades])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, BLADE_COUNT]}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    >
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.9} metalness={0} />
    </instancedMesh>
  )
}

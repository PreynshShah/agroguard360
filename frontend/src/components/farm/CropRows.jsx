import { useMemo, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

import { ZONES, CROP_PROFILES, generateZonePlants, makeRandom } from '../../systems/farmLayout'
import { createCropPlantGeometry } from './plantGeometry'

/**
 * CropRows
 * Every crop plant in the field, drawn as instanced meshes.
 *
 * Plants are grouped by growth stage rather than by zone. That gives four
 * InstancedMesh objects total — four draw calls for roughly seven thousand
 * plants — instead of sixteen. Grouping by stage also means each group can
 * share one geometry sized for that stage.
 *
 * Per-plant variety comes from the instance matrix (position, scale, rotation,
 * lean) and instance colour, none of which cost extra draw calls.
 */
export function CropRows() {
  // Bucket the zones by growth stage.
  const groups = useMemo(() => {
    const random = makeRandom(9001)
    const byStage = {}

    for (const zone of ZONES) {
      const plants = generateZonePlants(zone, random)
      if (!byStage[zone.crop]) byStage[zone.crop] = []
      byStage[zone.crop].push(...plants)
    }

    return Object.entries(byStage).map(([stage, plants]) => ({ stage, plants }))
  }, [])

  return (
    <group>
      {groups.map(({ stage, plants }) => (
        <CropInstances key={stage} stage={stage} plants={plants} />
      ))}
    </group>
  )
}

function CropInstances({ stage, plants }) {
  const meshRef = useRef()
  const profile = CROP_PROFILES[stage]

  const geometry = useMemo(
    () =>
      createCropPlantGeometry({
        leaves: stage === 'seedling' ? 4 : 6,
        height: profile.height,
        spread: profile.spread,
      }),
    [stage, profile.height, profile.spread],
  )

  // Free the GPU buffers if this component ever unmounts.
  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = new THREE.Object3D()
    const tint = new THREE.Color(profile.tint)
    const color = new THREE.Color()

    plants.forEach((plant, i) => {
      dummy.position.set(plant.x, 0.05, plant.z)
      dummy.rotation.set(plant.lean * 0.6, plant.rotation, plant.lean)
      dummy.scale.setScalar(plant.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Multiplied against the geometry's baked base-to-tip ramp.
      color.copy(tint).multiplyScalar(plant.shade)
      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [plants, profile.tint])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, plants.length]}
      castShadow
      // Plants receive the sun's shadow from trees and equipment, but making
      // thousands of thin leaves receive shadows from each other costs far
      // more than it shows at this scale.
      receiveShadow={false}
      frustumCulled
      // Picking is handled by the flat zone planes; testing thousands of
      // instances per pointer move would cost far more than it gains.
      raycast={() => null}
    >
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        roughness={0.82}
        metalness={0}
        // Leaves are thin; a touch of transmission-free alpha test keeps the
        // silhouette crisp without sorting cost.
        alphaTest={0.01}
      />
    </instancedMesh>
  )
}

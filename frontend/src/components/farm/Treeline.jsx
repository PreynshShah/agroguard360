import { useMemo, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

import { FARM_WIDTH, FARM_DEPTH, makeRandom } from '../../systems/farmLayout'
import { createFoliageClumpGeometry } from './plantGeometry'

/**
 * Treeline
 * A windbreak along the north and west edges of the farm, plus a few strays.
 *
 * Each tree is two instances: a trunk and a canopy. Because both are instanced
 * meshes, twenty-eight trees cost two draw calls. Canopies use three different
 * clump shapes chosen per tree, which is enough variation that the row doesn't
 * read as a copy-paste.
 */
const TREE_COUNT = 28

export function Treeline() {
  const trunkRef = useRef()
  const canopyRefs = [useRef(), useRef(), useRef()]

  // Three canopy variants so neighbouring trees differ in silhouette.
  const canopyGeometries = useMemo(
    () => [
      createFoliageClumpGeometry({ radius: 1, seed: 3 }),
      createFoliageClumpGeometry({ radius: 1, seed: 17 }),
      createFoliageClumpGeometry({ radius: 1, seed: 41 }),
    ],
    [],
  )

  useLayoutEffect(
    () => () => canopyGeometries.forEach((geometry) => geometry.dispose()),
    [canopyGeometries],
  )

  const trees = useMemo(() => {
    const random = makeRandom(2024)
    const out = []

    const edgeX = FARM_WIDTH / 2 + 7
    const edgeZ = FARM_DEPTH / 2 + 7

    // North windbreak — a spaced row with irregular gaps.
    const northCount = 11
    for (let i = 0; i < northCount; i++) {
      const t = i / (northCount - 1)
      out.push(makeTree(-edgeX + t * edgeX * 2 + (random() - 0.5) * 3, -edgeZ + (random() - 0.5) * 2.5, random))
    }

    // West windbreak.
    const westCount = 9
    for (let i = 0; i < westCount; i++) {
      const t = i / (westCount - 1)
      out.push(makeTree(-edgeX + (random() - 0.5) * 2.5, -edgeZ + t * edgeZ * 2 + (random() - 0.5) * 3, random))
    }

    // Scattered trees further out, to break the two hard lines.
    while (out.length < TREE_COUNT) {
      const x = (random() - 0.5) * FARM_WIDTH * 2.6
      const z = (random() - 0.5) * FARM_DEPTH * 2.6
      if (Math.abs(x) < edgeX + 4 && Math.abs(z) < edgeZ + 4) continue
      out.push(makeTree(x, z, random))
    }

    return out
  }, [])

  useLayoutEffect(() => {
    const trunkMesh = trunkRef.current
    if (!trunkMesh) return

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    // Trunks
    trees.forEach((tree, i) => {
      dummy.position.set(tree.x, tree.trunkHeight / 2, tree.z)
      dummy.rotation.set(tree.lean * 0.4, tree.rotation, tree.lean)
      dummy.scale.set(tree.trunkRadius, tree.trunkHeight, tree.trunkRadius)
      dummy.updateMatrix()
      trunkMesh.setMatrixAt(i, dummy.matrix)

      const shade = tree.barkShade
      color.setRGB(shade * 0.42, shade * 0.34, shade * 0.26)
      trunkMesh.setColorAt(i, color)
    })
    trunkMesh.instanceMatrix.needsUpdate = true
    if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true
    trunkMesh.computeBoundingSphere()

    // Canopies, split across the three variant meshes.
    canopyRefs.forEach((ref, variant) => {
      const mesh = ref.current
      if (!mesh) return

      const subset = trees.filter((tree) => tree.variant === variant)
      subset.forEach((tree, i) => {
        dummy.position.set(tree.x, tree.trunkHeight * 0.94 + tree.canopyRadius * 0.45, tree.z)
        dummy.rotation.set(0, tree.rotation, tree.lean * 0.5)
        dummy.scale.setScalar(tree.canopyRadius)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)

        color.setRGB(tree.leafShade * 0.92, tree.leafShade, tree.leafShade * 0.78)
        mesh.setColorAt(i, color)
      })

      mesh.count = subset.length
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [trees])

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, trees.length]}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.62, 0.9, 1, 7]} />
        <meshStandardMaterial roughness={0.94} metalness={0} />
      </instancedMesh>

      {canopyGeometries.map((geometry, variant) => (
        <instancedMesh
          key={variant}
          ref={canopyRefs[variant]}
          args={[geometry, undefined, trees.length]}
          castShadow
          receiveShadow
          raycast={() => null}
        >
          <meshStandardMaterial vertexColors roughness={0.88} metalness={0} flatShading />
        </instancedMesh>
      ))}
    </group>
  )
}

function makeTree(x, z, random) {
  const trunkHeight = 3.4 + random() * 2.8
  return {
    x,
    z,
    trunkHeight,
    trunkRadius: 0.16 + random() * 0.1,
    canopyRadius: 2.1 + random() * 1.5,
    rotation: random() * Math.PI * 2,
    lean: (random() - 0.5) * 0.12,
    variant: Math.floor(random() * 3),
    barkShade: 0.85 + random() * 0.35,
    leafShade: 0.4 + random() * 0.22,
  }
}

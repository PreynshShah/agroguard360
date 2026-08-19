import { useMemo, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

import {
  ZONES,
  FIELD,
  FARM_WIDTH,
  FARM_DEPTH,
  CROP_PROFILES,
  getPathSegments,
  makeRandom,
} from '../../systems/farmLayout'
import { createSoilTextures, createGrassTextures, createPathTextures } from '../../systems/textures'

/**
 * Terrain
 * Three stacked surfaces, each a hair above the last to avoid z-fighting:
 *
 *   y = 0.000  surrounding turf, extending well past the farm
 *   y = 0.020  compacted dirt pathways
 *   y = 0.035  tilled soil beds, one per zone
 *   y = 0.040  ploughed ridges, instanced along each crop row
 *
 * Textures are generated once and shared by every surface of the same kind,
 * so sixteen soil beds cost one texture upload, not sixteen.
 */
export function Terrain() {
  // Resolution is chosen per surface by how much each one is magnified on
  // screen. Soil is viewed close up, so it gets the full 512². Grass and path
  // tile many times over, so 256² is already denser than the screen can show —
  // and generation cost scales with the square of this number.
  const soil = useMemo(() => createSoilTextures(512), [])
  const grass = useMemo(() => createGrassTextures(256), [])
  const path = useMemo(() => createPathTextures(256), [])

  // Repeat counts are set per surface so texel density stays roughly even
  // across surfaces of very different sizes.
  const soilMaps = useMemo(() => cloneWithRepeat(soil, 5, 5), [soil])
  const grassMaps = useMemo(() => cloneWithRepeat(grass, 30, 30), [grass])

  const paths = useMemo(() => getPathSegments(), [])

  return (
    <group>
      {/* Surrounding turf. Larger than the farm so the eye never finds an edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FARM_WIDTH * 4.5, FARM_DEPTH * 4.5]} />
        <meshStandardMaterial
          map={grassMaps.map}
          normalMap={grassMaps.normalMap}
          normalScale={new THREE.Vector2(0.6, 0.6)}
          roughness={0.98}
          metalness={0}
          color="#8d9a72"
        />
      </mesh>

      {/* Pathways */}
      {paths.map((segment) => (
        <PathStrip key={segment.key} segment={segment} textures={path} />
      ))}

      {/* Soil beds */}
      {ZONES.map((zone) => (
        <mesh
          key={zone.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[zone.centerX, 0.035, zone.centerZ]}
          receiveShadow
        >
          <planeGeometry args={[zone.width, zone.depth]} />
          <meshStandardMaterial
            map={soilMaps.map}
            normalMap={soilMaps.normalMap}
            roughnessMap={soilMaps.roughnessMap}
            normalScale={new THREE.Vector2(1.1, 1.1)}
            roughness={1}
            metalness={0}
            color="#a2937f"
          />
        </mesh>
      ))}

      <PloughRidges />
    </group>
  )
}

/**
 * PathStrip
 * A single dirt track. The texture is scaled to the strip's real dimensions so
 * ruts stay the same width whether the track is 4 m or 100 m long.
 */
function PathStrip({ segment, textures }) {
  const maps = useMemo(() => {
    const long = Math.max(segment.width, segment.depth)
    const short = Math.min(segment.width, segment.depth)
    const along = Math.max(1, Math.round(long / 8))
    const across = Math.max(1, Math.round(short / 8))

    // Ruts run along the length, so orient the repeat with the strip.
    return segment.depth >= segment.width
      ? cloneWithRepeat(textures, across, along)
      : cloneWithRepeat(textures, along, across)
  }, [segment, textures])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[segment.x, 0.02, segment.z]} receiveShadow>
      <planeGeometry args={[segment.width, segment.depth]} />
      <meshStandardMaterial
        map={maps.map}
        normalMap={maps.normalMap}
        normalScale={new THREE.Vector2(0.7, 0.7)}
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  )
}

/**
 * PloughRidges
 * Low soil mounds running under each crop row.
 *
 * This is the detail that sells "tilled field" more than the texture does —
 * real beds have raised ridges and shadowed furrows between them. One
 * InstancedMesh covers every ridge in all sixteen zones.
 */
function PloughRidges() {
  const meshRef = useRef()

  const { count, matrices, colors } = useMemo(() => {
    const random = makeRandom(4242)
    const matrices = []
    const colors = []

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    for (const zone of ZONES) {
      const profile = CROP_PROFILES[zone.crop]
      const headland = 1.2
      const usableWidth = zone.width - headland * 2
      const rowCount = Math.floor(usableWidth / profile.rowSpacing)
      const rowStart = -usableWidth / 2

      for (let r = 0; r < rowCount; r++) {
        dummy.position.set(
          zone.centerX + rowStart + r * profile.rowSpacing,
          0.04,
          zone.centerZ,
        )
        dummy.rotation.set(0, 0, 0)
        // Slightly varied ridge width and height per row.
        dummy.scale.set(
          profile.rowSpacing * (0.62 + random() * 0.12),
          0.05 + random() * 0.035,
          zone.depth - headland * 2,
        )
        dummy.updateMatrix()
        matrices.push(dummy.matrix.clone())

        const shade = 0.82 + random() * 0.26
        color.setRGB(shade, shade * 0.97, shade * 0.93)
        colors.push(color.clone())
      }
    }

    return { count: matrices.length, matrices, colors }
  }, [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    colors.forEach((color, i) => mesh.setColorAt(i, color))

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices, colors])

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      receiveShadow
      castShadow
      raycast={() => null}
    >
      {/* A flattened box reads as a ridge from any normal viewing angle and
          costs a twelfth of what a rounded profile would. */}
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#6a583f" roughness={1} metalness={0} />
    </instancedMesh>
  )
}

/**
 * Clones a texture set with new repeat values.
 * Cloning shares the underlying image data, so this costs no extra memory on
 * the GPU — only a new sampler configuration.
 */
function cloneWithRepeat(textures, repeatX, repeatY) {
  const out = {}
  for (const [key, texture] of Object.entries(textures)) {
    const clone = texture.clone()
    clone.wrapS = clone.wrapT = THREE.RepeatWrapping
    clone.repeat.set(repeatX, repeatY)
    clone.needsUpdate = true
    out[key] = clone
  }
  return out
}

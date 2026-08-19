import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * plantGeometry.js
 * Builders for the small repeated shapes in the scene.
 *
 * Every one of these is built once and handed to an InstancedMesh, so the
 * triangle count here is multiplied by thousands. The budget is tight on
 * purpose: a crop plant is about 40 triangles, a grass blade is 6.
 *
 * Each geometry carries baked vertex colours running dark at the base to
 * light at the tip. That fakes the self-shadowing you would otherwise need
 * ambient occlusion to get, and costs nothing at render time.
 */

/**
 * A young crop plant: a handful of tapered leaves fanning out from a central
 * point, each curving outward and upward.
 *
 * @param {object} options
 * @param {number} options.leaves     blades per plant
 * @param {number} options.height     tip height in metres
 * @param {number} options.spread     how far leaves reach sideways
 */
export function createCropPlantGeometry({ leaves = 6, height = 0.5, spread = 0.3 } = {}) {
  const parts = []

  for (let i = 0; i < leaves; i++) {
    // Four segments give enough vertices to curve the leaf convincingly.
    const leaf = new THREE.PlaneGeometry(0.075, 1, 1, 4)
    const position = leaf.attributes.position

    // Bend the flat plane into an arc: tips fall away from the stem, and the
    // blade narrows toward the point.
    for (let v = 0; v < position.count; v++) {
      const y = position.getY(v) + 0.5 // 0 at base, 1 at tip
      const x = position.getX(v)

      const taper = 1 - Math.pow(y, 1.7) * 0.85
      const arc = Math.pow(y, 1.9)

      position.setX(v, x * taper)
      position.setY(v, y * height)
      position.setZ(v, arc * spread)
    }

    position.needsUpdate = true

    // Fan the leaves around the stem, with a little irregularity.
    const angle = (i / leaves) * Math.PI * 2 + (i % 2) * 0.4
    const tilt = 0.18 + (i % 3) * 0.07

    leaf.rotateX(tilt)
    leaf.rotateY(angle)
    parts.push(leaf)
  }

  // A short stem so the plant meets the soil rather than floating.
  const stem = new THREE.CylinderGeometry(0.012, 0.02, height * 0.45, 4)
  stem.translate(0, height * 0.22, 0)
  parts.push(stem)

  const merged = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())

  applyVerticalTint(merged, '#3d5228', '#7a9450', height)
  merged.computeVertexNormals()
  return merged
}

/**
 * A single grass blade — a tapered strip with a slight curve.
 * Six triangles, because there will be a great many of them.
 */
export function createGrassBladeGeometry({ height = 0.3 } = {}) {
  const blade = new THREE.PlaneGeometry(0.03, 1, 1, 3)
  const position = blade.attributes.position

  for (let v = 0; v < position.count; v++) {
    const y = position.getY(v) + 0.5
    const x = position.getX(v)
    position.setX(v, x * (1 - y * 0.85))
    position.setY(v, y * height)
    position.setZ(v, Math.pow(y, 2) * height * 0.35)
  }

  position.needsUpdate = true
  applyVerticalTint(blade, '#3f4c26', '#7d8a4e', height)
  blade.computeVertexNormals()
  return blade
}

/**
 * An irregular blob for tree foliage. A plain icosahedron reads as a ball;
 * pushing its vertices around turns it into a canopy clump.
 */
export function createFoliageClumpGeometry({ radius = 1, seed = 1 } = {}) {
  const geometry = new THREE.IcosahedronGeometry(radius, 1)
  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let v = 0; v < position.count; v++) {
    vertex.fromBufferAttribute(position, v)
    // Deterministic per-vertex offset, so a given seed always builds the same
    // canopy shape.
    const n = Math.sin(vertex.x * 12.9 + vertex.y * 78.2 + vertex.z * 37.7 + seed) * 43758.5453
    const jitter = 0.78 + (n - Math.floor(n)) * 0.42
    vertex.multiplyScalar(jitter)
    // Canopies are wider than they are tall.
    vertex.y *= 0.82
    position.setXYZ(v, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  applyVerticalTint(geometry, '#2f4326', '#5f7a41', radius * 1.6)
  return geometry
}

/**
 * Bakes a base-to-tip colour ramp into a geometry's vertex colours.
 * Instance colours multiply with these, so per-plant tinting still works.
 */
function applyVerticalTint(geometry, baseHex, tipHex, height) {
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)

  const base = new THREE.Color(baseHex)
  const tip = new THREE.Color(tipHex)
  const mixed = new THREE.Color()

  // Foliage clumps are centred on the origin, so shift the ramp to start below.
  let minY = Infinity
  for (let v = 0; v < position.count; v++) minY = Math.min(minY, position.getY(v))

  for (let v = 0; v < position.count; v++) {
    const t = THREE.MathUtils.clamp((position.getY(v) - minY) / (height || 1), 0, 1)
    mixed.copy(base).lerp(tip, t)
    colors[v * 3] = mixed.r
    colors[v * 3 + 1] = mixed.g
    colors[v * 3 + 2] = mixed.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

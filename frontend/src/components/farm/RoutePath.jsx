import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

import { CELL_SIZE } from '../../systems/promethia/navGrid'

/**
 * RoutePath
 * Draws the planned route on the ground.
 *
 * A ribbon rather than a line: a one-pixel line disappears at any distance and
 * cannot show direction. The ribbon carries a scrolling chevron texture, which
 * is what makes the route read as "travel this way" rather than "a stripe was
 * painted here".
 *
 * Kept deliberately restrained — laid flat on the tracks, in a muted teal that
 * belongs to no crop condition, so it never competes with BUDDHI's diagnostic
 * markers or reads as another problem.
 */

const ROUTE_COLOR = '#4a8f96'
const RIBBON_WIDTH = 1.3

export function RoutePath({ route }) {
  const materialRef = useRef()

  const geometry = useMemo(() => (route?.ok ? buildRibbon(route.points) : null), [route])
  const texture = useMemo(() => createFlowTexture(), [])

  useFrame((_, delta) => {
    if (!materialRef.current?.map) return
    // Scroll the chevrons along the route to imply direction of travel.
    materialRef.current.map.offset.y -= delta * 0.35
  })

  if (!route?.ok || !geometry) return null

  const target = route.points[route.points.length - 1]
  const start = route.points[0]

  return (
    <group>
      <mesh geometry={geometry} position={[0, 0.09, 0]} raycast={() => null} renderOrder={3}>
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          color={ROUTE_COLOR}
          transparent
          opacity={0.72}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <StartMarker position={start} />
      <TargetMarker position={target} />
    </group>
  )
}

/** A flat plate where the route begins. */
function StartMarker({ position }) {
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} raycast={() => null}>
        <ringGeometry args={[0.9, 1.15, 32]} />
        <meshBasicMaterial color={ROUTE_COLOR} transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.095, 0]} raycast={() => null}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial color={ROUTE_COLOR} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A slowly pulsing ring at the destination. */
function TargetMarker({ position }) {
  const ringRef = useRef()

  useFrame((state) => {
    if (!ringRef.current) return
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.7) * 0.09
    ringRef.current.scale.setScalar(pulse)
  })

  return (
    <group position={[position.x, 0, position.z]}>
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.1, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[1.5, 1.85, 36]} />
        <meshBasicMaterial color={ROUTE_COLOR} transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/**
 * Builds a flat ribbon following the route's centreline.
 *
 * Each point gets two vertices, offset either side of the path. At corners the
 * offset direction is the average of the incoming and outgoing segments — a
 * mitre — so the ribbon turns cleanly instead of pinching or tearing open on
 * the outside of every 90° turn.
 */
function buildRibbon(points) {
  if (!points || points.length < 2) return null

  const half = RIBBON_WIDTH / 2
  const positions = []
  const uvs = []
  const indices = []

  let travelled = 0

  for (let i = 0; i < points.length; i++) {
    const previous = points[i - 1]
    const current = points[i]
    const next = points[i + 1]

    // Direction through this point.
    let dx = 0
    let dz = 0

    if (previous && next) {
      dx = next.x - previous.x
      dz = next.z - previous.z
    } else if (next) {
      dx = next.x - current.x
      dz = next.z - current.z
    } else if (previous) {
      dx = current.x - previous.x
      dz = current.z - previous.z
    }

    const length = Math.hypot(dx, dz) || 1
    dx /= length
    dz /= length

    // Perpendicular in the ground plane.
    const nx = -dz
    const nz = dx

    if (previous) travelled += Math.hypot(current.x - previous.x, current.z - previous.z)

    // Repeat the chevron texture once per cell, so its density stays constant
    // whatever the route's length.
    const v = travelled / CELL_SIZE

    positions.push(current.x + nx * half, 0, current.z + nz * half)
    positions.push(current.x - nx * half, 0, current.z - nz * half)
    uvs.push(0, v, 1, v)

    if (i < points.length - 1) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

/**
 * Chevron strip with soft edges, generated once.
 * Soft edges matter: a hard-edged ribbon on uneven ground reads as a sticker
 * lying on top of the field rather than a marking on it.
 */
let flowTexture = null
function createFlowTexture() {
  if (flowTexture) return flowTexture

  const width = 64
  const height = 128
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Base: transparent at the edges, solid down the middle.
  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.75)')
  gradient.addColorStop(0.75, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Chevrons pointing along +v.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (let i = 0; i < 2; i++) {
    const y = i * (height / 2) + height / 4
    ctx.beginPath()
    ctx.moveTo(width * 0.24, y + 11)
    ctx.lineTo(width * 0.5, y - 9)
    ctx.lineTo(width * 0.76, y + 11)
    ctx.stroke()
  }

  flowTexture = new THREE.CanvasTexture(canvas)
  flowTexture.wrapS = THREE.ClampToEdgeWrapping
  flowTexture.wrapT = THREE.RepeatWrapping
  flowTexture.colorSpace = THREE.SRGBColorSpace
  return flowTexture
}

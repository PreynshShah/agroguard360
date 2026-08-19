import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

import { SUN_POSITION } from '../../systems/sceneConfig'
import { FLIGHT_CONFIG } from '../../systems/flightModel'

/**
 * ProjectedShadow
 * The drone's shadow on the ground.
 *
 * Why not a real shadow map: the rest of the scene bakes its shadows once and
 * never updates them, which is what keeps ~9,300 crop instances affordable.
 * Turning that back on so one small moving object can cast a shadow would mean
 * re-rendering the entire field into a 4096² depth map every frame — an
 * enormous cost for a shadow a metre across.
 *
 * So this projects the shadow properly instead of faking its placement: the
 * blob is cast along the actual sun vector, landing where the geometry says it
 * should. It also widens and fades with altitude, which is real behaviour —
 * a shadow's penumbra grows with the caster's distance from the surface.
 */
export function ProjectedShadow({ craft, radius = 0.6 }) {
  const meshRef = useRef()

  // Soft radial falloff, generated rather than loaded.
  const texture = useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(0,0,0,0.62)')
    gradient.addColorStop(0.45, 'rgba(0,0,0,0.34)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])

  // Sun direction, normalised once. Dividing by its Y component gives the
  // ground offset per metre of altitude.
  const slope = useMemo(() => {
    const sun = new THREE.Vector3(...SUN_POSITION).normalize()
    return { x: sun.x / sun.y, z: sun.z / sun.y }
  }, [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const altitude = Math.max(0, craft.position.y)

    // Project along the sun ray to the ground plane.
    mesh.position.set(
      craft.position.x - altitude * slope.x,
      0.075,
      craft.position.z - altitude * slope.z,
    )

    // Penumbra grows and darkness falls off with height.
    const spread = 1 + (altitude / FLIGHT_CONFIG.hoverAltitude) * 1.5
    mesh.scale.setScalar(radius * 2 * spread)
    mesh.material.opacity = THREE.MathUtils.clamp(0.85 - (altitude / FLIGHT_CONFIG.hoverAltitude) * 0.5, 0.16, 0.85)

    // The shadow rotates with the aircraft's heading, so it is not a
    // permanently round blob under a rectangular airframe.
    mesh.rotation.z = -craft.yaw
  })

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.7}
        depthWrite={false}
        // Multiply so it darkens the soil beneath rather than painting grey
        // over it — a flat grey blob on brown soil looks like a sticker.
        blending={THREE.MultiplyBlending}
      />
    </mesh>
  )
}

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

import { TalosModel, STATUS_COLORS, SHADOW_BY_FORM, TALOS_FORM } from '../../models/TalosModel'
import { IrrigationSpray } from './IrrigationSpray'

/**
 * TalosRig
 * Everything that moves TALOS, kept apart from everything that draws it.
 *
 * As with the drone, all animation is written straight to object transforms
 * inside useFrame — nothing here triggers a React render.
 *
 * The rover has no projected shadow of its own: unlike PEGASUS it sits on the
 * ground, where a blob under a vehicle standing 30 cm up would read as a
 * smudge. It casts a real shadow instead, and because the scene's shadow map
 * is baked after four frames, that shadow is the one baked at its parked
 * position. A moving vehicle dragging a stationary shadow would be obvious, so
 * the chassis is excluded from casting and a small contact shadow travels with
 * it instead.
 */
export function TalosRig({ controller }) {
  const groupRef = useRef()
  const lidarRef = useRef()
  const statusRef = useRef()
  const contactRef = useRef()

  // Front-left, front-right, rear-left, rear-right.
  const wheelRefs = [useRef(), useRef(), useRef(), useRef()]

  useFrame((_, delta) => {
    controller.update(delta)

    const rover = controller.rover
    const group = groupRef.current
    if (!group) return

    group.position.set(rover.x, 0, rover.z)
    group.rotation.y = rover.heading

    // Wheels rotate about their own local X once the model has stood them up.
    wheelRefs.forEach((ref, index) => {
      if (!ref.current) return
      const isLeft = index === 0 || index === 2
      // About X: the axle runs along X once the inner group has laid the
      // cylinder on its side. Spinning about Y would turn it like a turntable.
      ref.current.rotation.x = isLeft ? rover.wheelLeft : rover.wheelRight
    })

    // The LiDAR drum turns whenever the rover is powered and working.
    if (lidarRef.current) {
      const spinning = rover.mode === 'navigating' || rover.mode === 'inspecting'
      lidarRef.current.rotation.y += (spinning ? 6.2 : 0) * delta
    }

    // Status lamp: colour by mode, and a slow pulse while inspecting so a
    // stationary rover still looks like it is doing something.
    if (statusRef.current) {
      const color = STATUS_COLORS[rover.mode] ?? STATUS_COLORS.idle
      statusRef.current.material.color.set(color)
      statusRef.current.material.emissive.set(color)
      statusRef.current.material.emissiveIntensity =
        rover.mode === 'inspecting' ? 1.1 + Math.sin(performance.now() * 0.004) * 0.6 : 1.4
    }

    if (contactRef.current) {
      contactRef.current.position.set(rover.x, 0.08, rover.z)
      contactRef.current.rotation.z = -rover.heading
    }
  })

  return (
    <>
      <group ref={groupRef}>
        <TalosModel
          wheelRefs={wheelRefs}
          lidarRef={lidarRef}
          statusRef={statusRef}
          rover={controller.rover}
        />

        {/* Inside the rover's group, so the spray inherits its position and
            heading and stays attached to the boom. */}
        <IrrigationSpray rover={controller.rover} />
      </group>

      {/* Contact shadow, travelling with the vehicle. */}
      <mesh
        ref={contactRef}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
        raycast={() => null}
      >
        <planeGeometry args={SHADOW_BY_FORM[TALOS_FORM] ?? SHADOW_BY_FORM.rover} />
        <meshBasicMaterial
          map={getContactTexture()}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.MultiplyBlending}
        />
      </mesh>
    </>
  )
}

/**
 * Soft elliptical falloff under the chassis, built once.
 * Multiply blending darkens the soil beneath rather than painting grey on it.
 */
let contactTexture = null
function getContactTexture() {
  if (contactTexture) return contactTexture

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0,0,0,0.6)')
  gradient.addColorStop(0.5, 'rgba(0,0,0,0.28)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  contactTexture = new THREE.CanvasTexture(canvas)
  contactTexture.colorSpace = THREE.SRGBColorSpace
  return contactTexture
}

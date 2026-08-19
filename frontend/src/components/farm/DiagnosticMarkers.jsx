import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

import { ZONES } from '../../systems/farmLayout'
import { CLASSES } from '../../systems/buddhi/classes'

/**
 * DiagnosticMarkers
 * Flags the zones BUDDHI found problems in.
 *
 * The restraint here is deliberate. The obvious way to show a detection is a
 * glowing beam and a pulsing hologram, and it would wreck the scene — the
 * whole point of Phases 2 and 3 was a field that looks real. So this borrows
 * from what a surveyor actually leaves behind: a marker on a slim staff, a
 * ring on the ground where the reading was taken, and a colour that means
 * something.
 *
 * Three things carry the diagnosis, so it survives being read badly:
 *
 *   colour  ochre for water stress, violet for disease, brick for pest damage
 *   shape   a droplet, a lesion cluster, a chewed disc
 *   height  severity raises the marker, so a High reads from further away
 *
 * Shape matters as much as colour: roughly one man in twelve has some form of
 * colour blindness, and ochre against brick is exactly the pair that fails.
 */

/** Marker height above ground, by severity. */
const STAFF_HEIGHT = { low: 2.6, medium: 3.2, high: 3.9 }
const MARKER_SCALE = { low: 0.72, medium: 0.88, high: 1.05 }

export function DiagnosticMarkers({ results }) {
  const zoneById = useMemo(() => Object.fromEntries(ZONES.map((z) => [z.id, z])), [])

  const markers = useMemo(
    () =>
      Object.values(results ?? {})
        .filter((result) => result.problem && result.problem !== 'healthy')
        .map((result) => ({ ...result, zone: zoneById[result.zoneId] }))
        .filter((marker) => marker.zone),
    [results, zoneById],
  )

  if (markers.length === 0) return null

  return (
    <group>
      {markers.map((marker) => (
        <ZoneMarker key={marker.zoneId} marker={marker} />
      ))}
    </group>
  )
}

function ZoneMarker({ marker }) {
  const bobRef = useRef()
  const spec = CLASSES[marker.problem]
  const height = STAFF_HEIGHT[marker.severity] ?? 3
  const scale = MARKER_SCALE[marker.severity] ?? 0.85

  // Offset each marker's cycle by its position, so a field of them drifts
  // rather than pulsing in unison like a row of indicator lights.
  const phase = useMemo(
    () => (marker.zone.centerX + marker.zone.centerZ) * 0.07,
    [marker.zone],
  )

  useFrame((state) => {
    if (!bobRef.current) return
    const t = state.clock.elapsedTime + phase
    bobRef.current.position.y = height + Math.sin(t * 0.9) * 0.11
    bobRef.current.rotation.y = t * 0.22
  })

  return (
    <group position={[marker.zone.centerX, 0, marker.zone.centerZ]}>
      {/* Ground ring where the reading was taken */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} raycast={() => null}>
        <ringGeometry args={[2.9, 3.3, 48]} />
        <meshBasicMaterial
          color={spec.color}
          transparent
          opacity={0.42}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Staff — thin enough to read as a survey pole, not a beam of light */}
      <mesh position={[0, height / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.018, 0.018, height, 6]} />
        <meshBasicMaterial color={spec.color} transparent opacity={0.5} depthWrite={false} />
      </mesh>

      <group ref={bobRef} position={[0, height, 0]} scale={scale}>
        <MarkerHead kind={spec.marker} color={spec.color} />

        {/* A soft halo, kept faint. Additive blending is what would tip this
            into science fiction, so it is a plain transparent sprite. */}
        <sprite scale={[1.9, 1.9, 1]} raycast={() => null}>
          <spriteMaterial
            map={getHaloTexture()}
            color={spec.color}
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </sprite>
      </group>
    </group>
  )
}

/**
 * The marker head. Each condition gets a silhouette that means something,
 * rather than three colours of the same ball.
 */
function MarkerHead({ kind, color }) {
  const material = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      // Low enough to read as a painted marker catching light, not a lamp.
      emissiveIntensity={0.55}
      roughness={0.55}
      metalness={0.1}
    />
  )

  if (kind === 'droplet') {
    // A cone under a hemisphere — a falling drop, point down.
    return (
      <group raycast={() => null}>
        <mesh position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 0.42, 14]} />
          {material}
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {material}
        </mesh>
      </group>
    )
  }

  if (kind === 'lesion') {
    // A cluster of small spots, the way leaf lesions actually appear.
    const spots = [
      [0, 0.12, 0, 0.17],
      [0.16, -0.06, 0.05, 0.12],
      [-0.14, -0.02, -0.07, 0.1],
      [0.02, -0.18, 0.1, 0.09],
    ]
    return (
      <group raycast={() => null}>
        {spots.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[r, 12, 10]} />
            {material}
          </mesh>
        ))}
      </group>
    )
  }

  // Pest damage: a disc with bites taken out of the rim.
  return (
    <group raycast={() => null}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.07, 18]} />
        {material}
      </mesh>
      {[0.4, 1.9, 3.3, 4.9].map((angle, i) => (
        <mesh
          key={i}
          position={[Math.cos(angle) * 0.26, Math.sin(angle) * 0.26, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.085, 0.085, 0.09, 10]} />
          {/* Matches the sky rather than the marker, so it reads as a hole. */}
          <meshBasicMaterial color="#cfdae4" />
        </mesh>
      ))}
    </group>
  )
}

/**
 * A soft radial falloff, built once and shared by every marker.
 * Module-level cache rather than a hook-per-marker, so seven markers upload
 * one texture between them.
 */
let haloTexture = null
function getHaloTexture() {
  if (!haloTexture) {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,0.85)')
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.28)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    haloTexture = new THREE.CanvasTexture(canvas)
    haloTexture.colorSpace = THREE.SRGBColorSpace
  }
  return haloTexture
}

import { useMemo, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'

import { ZONES, makeRandom } from '../../systems/farmLayout'
import { CLASSES } from '../../systems/buddhi/classes'

/**
 * ZoneOverlay
 * The interactive layer: sixteen flat pick targets, one per zone.
 *
 * Two decisions worth knowing about:
 *
 * 1. Labels are not persistent. Sixteen floating tags would bury the field
 *    under interface, so a zone only names itself when the pointer is on it
 *    or it has been selected.
 *
 * 2. Boundaries are marked by small corner stakes rather than painted lines.
 *    A real field is divided by tracks and survey pegs, so the pegs are the
 *    honest device — and they stay legible at distance where a hairline
 *    outline would shimmer.
 *
 * Vegetation has picking disabled, so these planes are the only thing the
 * raycaster tests each frame. That keeps hover cheap despite ~7,000 plants.
 */
export function ZoneOverlay({ hoveredId, selectedId, onHover, onSelect, results, activeZone }) {
  return (
    <group>
      <ZoneStakes />

      {ZONES.map((zone) => (
        <ZonePlane
          key={zone.id}
          zone={zone}
          hovered={hoveredId === zone.id}
          selected={selectedId === zone.id}
          diagnosis={results?.[zone.id]}
          scanning={activeZone === zone.id}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}

function ZonePlane({ zone, hovered, selected, diagnosis, scanning, onHover, onSelect }) {
  const active = hovered || selected

  // A diagnosed problem tints its zone permanently, so the field itself shows
  // where the trouble is without needing the results panel open.
  const problem = diagnosis && diagnosis.problem !== 'healthy' ? CLASSES[diagnosis.problem] : null

  const tint = scanning ? '#f4f7ee' : problem ? problem.color : selected ? '#d8e8c4' : '#eaf2df'
  const opacity = scanning ? 0.3 : problem ? 0.2 : selected ? 0.17 : hovered ? 0.1 : 0

  return (
    <group position={[zone.centerX, 0, zone.centerZ]}>
      {/* Pick target. Kept transparent at rest so it tints the soil only when
          active — the plane itself is always present for raycasting. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
        onPointerOver={(event) => {
          event.stopPropagation()
          onHover(zone.id)
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          onHover(null)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(selected ? null : zone.id)
        }}
      >
        <planeGeometry args={[zone.width, zone.depth]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={hovered && problem ? Math.min(0.32, opacity + 0.1) : opacity}
          depthWrite={false}
        />
      </mesh>

      {(active || scanning) && <ZoneFrame zone={zone} selected={selected} />}

      {active && (
        <Html
          position={[0, 2.2, 0]}
          center
          // Scales with distance so the label stays readable when zoomed out
          // without ballooning when the camera is close.
          distanceFactor={26}
          zIndexRange={[10, 0]}
          // Without this the label intercepts the pointer and the hover it was
          // triggered by immediately cancels itself.
          style={{ pointerEvents: 'none' }}
        >
          <div className={`zone-tag${selected ? ' zone-tag--selected' : ''}`}>
            <span className="zone-tag__id">{zone.id}</span>
            <span className="zone-tag__meta">
              {problem ? problem.label : diagnosis ? 'Healthy' : zone.crop}
            </span>
          </div>
        </Html>
      )}
    </group>
  )
}

/**
 * ZoneFrame
 * Corner brackets rather than a full outline — it reads as a selection marker
 * instead of a box drawn on the mud.
 */
function ZoneFrame({ zone, selected }) {
  const halfW = zone.width / 2
  const halfD = zone.depth / 2
  const arm = 2.6
  const thickness = 0.12
  const color = selected ? '#e8f2d8' : '#cdd8bd'

  const corners = [
    [-halfW, -halfD, 1, 1],
    [halfW, -halfD, -1, 1],
    [-halfW, halfD, 1, -1],
    [halfW, halfD, -1, -1],
  ]

  return (
    <group position={[0, 0.075, 0]}>
      {corners.map(([cx, cz, dx, dz], i) => (
        <group key={i}>
          <mesh position={[cx + (dx * arm) / 2, 0, cz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[arm, thickness]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <mesh position={[cx, 0, cz + (dz * arm) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[thickness, arm]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * ZoneStakes
 * A weathered timber peg at each zone corner. Instanced — 64 pegs, one draw
 * call — and excluded from picking so they never steal a hover from the zone.
 */
function ZoneStakes() {
  const meshRef = useRef()

  const stakes = useMemo(() => {
    const random = makeRandom(777)
    const out = []

    for (const zone of ZONES) {
      const halfW = zone.width / 2
      const halfD = zone.depth / 2

      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        out.push({
          x: zone.centerX + dx * (halfW + 0.35),
          z: zone.centerZ + dz * (halfD + 0.35),
          height: 0.55 + random() * 0.22,
          lean: (random() - 0.5) * 0.16,
          rotation: random() * Math.PI,
          shade: 0.8 + random() * 0.35,
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

    stakes.forEach((stake, i) => {
      dummy.position.set(stake.x, stake.height / 2, stake.z)
      dummy.rotation.set(stake.lean, stake.rotation, stake.lean * 0.7)
      dummy.scale.set(1, stake.height, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      color.setRGB(stake.shade * 0.55, stake.shade * 0.47, stake.shade * 0.36)
      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [stakes])

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, stakes.length]}
      castShadow
      raycast={() => null}
    >
      <boxGeometry args={[0.06, 1, 0.06]} />
      <meshStandardMaterial roughness={0.95} metalness={0} />
    </instancedMesh>
  )
}

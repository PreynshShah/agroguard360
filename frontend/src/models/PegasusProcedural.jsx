import { useMemo } from 'react'
import * as THREE from 'three'

import { PEGASUS_SPEC as S } from './PegasusModel'

/**
 * PegasusProcedural
 * The quadcopter airframe, built from primitives.
 *
 * The things that make a drone read as professional equipment rather than a
 * toy, in rough order of importance:
 *
 *   - Arms long enough that the props clear the body by a wide margin. Toy
 *     drones have stubby arms; survey drones look almost spindly.
 *   - Matte, near-black composite. Gloss and bright colour read as consumer.
 *   - A gimbal that is visibly a separate assembly on vibration mounts, not a
 *     camera glued to the underside.
 *   - Landing legs tall enough to give the gimbal ground clearance, which is
 *     the whole reason survey drones stand so high.
 *   - Asymmetry front to back: the nose carries sensors, the tail carries the
 *     battery. Perfectly symmetrical drones look like ornaments.
 */
export function PegasusProcedural({ rotorRefs, navLightRef, gimbalRef }) {
  // Motors sit at the corners of a square whose diagonal is the wheelbase.
  const armReach = S.wheelbase / 2
  const armOffset = armReach / Math.SQRT2

  const arms = useMemo(
    () => [
      { key: 'fr', x: armOffset, z: -armOffset, spin: 1, light: 'front' },
      { key: 'fl', x: -armOffset, z: -armOffset, spin: -1, light: 'front' },
      { key: 'br', x: armOffset, z: armOffset, spin: -1, light: 'rear' },
      { key: 'bl', x: -armOffset, z: armOffset, spin: 1, light: 'rear' },
    ],
    [armOffset],
  )

  return (
    <group>
      <Fuselage />
      <Battery />
      <Antennas />

      {arms.map((arm, index) => (
        <ArmAssembly
          key={arm.key}
          arm={arm}
          rotorRef={rotorRefs[index]}
          navLightRef={arm.key === 'fr' ? navLightRef : undefined}
        />
      ))}

      <LandingGear />
      <GimbalCamera gimbalRef={gimbalRef} />
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Materials
 * ------------------------------------------------------------------ */

/** Matte composite shell — dark, low sheen, slightly warm. */
/**
 * White airframe. Low metalness for the same reason as the rover — painted
 * composite, not chrome.
 */
function ShellMaterial(props) {
  return <meshStandardMaterial color="#e6e4dd" roughness={0.6} metalness={0.14} {...props} />
}

/** Carbon fibre tube — darker and flatter than the shell. */
/**
 * Arms and propellers stay dark.
 *
 * Deliberate: real survey aircraft pair a white body with carbon arms and dark
 * blades, and spinning blades are only legible against the ground when they
 * contrast with it. White props on a pale sky would disappear entirely.
 */
function CarbonMaterial(props) {
  return <meshStandardMaterial color="#22262a" roughness={0.5} metalness={0.32} {...props} />
}

/** Machined aluminium, as used for motor bells and gimbal brackets. */
function AlloyMaterial(props) {
  return <meshStandardMaterial color="#6e747a" roughness={0.34} metalness={0.85} {...props} />
}

/* ------------------------------------------------------------------ *
 * Body
 * ------------------------------------------------------------------ */

function Fuselage() {
  return (
    <group>
      {/* Lower chassis */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[S.bodyWidth, S.bodyHeight * 0.55, S.bodyLength]} />
        <ShellMaterial />
      </mesh>

      {/* Upper canopy, tapered and set back — the nose slopes down. */}
      <mesh position={[0, S.bodyHeight * 0.42, 0.012]} castShadow receiveShadow>
        <boxGeometry args={[S.bodyWidth * 0.86, S.bodyHeight * 0.5, S.bodyLength * 0.78]} />
        <ShellMaterial color="#dcdad3" />
      </mesh>

      {/* Nose cone: houses the forward obstacle sensors. */}
      <mesh position={[0, 0.004, -S.bodyLength * 0.52]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[S.bodyWidth * 0.3, S.bodyWidth * 0.42, 0.07, 12]} />
        <ShellMaterial color="#e0ded7" />
      </mesh>

      {/* Forward sensor pair, recessed into the nose. */}
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, 0.006, -S.bodyLength * 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.012, 10]} />
          <meshStandardMaterial color="#0d1013" roughness={0.15} metalness={0.5} />
        </mesh>
      ))}

      {/* Heat-sink vents along the flanks. */}
      {[-1, 1].map((side) =>
        [0, 1, 2].map((i) => (
          <mesh
            key={`${side}-${i}`}
            position={[side * S.bodyWidth * 0.44, S.bodyHeight * 0.12, -0.03 + i * 0.035]}
            castShadow
          >
            <boxGeometry args={[0.005, 0.016, 0.022]} />
            <meshStandardMaterial color="#0f1113" roughness={0.7} metalness={0.2} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** Battery pack, slotted into the rear of the chassis. */
function Battery() {
  return (
    <group position={[0, S.bodyHeight * 0.12, S.bodyLength * 0.36]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[S.bodyWidth * 0.78, S.bodyHeight * 0.62, S.bodyLength * 0.3]} />
        <meshStandardMaterial color="#1d2023" roughness={0.55} metalness={0.2} />
      </mesh>
      {/* Release catch */}
      <mesh position={[0, 0, S.bodyLength * 0.16]} castShadow>
        <boxGeometry args={[0.05, 0.014, 0.008]} />
        <AlloyMaterial />
      </mesh>
    </group>
  )
}

/** GPS puck and telemetry whips. */
function Antennas() {
  return (
    <group>
      <mesh position={[0, S.bodyHeight * 0.72, 0.03]} castShadow>
        <cylinderGeometry args={[0.032, 0.034, 0.014, 14]} />
        <meshStandardMaterial color="#3a3e42" roughness={0.5} metalness={0.3} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.055, S.bodyHeight * 0.4, S.bodyLength * 0.45]}
          rotation={[0.32 * side, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.004, 0.004, 0.1, 6]} />
          <meshStandardMaterial color="#111315" roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Arms, motors, rotors
 * ------------------------------------------------------------------ */

function ArmAssembly({ arm, rotorRef, navLightRef }) {
  const length = Math.hypot(arm.x, arm.z)
  const angle = Math.atan2(arm.x, -arm.z)

  return (
    <group>
      {/* Arm tube, angled slightly upward toward the motor as real airframes are */}
      <group rotation={[0, angle, 0]}>
        <mesh position={[0, 0.006, -length / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.014, 0.019, length, 10]} />
          <CarbonMaterial />
        </mesh>

        {/* Root fairing where the arm meets the body */}
        <mesh position={[0, 0.004, -S.bodyLength * 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.03, 0.05, 10]} />
          <ShellMaterial />
        </mesh>
      </group>

      <group position={[arm.x, 0.012, arm.z]}>
        {/* Motor mount */}
        <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.028, 0.032, 0.016, 12]} />
          <ShellMaterial />
        </mesh>

        {/* Motor bell */}
        <mesh position={[0, 0.012 + S.motorHeight / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.026, 0.024, S.motorHeight, 16]} />
          <AlloyMaterial color="#5c6268" />
        </mesh>

        {/* Stator vents — the detail that reads as a real brushless motor */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.023, 0.012 + S.motorHeight * 0.5, Math.sin(a) * 0.023]}
              rotation={[0, -a, 0]}
            >
              <boxGeometry args={[0.004, S.motorHeight * 0.6, 0.009]} />
              <meshStandardMaterial color="#24272a" roughness={0.6} metalness={0.5} />
            </mesh>
          )
        })}

        {/* Rotor hub — the parent spins this whole group */}
        <group ref={rotorRef} position={[0, 0.012 + S.motorHeight + 0.006, 0]}>
          <Propeller spin={arm.spin} />
        </group>

        {/* Navigation light on the underside of each motor pod */}
        <mesh ref={navLightRef} position={[0, -0.004, 0]}>
          <sphereGeometry args={[0.011, 10, 8]} />
          <meshStandardMaterial
            color={arm.light === 'front' ? '#39d17a' : '#e0453a'}
            emissive={arm.light === 'front' ? '#39d17a' : '#e0453a'}
            emissiveIntensity={2.4}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  )
}

/**
 * A two-blade folding propeller.
 *
 * Blades are built with real twist — high pitch at the root falling off toward
 * the tip. It is barely visible at rest and invisible in motion, but a flat
 * rectangular blade is instantly readable as fake in a still frame.
 */
function Propeller({ spin }) {
  const geometry = useMemo(() => createBladeGeometry(S.propRadius), [])

  return (
    <group>
      {/* Hub */}
      <mesh castShadow>
        <cylinderGeometry args={[0.016, 0.018, 0.012, 12]} />
        <ShellMaterial color="#c9c6be" />
      </mesh>

      {[0, Math.PI].map((angle, i) => (
        <mesh
          key={i}
          geometry={geometry}
          rotation={[0, angle, 0]}
          scale={[spin, 1, 1]}
          castShadow
        >
          <meshStandardMaterial
            color="#1b1d20"
            roughness={0.42}
            metalness={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Builds one propeller blade: a strip that widens then tapers, with the
 * chord twisting from root to tip.
 */
function createBladeGeometry(radius) {
  const segments = 7
  const geometry = new THREE.PlaneGeometry(radius, 0.032, segments, 1)
  const position = geometry.attributes.position

  for (let v = 0; v < position.count; v++) {
    const x = position.getX(v)
    const y = position.getY(v)

    // 0 at the hub, 1 at the tip.
    const t = THREE.MathUtils.clamp((x + radius / 2) / radius, 0, 1)

    // Chord: narrow at the root, widest at ~40%, tapering to the tip.
    const chord = Math.sin(Math.pow(t, 0.55) * Math.PI * 0.92) * 0.9 + 0.18
    // Twist: steep pitch at the root, flattening toward the tip.
    const twist = (1 - t) * 0.55

    const newY = y * chord
    position.setY(v, newY * Math.cos(twist))
    position.setZ(v, newY * Math.sin(twist))
    // Shift the blade outward so it starts at the hub, not the centre.
    position.setX(v, x + radius / 2)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/* ------------------------------------------------------------------ *
 * Landing gear and gimbal
 * ------------------------------------------------------------------ */

/**
 * Tall landing legs. The height is not decoration: it is what gives the gimbal
 * clearance to rotate without striking the ground, and it is the main reason
 * survey drones stand so much higher than consumer ones.
 */
function LandingGear() {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Splayed strut */}
          <mesh
            position={[side * 0.085, -S.legHeight * 0.5, 0]}
            rotation={[0, 0, side * 0.28]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.008, 0.011, S.legHeight, 8]} />
            <CarbonMaterial />
          </mesh>

          {/* Skid tube running fore and aft */}
          <mesh
            position={[side * 0.118, -S.legHeight - 0.005, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.011, 0.011, S.bodyLength * 1.05, 8]} />
            <CarbonMaterial color="#131517" />
          </mesh>

          {/* Rubber end caps */}
          {[-1, 1].map((end) => (
            <mesh
              key={end}
              position={[side * 0.118, -S.legHeight - 0.005, (end * S.bodyLength * 1.05) / 2]}
              castShadow
            >
              <sphereGeometry args={[0.013, 8, 6]} />
              <meshStandardMaterial color="#0f1112" roughness={0.9} metalness={0} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/**
 * Three-axis gimbal and inspection camera, slung under the nose.
 *
 * Built as a visible chain of brackets — vibration mount, yaw arm, roll arm,
 * then the camera body — because that separation is exactly what distinguishes
 * a stabilised survey payload from a fixed camera moulded into the shell.
 */
/**
 * The gimbal is handed a ref so the flight rig can counter-rotate it against
 * the airframe's bank. A real stabilised camera stays level while the aircraft
 * tilts — if it tips with the body, the whole thing reads as a plastic prop.
 */
function GimbalCamera({ gimbalRef }) {
  return (
    <group position={[0, -S.bodyHeight * 0.5, -S.bodyLength * 0.3]}>
      {/* Vibration-damping mount — fixed to the airframe, so it stays outside
          the stabilised pivot below. */}
      <mesh position={[0, -0.012, 0]} castShadow>
        <boxGeometry args={[0.07, 0.018, 0.05]} />
        <ShellMaterial color="#d5d2ca" />
      </mesh>

      {/* Damping balls at the corners */}
      {[
        [-0.028, -0.018],
        [0.028, -0.018],
        [-0.028, 0.018],
        [0.028, 0.018],
      ].map(([bx, bz], i) => (
        <mesh key={i} position={[bx, -0.022, bz]}>
          <sphereGeometry args={[0.007, 8, 6]} />
          <meshStandardMaterial color="#8a3f38" roughness={0.75} metalness={0.05} />
        </mesh>
      ))}

      {/* Everything below this pivot is what the gimbal motors hold level. */}
      <group ref={gimbalRef}>
      {/* Yaw arm */}
      <mesh position={[0, -0.038, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, 0.032, 10]} />
        <AlloyMaterial />
      </mesh>

      {/* Roll arm, offset to one side as on a real gimbal */}
      <mesh position={[-0.032, -0.058, 0]} castShadow>
        <boxGeometry args={[0.012, 0.042, 0.016]} />
        <AlloyMaterial color="#5f656b" />
      </mesh>
      <mesh position={[-0.016, -0.076, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.034, 10]} />
        <AlloyMaterial />
      </mesh>

      {/* Camera body */}
      <group position={[0.006, -0.076, -0.006]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.052, 0.046, 0.058]} />
          <ShellMaterial color="#d5d2ca" />
        </mesh>

        {/* Lens barrel */}
        <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.019, 0.021, 0.026, 16]} />
          <meshStandardMaterial color="#111315" roughness={0.35} metalness={0.6} />
        </mesh>

        {/* Front element — the one place a little gloss belongs */}
        <mesh position={[0, 0, -0.054]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.003, 16]} />
          <meshStandardMaterial
            color="#14202b"
            roughness={0.06}
            metalness={0.9}
            emissive="#0d1a24"
            emissiveIntensity={0.35}
          />
        </mesh>

        {/* Multispectral sensor beside the main lens — this is an agricultural
            payload, and NDVI imaging is the job it exists to do. */}
        <mesh position={[0.032, 0.004, -0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.009, 0.009, 0.016, 10]} />
          <meshStandardMaterial color="#1a1d20" roughness={0.3} metalness={0.55} />
        </mesh>
      </group>
      </group>
    </group>
  )
}

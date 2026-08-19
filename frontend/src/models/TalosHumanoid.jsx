import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

import { HUMANOID_SPEC as H } from './talosSpec'

/**
 * TalosHumanoid
 * TALOS as a walking field robot rather than a wheeled rover.
 *
 * ---------------------------------------------------------------------------
 * How the walk is driven
 * ---------------------------------------------------------------------------
 * Nothing in the motion model changed. It still reports two wheel rotations,
 * and this reads them as a gait signal:
 *
 *   stride distance = (wheelLeft + wheelRight) / 2 × wheelRadius
 *
 * Taking the *average* is what makes it correct. Driving forward turns both
 * counters the same way, so the average advances and the legs step. Turning in
 * place counters them against each other, so the average cancels and the legs
 * stop stepping — which is exactly right, because the robot is pivoting, not
 * walking. Using one counter alone would have it striding on the spot through
 * every corner.
 *
 * The difference between the two counters is then used for a small pivot
 * shuffle, so a turn is not completely rigid either.
 *
 * This component animates itself rather than being posed from the rig. A
 * humanoid needs eight joints moving in phase, and threading eight refs up
 * through the model seam would make the seam about limbs instead of about
 * swapping the model.
 */
export function TalosHumanoid({ rover, statusRef, lidarRef }) {
  const bodyRef = useRef()
  const hipRef = useRef()
  const torsoRef = useRef()
  const headRef = useRef()

  const legs = { left: useRef(), right: useRef() }
  const shins = { left: useRef(), right: useRef() }
  const feet = { left: useRef(), right: useRef() }
  const arms = { left: useRef(), right: useRef() }
  const forearms = { left: useRef(), right: useRef() }

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // Gait phase from distance covered, so the legs stay in step with the
    // ground at any speed — no sliding feet.
    const stride = ((rover.wheelLeft + rover.wheelRight) / 2) * H.wheelRadius
    const phase = (stride / H.strideLength) * Math.PI * 2
    const pivot = (rover.wheelLeft - rover.wheelRight) * 0.5

    const walking = rover.phase === 'driving' && Math.abs(rover.speed) > 0.05
    const turning = rover.phase === 'turning'

    // Swing amplitude eases in and out so starting and stopping is not a snap.
    const swing = walking ? Math.min(1, Math.abs(rover.speed) / 1.2) : 0
    const idleBreath = Math.sin(t * 1.4) * 0.012

    const sin = Math.sin(phase)
    const cos = Math.cos(phase)

    // Legs: thigh swings, knee only ever bends backward.
    if (legs.left.current && legs.right.current) {
      legs.left.current.rotation.x = sin * 0.52 * swing
      legs.right.current.rotation.x = -sin * 0.52 * swing

      shins.left.current.rotation.x = -Math.max(0, Math.sin(phase - 0.7)) * 0.85 * swing
      shins.right.current.rotation.x = -Math.max(0, Math.sin(phase + Math.PI - 0.7)) * 0.85 * swing

      // Feet stay roughly level with the ground rather than pointing wherever
      // the leg happens to aim.
      feet.left.current.rotation.x =
        -legs.left.current.rotation.x - shins.left.current.rotation.x * 0.6
      feet.right.current.rotation.x =
        -legs.right.current.rotation.x - shins.right.current.rotation.x * 0.6
    }

    // Arms counter-swing. The right arm holds the spray wand, so it swings less.
    if (arms.left.current && arms.right.current) {
      arms.left.current.rotation.x = -sin * 0.42 * swing
      arms.right.current.rotation.x = sin * 0.18 * swing

      forearms.left.current.rotation.x = -0.25 - Math.max(0, -sin) * 0.3 * swing
      // Held forward, ready to spray.
      forearms.right.current.rotation.x = -0.95
    }

    // Body rises on each step and rocks slightly — a walk that stays at one
    // height reads as a model sliding along a rail.
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.abs(cos) * 0.028 * swing
      bodyRef.current.rotation.z = sin * 0.035 * swing + (turning ? Math.sin(pivot * 6) * 0.02 : 0)
    }

    if (hipRef.current) {
      hipRef.current.rotation.y = sin * 0.14 * swing
    }

    if (torsoRef.current) {
      // Shoulders counter-rotate against the hips, as in a real gait.
      torsoRef.current.rotation.y = -sin * 0.12 * swing + idleBreath
      torsoRef.current.rotation.x = walking ? 0.05 * swing : idleBreath
    }

    // Head looks down at the crop while inspecting, level while walking.
    if (headRef.current) {
      const target = rover.mode === 'inspecting' ? 0.42 : 0.06
      headRef.current.rotation.x += (target - headRef.current.rotation.x) * Math.min(1, delta * 3)
    }
  })

  return (
    <group ref={bodyRef}>
      <Legs legs={legs} shins={shins} feet={feet} />

      <group ref={hipRef} position={[0, H.hipHeight, 0]}>
        <Pelvis />

        <group ref={torsoRef}>
          <Torso />
          <BackpackTank />
          <PestKit />
          <Arms arms={arms} forearms={forearms} statusRef={statusRef} />

          <group ref={headRef} position={[0, H.torsoHeight + 0.09, 0]}>
            <Head lidarRef={lidarRef} />
          </group>
        </group>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Materials — same industrial palette as the rover
 * ------------------------------------------------------------------ */

/**
 * White bodywork.
 *
 * Metalness stays low: a light colour at high metalness turns mirror-like and
 * stops reading as painted machinery. The joints are deliberately left dark
 * metal — an all-white figure loses every edge and silhouette against a bright
 * field, and the contrast at the actuators is what makes it read as engineered.
 */
const Shell = (props) => (
  <meshStandardMaterial color="#e6e4dd" roughness={0.62} metalness={0.16} {...props} />
)
const Panel = (props) => (
  <meshStandardMaterial color="#c3c0b8" roughness={0.68} metalness={0.12} {...props} />
)
const Joint = (props) => (
  <meshStandardMaterial color="#7d838a" roughness={0.36} metalness={0.8} {...props} />
)
const Rubber = (props) => (
  <meshStandardMaterial color="#232628" roughness={0.94} metalness={0} {...props} />
)

/* ------------------------------------------------------------------ *
 * Body
 * ------------------------------------------------------------------ */

function Legs({ legs, shins, feet }) {
  return (
    <group>
      {['left', 'right'].map((side) => {
        const x = side === 'left' ? -H.hipWidth / 2 : H.hipWidth / 2
        return (
          <group key={side} ref={legs[side]} position={[x, H.hipHeight, 0]}>
            {/* Hip actuator */}
            <mesh castShadow>
              <sphereGeometry args={[0.075, 14, 10]} />
              <Joint />
            </mesh>

            {/* Thigh */}
            <mesh position={[0, -H.thighLength / 2, 0]} castShadow receiveShadow>
              <capsuleGeometry args={[0.062, H.thighLength * 0.7, 6, 10]} />
              <Shell />
            </mesh>

            <group ref={shins[side]} position={[0, -H.thighLength, 0]}>
              {/* Knee */}
              <mesh castShadow>
                <sphereGeometry args={[0.058, 12, 10]} />
                <Joint />
              </mesh>

              {/* Shin, with an exposed actuator down the front */}
              <mesh position={[0, -H.shinLength / 2, 0]} castShadow receiveShadow>
                <capsuleGeometry args={[0.05, H.shinLength * 0.7, 6, 10]} />
                <Shell />
              </mesh>
              <mesh position={[0, -H.shinLength * 0.45, 0.045]} castShadow>
                <cylinderGeometry args={[0.017, 0.017, H.shinLength * 0.55, 8]} />
                <Joint />
              </mesh>

              <group ref={feet[side]} position={[0, -H.shinLength, 0]}>
                {/* Ankle */}
                <mesh castShadow>
                  <sphereGeometry args={[0.046, 10, 8]} />
                  <Joint />
                </mesh>
                {/* Foot — wide and flat, as a field robot needs on soft soil */}
                <mesh position={[0, -0.035, 0.05]} castShadow receiveShadow>
                  <boxGeometry args={[0.13, 0.06, 0.27]} />
                  <Rubber />
                </mesh>
                <mesh position={[0, -0.062, 0.05]} castShadow>
                  <boxGeometry args={[0.15, 0.02, 0.29]} />
                  <Rubber color="#1a1c1e" />
                </mesh>
              </group>
            </group>
          </group>
        )
      })}
    </group>
  )
}

function Pelvis() {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[H.hipWidth + 0.09, 0.15, 0.17]} />
      <Shell />
    </mesh>
  )
}

function Torso() {
  return (
    <group>
      {/* Lower torso, narrower at the waist */}
      <mesh position={[0, H.torsoHeight * 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, H.torsoHeight * 0.42, 0.17]} />
        <Shell />
      </mesh>

      {/* Chest */}
      <mesh position={[0, H.torsoHeight * 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[H.shoulderWidth - 0.06, H.torsoHeight * 0.5, 0.2]} />
        <Shell />
      </mesh>

      {/* Chest panel, off-white to break up the dark shell */}
      <mesh position={[0, H.torsoHeight * 0.72, 0.105]} castShadow>
        <boxGeometry args={[H.shoulderWidth - 0.14, H.torsoHeight * 0.34, 0.02]} />
        <Panel />
      </mesh>

      {/* Cooling vents on the flanks */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (H.shoulderWidth / 2 - 0.035), H.torsoHeight * 0.7, 0]}
        >
          <boxGeometry args={[0.008, 0.11, 0.12]} />
          <meshStandardMaterial color="#22262a" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The water tank, worn as a backpack.
 *
 * Sits low and close to the spine. A tank mounted high would look like a
 * costume — a real load-carrying frame keeps mass near the hips, because that
 * is what a walking machine can balance.
 */
function BackpackTank() {
  const y = H.torsoHeight * 0.62
  const z = -0.16

  return (
    <group position={[0, y, z]}>
      {/* Carrier frame */}
      <mesh position={[0, 0, 0.045]} castShadow>
        <boxGeometry args={[0.28, 0.36, 0.03]} />
        <Shell color="#cfccc4" />
      </mesh>

      {/* Tank body */}
      <mesh position={[0, 0, -0.09]} castShadow receiveShadow>
        <capsuleGeometry args={[0.115, 0.2, 6, 16]} />
        <meshStandardMaterial color="#d8d5cc" roughness={0.52} metalness={0.06} />
      </mesh>

      {/* Retaining straps */}
      {[-0.09, 0.09].map((sy) => (
        <mesh key={sy} position={[0, sy, -0.09]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.119, 0.011, 6, 18]} />
          <Shell color="#8e9298" />
        </mesh>
      ))}

      {/* Sight strip so the level is readable */}
      <mesh position={[0.118, 0, -0.09]}>
        <boxGeometry args={[0.012, 0.2, 0.03]} />
        <meshStandardMaterial color="#7fa8ad" transparent opacity={0.75} roughness={0.2} />
      </mesh>

      {/* Filler cap */}
      <mesh position={[0, 0.19, -0.09]} castShadow>
        <cylinderGeometry args={[0.038, 0.038, 0.03, 12]} />
        <Shell color="#b9b6ae" />
      </mesh>

      {/* Shoulder straps up over the chest */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.1, 0.2, 0.12]}
          rotation={[0.5, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.055, 0.26, 0.022]} />
          <Rubber color="#2b2e31" />
        </mesh>
      ))}

      {/* Feed hose running round to the wand arm */}
      <mesh position={[0.13, -0.06, -0.02]} rotation={[0, 0, -0.7]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
        <meshStandardMaterial color="#4c5257" roughness={0.72} metalness={0.2} />
      </mesh>
    </group>
  )
}

/**
 * Pest-control kit: a slung satchel with treatment canisters.
 *
 * Separate from the water tank on purpose. This robot dispenses water itself;
 * the canisters are what it carries for a problem water cannot fix — the same
 * distinction the inspection logic makes when it refers a pest zone to a
 * person instead of irrigating it.
 */
function PestKit() {
  return (
    <group position={[-0.2, H.torsoHeight * 0.34, 0.04]} rotation={[0, 0, 0.12]}>
      {/* Satchel */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.15, 0.19, 0.11]} />
        <meshStandardMaterial color="#6f6a58" roughness={0.92} metalness={0} />
      </mesh>

      {/* Flap */}
      <mesh position={[0, 0.075, 0.012]} castShadow>
        <boxGeometry args={[0.155, 0.06, 0.115]} />
        <meshStandardMaterial color="#5d5847" roughness={0.94} metalness={0} />
      </mesh>

      {/* Canisters poking out of the top */}
      {[-0.04, 0.04].map((x) => (
        <mesh key={x} position={[x, 0.12, -0.01]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.075, 10]} />
          <meshStandardMaterial color="#8a7a55" roughness={0.68} metalness={0.16} />
        </mesh>
      ))}
      {[-0.04, 0.04].map((x) => (
        <mesh key={`cap${x}`} position={[x, 0.163, -0.01]} castShadow>
          <cylinderGeometry args={[0.021, 0.021, 0.016, 10]} />
          <meshStandardMaterial color="#a24f3f" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}

      {/* Cross-body strap */}
      <mesh position={[0.09, 0.16, 0.0]} rotation={[0, 0, -0.72]} castShadow>
        <boxGeometry args={[0.04, 0.34, 0.018]} />
        <Rubber color="#3a3630" />
      </mesh>
    </group>
  )
}

function Arms({ arms, forearms, statusRef }) {
  return (
    <group>
      {['left', 'right'].map((side) => {
        const dir = side === 'left' ? -1 : 1
        const x = dir * (H.shoulderWidth / 2)
        const y = H.torsoHeight * 0.86

        return (
          <group key={side} position={[x, y, 0]}>
            {/* Shoulder */}
            <mesh castShadow>
              <sphereGeometry args={[0.062, 14, 10]} />
              <Joint />
            </mesh>

            <group ref={arms[side]}>
              {/* Upper arm */}
              <mesh position={[0, -H.upperArmLength / 2, 0]} castShadow receiveShadow>
                <capsuleGeometry args={[0.046, H.upperArmLength * 0.65, 6, 10]} />
                <Shell />
              </mesh>

              <group ref={forearms[side]} position={[0, -H.upperArmLength, 0]}>
                {/* Elbow */}
                <mesh castShadow>
                  <sphereGeometry args={[0.044, 12, 8]} />
                  <Joint />
                </mesh>

                {/* Forearm */}
                <mesh position={[0, -H.forearmLength / 2, 0]} castShadow receiveShadow>
                  <capsuleGeometry args={[0.038, H.forearmLength * 0.62, 6, 10]} />
                  <Shell />
                </mesh>

                {/* Gripper */}
                <mesh position={[0, -H.forearmLength - 0.03, 0]} castShadow>
                  <boxGeometry args={[0.062, 0.075, 0.05]} />
                  <Shell color="#b9b6ae" />
                </mesh>

                {/* The right hand carries the spray wand. */}
                {side === 'right' && <SprayWand />}
              </group>
            </group>

            {/* Status lamp on the left shoulder */}
            {side === 'left' && (
              <mesh ref={statusRef} position={[dir * 0.035, 0.055, 0]} castShadow>
                <cylinderGeometry args={[0.026, 0.026, 0.032, 12]} />
                <meshStandardMaterial
                  color="#4a8f96"
                  emissive="#4a8f96"
                  emissiveIntensity={1.3}
                  roughness={0.3}
                />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

/**
 * Spray wand, held forward in the right hand.
 * Its tip is where IrrigationSpray emits from — see HUMANOID_SPEC.nozzle.
 */
function SprayWand() {
  return (
    <group position={[0, -H.forearmLength - 0.05, 0.03]} rotation={[1.15, 0, 0]}>
      {/* Grip */}
      <mesh castShadow>
        <cylinderGeometry args={[0.019, 0.019, 0.1, 10]} />
        <Shell color="#6e747a" />
      </mesh>

      {/* Lance */}
      <mesh position={[0, -0.19, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.013, 0.3, 10]} />
        <Joint color="#8d939a" />
      </mesh>

      {/* Fan tip */}
      <mesh position={[0, -0.35, 0]} castShadow>
        <coneGeometry args={[0.024, 0.05, 10]} />
        <meshStandardMaterial color="#5f8f96" roughness={0.34} metalness={0.42} />
      </mesh>

      {/* Trigger guard */}
      <mesh position={[0, -0.055, 0.026]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.028, 0.05, 0.012]} />
        <Shell color="#6e747a" />
      </mesh>
    </group>
  )
}

function Head({ lidarRef }) {
  return (
    <group>
      {/* Neck */}
      <mesh position={[0, -0.045, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.038, 0.06, 10]} />
        <Joint />
      </mesh>

      {/* Skull — a sensor housing, not a face */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.17, 0.14, 0.16]} />
        <Shell color="#cfccc4" />
      </mesh>

      {/* Visor: the camera bar */}
      <mesh position={[0, 0.012, 0.083]} castShadow>
        <boxGeometry args={[0.15, 0.055, 0.014]} />
        <meshStandardMaterial
          color="#14202b"
          roughness={0.12}
          metalness={0.62}
          emissive="#20444d"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Lens barrels behind the visor */}
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, 0.012, 0.078]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.012, 12]} />
          <meshStandardMaterial color="#0d1013" roughness={0.1} metalness={0.7} />
        </mesh>
      ))}

      {/* Scanning LiDAR on the crown */}
      <mesh position={[0, 0.082, 0]} castShadow>
        <cylinderGeometry args={[0.052, 0.056, 0.022, 16]} />
        <Shell color="#b9b6ae" />
      </mesh>
      <group ref={lidarRef} position={[0, 0.104, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.048, 0.048, 0.032, 16]} />
          <meshStandardMaterial color="#1a1d20" roughness={0.25} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.042]}>
          <boxGeometry args={[0.036, 0.022, 0.012]} />
          <meshStandardMaterial
            color="#6f8f96"
            emissive="#4a8f96"
            emissiveIntensity={0.5}
            roughness={0.2}
          />
        </mesh>
      </group>
      <mesh position={[0, 0.125, 0]} castShadow>
        <cylinderGeometry args={[0.056, 0.052, 0.012, 16]} />
        <Joint color="#6a7076" />
      </mesh>

      {/* Antenna */}
      <mesh position={[0.06, 0.16, -0.05]} rotation={[0.08, 0, -0.06]} castShadow>
        <cylinderGeometry args={[0.0035, 0.005, 0.14, 6]} />
        <meshStandardMaterial color="#26292c" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  )
}

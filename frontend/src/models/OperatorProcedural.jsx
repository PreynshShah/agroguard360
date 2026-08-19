import * as THREE from 'three'

/**
 * OperatorProcedural
 * The agricultural worker flying PEGASUS.
 *
 * Proportions are built from head-heights, the standard figure-drawing
 * canon: an adult is roughly 7.5 heads tall, the hips fall just under
 * halfway, and the fingertips reach mid-thigh. Getting these ratios right is
 * almost the whole job — a figure with a slightly oversized head or short legs
 * reads as a game character no matter how much detail is added.
 *
 * Total height is 1.75 m. Detail is deliberately restrained: this person is
 * scene-setting, not the subject, and a heavily detailed human would pull
 * attention away from the field and the aircraft.
 */

const HEIGHT = 1.75
const HEAD = HEIGHT / 7.5 // ≈ 0.233 m

// Landmark heights, measured up from the ground.
const ANKLE = HEAD * 0.35
const KNEE = HEIGHT * 0.285
const HIP = HEIGHT * 0.47
const WAIST = HEIGHT * 0.58
const CHEST = HEIGHT * 0.72
const SHOULDER = HEIGHT * 0.82
const CHIN = HEIGHT - HEAD

export function OperatorProcedural() {
  return (
    <group>
      <Legs />
      <Torso />
      <Arms />
      <Head />
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Materials — muted workwear, nothing saturated
 * ------------------------------------------------------------------ */

function Denim(props) {
  return <meshStandardMaterial color="#4a5567" roughness={0.94} metalness={0} {...props} />
}

function HiVis(props) {
  // A worn, dusty safety vest rather than fluorescent showroom yellow.
  return <meshStandardMaterial color="#b8a24e" roughness={0.88} metalness={0} {...props} />
}

function Shirt(props) {
  return <meshStandardMaterial color="#6f7c6a" roughness={0.92} metalness={0} {...props} />
}

function Skin(props) {
  return <meshStandardMaterial color="#a87c5a" roughness={0.78} metalness={0} {...props} />
}

function Boot(props) {
  return <meshStandardMaterial color="#3d3129" roughness={0.9} metalness={0.05} {...props} />
}

/* ------------------------------------------------------------------ *
 * Body
 * ------------------------------------------------------------------ */

function Legs() {
  // Feet slightly apart and one a little forward — a person standing and
  // watching shifts their weight, they don't stand at attention.
  const stance = [
    { x: -0.1, z: 0.02, rot: 0.03 },
    { x: 0.11, z: -0.05, rot: -0.05 },
  ]

  return (
    <group>
      {stance.map((leg, i) => (
        <group key={i} position={[leg.x, 0, leg.z]} rotation={[leg.rot, 0, 0]}>
          {/* Boot */}
          <mesh position={[0, ANKLE * 0.55, 0.03]} castShadow receiveShadow>
            <boxGeometry args={[0.11, ANKLE * 1.1, 0.25]} />
            <Boot />
          </mesh>

          {/* Lower leg */}
          <mesh position={[0, (ANKLE + KNEE) / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.058, 0.052, KNEE - ANKLE, 10]} />
            <Denim />
          </mesh>

          {/* Upper leg */}
          <mesh position={[0, (KNEE + HIP) / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.082, 0.062, HIP - KNEE, 10]} />
            <Denim />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Torso() {
  return (
    <group>
      {/* Hips */}
      <mesh position={[0, HIP + 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.31, 0.16, 0.19]} />
        <Denim />
      </mesh>

      {/* Ribcage — tapers from waist to shoulders, not a straight box */}
      <mesh position={[0, (WAIST + SHOULDER) / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.185, 0.155, SHOULDER - WAIST + 0.08, 12]} />
        <Shirt />
      </mesh>

      {/* Safety vest, open at the front */}
      <mesh position={[0, (WAIST + CHEST) / 2 + 0.04, -0.02]} castShadow>
        <cylinderGeometry args={[0.196, 0.172, CHEST - WAIST + 0.16, 12, 1, true, 0.6, Math.PI * 1.55]} />
        <HiVis side={THREE.DoubleSide} />
      </mesh>

      {/* Reflective band */}
      <mesh position={[0, CHEST - 0.02, -0.02]} castShadow>
        <cylinderGeometry args={[0.199, 0.194, 0.05, 12, 1, true, 0.6, Math.PI * 1.55]} />
        <meshStandardMaterial
          color="#c9ccc4"
          roughness={0.35}
          metalness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Shoulders */}
      <mesh position={[0, SHOULDER, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.072, 0.072, 0.38, 10]} />
        <Shirt />
      </mesh>
    </group>
  )
}

/**
 * Arms are posed holding a tablet at chest height, elbows in — the way anyone
 * actually holds a controller they are reading. Straight arms would read as a
 * mannequin.
 */
function Arms() {
  const shoulderWidth = 0.19

  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * shoulderWidth, SHOULDER - 0.02, 0]}>
          {/* Upper arm, angled down and slightly forward */}
          <group rotation={[0.42, 0, side * 0.16]}>
            <mesh position={[0, -0.13, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.055, 0.048, 0.27, 10]} />
              <Shirt />
            </mesh>

            {/* Forearm, bent up at the elbow to bring the tablet to chest height */}
            <group position={[0, -0.26, 0]} rotation={[-1.28, 0, 0]}>
              <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.046, 0.04, 0.25, 10]} />
                <Skin />
              </mesh>

              {/* Hand */}
              <mesh position={[0, -0.25, 0]} castShadow>
                <boxGeometry args={[0.075, 0.1, 0.05]} />
                <Skin />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      <Tablet />
    </group>
  )
}

/**
 * The ground control tablet, held level and tilted up toward the operator's
 * eyeline — which is also what puts the screen where the sun can catch it.
 */
function Tablet() {
  return (
    <group position={[0, CHEST - 0.03, 0.28]} rotation={[-0.65, 0, 0]}>
      {/* Case */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.185, 0.016]} />
        <meshStandardMaterial color="#2b2e31" roughness={0.7} metalness={0.25} />
      </mesh>

      {/* Screen, faintly lit — it is running the flight interface */}
      <mesh position={[0, 0, 0.009]}>
        <planeGeometry args={[0.232, 0.157]} />
        <meshStandardMaterial
          color="#3f5a4a"
          roughness={0.22}
          metalness={0.1}
          emissive="#2c4438"
          emissiveIntensity={0.55}
        />
      </mesh>

      {/* Control sticks on the lower edge */}
      {[-0.088, 0.088].map((x) => (
        <mesh key={x} position={[x, -0.108, 0.004]} castShadow>
          <cylinderGeometry args={[0.014, 0.016, 0.026, 10]} />
          <meshStandardMaterial color="#4a4d50" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}

      {/* Stubby antenna */}
      <mesh position={[-0.09, 0.12, 0]} rotation={[0.2, 0, -0.25]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.12, 8]} />
        <meshStandardMaterial color="#25282b" roughness={0.6} metalness={0.35} />
      </mesh>
    </group>
  )
}

function Head() {
  return (
    <group position={[0, CHIN + HEAD * 0.42, 0]}>
      {/* Neck */}
      <mesh position={[0, -HEAD * 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.043, 0.05, 0.09, 10]} />
        <Skin />
      </mesh>

      {/* Skull — an ellipsoid, slightly longer front to back than side to side */}
      <mesh scale={[0.85, 1, 0.92]} castShadow receiveShadow>
        <sphereGeometry args={[HEAD * 0.46, 16, 14]} />
        <Skin />
      </mesh>

      {/* Wide-brim sun hat, the one piece of kit nobody works a field without */}
      <group position={[0, HEAD * 0.28, 0]}>
        <mesh rotation={[0, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.32, 0.34, 0.016, 20]} />
          <meshStandardMaterial color="#9a8a63" roughness={0.95} metalness={0} />
        </mesh>
        <mesh position={[0, 0.055, 0]} castShadow>
          <cylinderGeometry args={[0.115, 0.125, 0.11, 16]} />
          <meshStandardMaterial color="#9a8a63" roughness={0.95} metalness={0} />
        </mesh>
        {/* Hat band */}
        <mesh position={[0, 0.018, 0]} castShadow>
          <cylinderGeometry args={[0.128, 0.128, 0.03, 16]} />
          <meshStandardMaterial color="#5d5343" roughness={0.9} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}

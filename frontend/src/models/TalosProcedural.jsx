import { TALOS_SPEC as S } from './talosSpec'

/**
 * TalosProcedural
 * The rover airframe, built from primitives.
 *
 * What separates a field robot from a toy, roughly in order of importance:
 *
 *   - Wheels large against the body, and real ground clearance. Toys sit low
 *     on small wheels; field machines stand high on tall ones to clear crop
 *     residue and ruts.
 *   - A wheelbase longer than the track width. Square footprints read as toys.
 *   - Matte industrial finish — dark anodised grey with off-white panels. No
 *     gloss, no saturated colour, no rounded pastel shells.
 *   - Visible engineering: exposed suspension rockers, bolt flanges, a mast
 *     that is obviously a mounting structure rather than a decorative fin.
 *   - Asymmetry front to rear. Sensors live at the front, the water tank and
 *     nozzle boom at the back, and the machine reads as having a purpose.
 *
 * The rover faces +Z. That is the same convention the motion model uses, where
 * a heading of h sends the front to (sin h, cos h).
 */
export function TalosProcedural({ wheelRefs, lidarRef, statusRef }) {
  const deckY = S.groundClearance + S.bodyHeight / 2

  // Front-left, front-right, rear-left, rear-right — the order the motion
  // model expects when it hands back wheel rotations.
  const wheels = [
    { key: 'fl', x: -S.trackWidth / 2, z: S.wheelbase / 2 },
    { key: 'fr', x: S.trackWidth / 2, z: S.wheelbase / 2 },
    { key: 'rl', x: -S.trackWidth / 2, z: -S.wheelbase / 2 },
    { key: 'rr', x: S.trackWidth / 2, z: -S.wheelbase / 2 },
  ]

  return (
    <group>
      <Chassis deckY={deckY} />
      <Suspension wheels={wheels} deckY={deckY} />

      {wheels.map((wheel, index) => (
        <Wheel key={wheel.key} wheel={wheel} wheelRef={wheelRefs[index]} />
      ))}

      <SensorMast deckY={deckY} lidarRef={lidarRef} />
      <FrontSensors deckY={deckY} />
      <WaterTank deckY={deckY} />
      <NozzleBoom deckY={deckY} />
      <StatusPanel deckY={deckY} statusRef={statusRef} />
      <Antenna deckY={deckY} />
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Materials
 * ------------------------------------------------------------------ */

function Anodised(props) {
  return <meshStandardMaterial color="#3c4247" roughness={0.58} metalness={0.45} {...props} />
}

function Panel(props) {
  return <meshStandardMaterial color="#cfccc3" roughness={0.72} metalness={0.12} {...props} />
}

function Alloy(props) {
  return <meshStandardMaterial color="#7d838a" roughness={0.38} metalness={0.8} {...props} />
}

function Rubber(props) {
  return <meshStandardMaterial color="#232628" roughness={0.95} metalness={0} {...props} />
}

/* ------------------------------------------------------------------ *
 * Chassis
 * ------------------------------------------------------------------ */

function Chassis({ deckY }) {
  return (
    <group>
      {/* Main body */}
      <mesh position={[0, deckY, 0]} castShadow receiveShadow>
        <boxGeometry args={[S.bodyWidth, S.bodyHeight, S.bodyLength]} />
        <Anodised />
      </mesh>

      {/* Off-white upper deck, inset so the dark body reads as a frame */}
      <mesh position={[0, deckY + S.bodyHeight / 2 + 0.02, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[S.bodyWidth - 0.07, 0.045, S.bodyLength - 0.12]} />
        <Panel />
      </mesh>

      {/* Side rails */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (S.bodyWidth / 2 + 0.015), deckY + 0.03, 0]}
          castShadow
        >
          <boxGeometry args={[0.03, 0.09, S.bodyLength - 0.06]} />
          <Alloy />
        </mesh>
      ))}

      {/* Cooling vents on both flanks */}
      {[-1, 1].map((side) =>
        [0.18, 0.02, -0.14].map((z) => (
          <mesh
            key={`${side}-${z}`}
            position={[side * (S.bodyWidth / 2 + 0.004), deckY - 0.06, z]}
          >
            <boxGeometry args={[0.006, 0.05, 0.1]} />
            <meshStandardMaterial color="#22262a" roughness={0.7} metalness={0.3} />
          </mesh>
        )),
      )}

      {/* Skid plate — the underside takes the punishment */}
      <mesh position={[0, S.groundClearance - 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[S.bodyWidth + 0.04, 0.03, S.bodyLength - 0.1]} />
        <meshStandardMaterial color="#54595d" roughness={0.85} metalness={0.35} />
      </mesh>

      {/* Front bumper */}
      <mesh position={[0, S.groundClearance + 0.06, S.bodyLength / 2 + 0.05]} castShadow>
        <boxGeometry args={[S.bodyWidth + 0.06, 0.08, 0.06]} />
        <Alloy color="#6a7076" />
      </mesh>
    </group>
  )
}

/**
 * Rocker arms from the chassis out to each hub.
 * Visible suspension is a large part of why a machine reads as engineered
 * rather than moulded — a body floating above four wheels looks like a toy.
 */
function Suspension({ wheels, deckY }) {
  return (
    <group>
      {wheels.map((wheel) => {
        const side = Math.sign(wheel.x)
        return (
          <group key={wheel.key}>
            {/* Rocker arm */}
            <mesh
              position={[wheel.x - side * 0.09, deckY - 0.11, wheel.z]}
              rotation={[0, 0, side * 0.32]}
              castShadow
            >
              <boxGeometry args={[0.2, 0.055, 0.07]} />
              <Alloy color="#666c72" />
            </mesh>

            {/* Hub carrier */}
            <mesh position={[wheel.x - side * 0.035, S.wheelRadius, wheel.z]} castShadow>
              <boxGeometry args={[0.07, 0.12, 0.12]} />
              <Anodised />
            </mesh>

            {/* Damper */}
            <mesh
              position={[wheel.x - side * 0.14, deckY - 0.02, wheel.z]}
              rotation={[0, 0, side * 0.5]}
              castShadow
            >
              <cylinderGeometry args={[0.022, 0.022, 0.16, 8]} />
              <Alloy />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/**
 * A wheel with real tread blocks.
 *
 * The lugs are what make rotation legible. A smooth cylinder spinning about
 * its axis is visually identical whether it is turning or not, so wheels that
 * "rotate" would read as static — the tread is what shows the motion.
 */
function Wheel({ wheel, wheelRef }) {
  const lugCount = 14

  return (
    <group position={[wheel.x, S.wheelRadius, wheel.z]}>
      {/* Two nested groups on purpose. The inner one lays the cylinder on its
          side so the axle runs along X; the outer one is what spins, about
          that same X axis. Combining both on one group would mean the rig
          writing rotation.x onto a node whose JSX also sets rotation.z, and
          any re-render would snap the wheel back to zero. */}
      <group ref={wheelRef}>
        <group rotation={[0, 0, Math.PI / 2]}>
        {/* Tyre carcass */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[S.wheelRadius, S.wheelRadius, S.wheelWidth, 20]} />
          <Rubber />
        </mesh>

        {/* Tread lugs, angled like a real agricultural tyre */}
        {Array.from({ length: lugCount }, (_, i) => {
          const angle = (i / lugCount) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * (S.wheelRadius + 0.012),
                0,
                Math.sin(angle) * (S.wheelRadius + 0.012),
              ]}
              rotation={[0, -angle, 0.28]}
              castShadow
            >
              <boxGeometry args={[0.05, S.wheelWidth + 0.015, 0.075]} />
              <Rubber color="#1c1f21" />
            </mesh>
          )
        })}

        {/* Rim and hub */}
        <mesh castShadow>
          <cylinderGeometry args={[S.wheelRadius * 0.56, S.wheelRadius * 0.56, S.wheelWidth + 0.012, 16]} />
          <Panel color="#b9b6ae" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.055, 0.055, S.wheelWidth + 0.03, 12]} />
          <Alloy />
        </mesh>

        {/* Wheel bolts — a small detail that reads as machined */}
        {Array.from({ length: 5 }, (_, i) => {
          const angle = (i / 5) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.09, S.wheelWidth / 2 + 0.008, Math.sin(angle) * 0.09]}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.016, 6]} />
              <Alloy color="#8d939a" />
            </mesh>
          )
          })}
        </group>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Sensors
 * ------------------------------------------------------------------ */

/** Mast carrying the scanning LiDAR and the multispectral head. */
function SensorMast({ deckY, lidarRef }) {
  const top = S.mastHeight

  return (
    <group position={[0, 0, -0.12]}>
      {/* Mast tube */}
      <mesh position={[0, (deckY + S.bodyHeight / 2 + top) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.034, top - deckY - S.bodyHeight / 2, 10]} />
        <Anodised />
      </mesh>

      {/* Mounting collar */}
      <mesh position={[0, deckY + S.bodyHeight / 2 + 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.06, 0.035, 12]} />
        <Alloy />
      </mesh>

      {/* Scanning LiDAR — the housing is static, the drum inside turns */}
      <mesh position={[0, top - 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.08, 0.045, 16]} />
        <Anodised color="#2f3438" />
      </mesh>
      <group ref={lidarRef} position={[0, top + 0.03, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.055, 16]} />
          <meshStandardMaterial color="#1a1d20" roughness={0.25} metalness={0.5} />
        </mesh>
        {/* Emitter window, so the spin is visible */}
        <mesh position={[0, 0, 0.062]}>
          <boxGeometry args={[0.05, 0.035, 0.016]} />
          <meshStandardMaterial
            color="#6f8f96"
            emissive="#4a8f96"
            emissiveIntensity={0.5}
            roughness={0.2}
          />
        </mesh>
      </group>
      <mesh position={[0, top + 0.07, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.075, 0.02, 16]} />
        <Alloy color="#6a7076" />
      </mesh>

      {/* Multispectral head, looking forward and down over the crop */}
      <mesh position={[0, top - 0.14, 0.085]} rotation={[0.42, 0, 0]} castShadow>
        <boxGeometry args={[0.13, 0.075, 0.08]} />
        <Anodised color="#33383c" />
      </mesh>
      <mesh position={[0, top - 0.17, 0.128]} rotation={[0.42, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.024, 0.03, 12]} />
        <meshStandardMaterial color="#1a2426" roughness={0.15} metalness={0.6} />
      </mesh>
    </group>
  )
}

/** Front camera and the ultrasonic distance sensors either side of it. */
function FrontSensors({ deckY }) {
  const z = S.bodyLength / 2 + 0.02

  return (
    <group position={[0, deckY + 0.04, z]}>
      {/* Camera housing */}
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.1, 0.07]} />
        <Anodised color="#2f3438" />
      </mesh>

      {/* Lens barrel and glass */}
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.036, 0.04, 16]} />
        <Alloy color="#5f656b" />
      </mesh>
      <mesh position={[0, 0, 0.071]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.006, 16]} />
        <meshStandardMaterial color="#141b1e" roughness={0.08} metalness={0.7} />
      </mesh>

      {/* Sun hood over the lens */}
      <mesh position={[0, 0.06, 0.045]} rotation={[0.22, 0, 0]} castShadow>
        <boxGeometry args={[0.15, 0.008, 0.07]} />
        <Anodised />
      </mesh>

      {/* Ultrasonic distance sensors — the paired transducers are the giveaway */}
      {[-0.135, 0.135].map((x) => (
        <group key={x} position={[x, -0.03, 0.02]}>
          <mesh castShadow>
            <boxGeometry args={[0.075, 0.05, 0.035] } />
            <Anodised color="#33383c" />
          </mesh>
          {[-0.019, 0.019].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.014, 12]} />
              <Alloy color="#9aa0a6" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Payload
 * ------------------------------------------------------------------ */

/** Water tank on the rear deck, with a sight gauge and filler cap. */
function WaterTank({ deckY }) {
  const y = deckY + S.bodyHeight / 2 + 0.16

  return (
    <group position={[0, y, -0.24]}>
      {/* Tank, lying across the chassis */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.5, 20]} />
        <meshStandardMaterial color="#d8d5cc" roughness={0.55} metalness={0.05} />
      </mesh>

      {/* End caps */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <sphereGeometry args={[0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#c9c6bd" roughness={0.55} metalness={0.05} />
        </mesh>
      ))}

      {/* Retaining straps */}
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.166, 0.166, 0.03, 20]} />
          <Anodised color="#4a4f54" />
        </mesh>
      ))}

      {/* Filler cap */}
      <mesh position={[0, 0.155, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.035, 12]} />
        <Anodised color="#2f3438" />
      </mesh>

      {/* Sight gauge — a translucent strip showing the level */}
      <mesh position={[0, 0, 0.162]}>
        <boxGeometry args={[0.03, 0.2, 0.01]} />
        <meshStandardMaterial color="#7fa8ad" transparent opacity={0.75} roughness={0.2} />
      </mesh>
    </group>
  )
}

/**
 * Irrigation boom and nozzle, folded along the rear.
 * Hangs low and to one side so it can reach between rows.
 */
function NozzleBoom({ deckY }) {
  return (
    <group position={[0, deckY - 0.05, -S.bodyLength / 2 - 0.02]}>
      {/* Pump housing */}
      <mesh position={[0.16, 0.02, 0.02]} castShadow>
        <boxGeometry args={[0.12, 0.11, 0.1]} />
        <Anodised color="#33383c" />
      </mesh>

      {/* Feed line from tank to boom */}
      <mesh position={[0.05, 0.06, -0.01]} rotation={[0, 0, 1.1]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.22, 8]} />
        <meshStandardMaterial color="#4c5257" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Boom arm, extending out to the left */}
      <mesh position={[-0.22, -0.04, -0.04]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.019, 0.019, 0.56, 10]} />
        <Alloy color="#6a7076" />
      </mesh>

      {/* Hinge */}
      <mesh position={[0.04, -0.04, -0.04]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.05, 10]} />
        <Anodised />
      </mesh>

      {/* Nozzle head at the boom tip */}
      <group position={[-0.5, -0.06, -0.04]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.028, 0.02, 0.06, 10]} />
          <Alloy color="#8d939a" />
        </mesh>
        {/* Fan tip, pointing down at the crop */}
        <mesh position={[0, -0.045, 0]} rotation={[0, 0, 0]} castShadow>
          <coneGeometry args={[0.026, 0.05, 10]} />
          <meshStandardMaterial color="#5f8f96" roughness={0.35} metalness={0.4} />
        </mesh>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Indicators
 * ------------------------------------------------------------------ */

/**
 * Status light on the rear deck, plus fixed indicator LEDs beside it.
 * The main lamp is handed a ref so the rig can recolour it by mode.
 */
function StatusPanel({ deckY, statusRef }) {
  const y = deckY + S.bodyHeight / 2 + 0.06

  return (
    <group position={[0, y, 0.28]}>
      {/* Beacon base */}
      <mesh castShadow>
        <cylinderGeometry args={[0.038, 0.042, 0.03, 12]} />
        <Anodised color="#2f3438" />
      </mesh>

      {/* The lamp itself */}
      <mesh ref={statusRef} position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.032, 0.05, 12]} />
        <meshStandardMaterial
          color="#4a8f96"
          emissive="#4a8f96"
          emissiveIntensity={1.4}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.068, 0]}>
        <sphereGeometry args={[0.032, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#4a8f96"
          emissive="#4a8f96"
          emissiveIntensity={1.2}
          roughness={0.25}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Small fixed indicators: power, link, payload */}
      {[
        { x: -0.1, color: '#2e7d4f' },
        { x: -0.062, color: '#c8a33c' },
        { x: 0.062, color: '#4a8f96' },
        { x: 0.1, color: '#8a5b73' },
      ].map((led) => (
        <mesh key={led.x} position={[led.x, -0.005, 0.012]}>
          <sphereGeometry args={[0.009, 8, 6]} />
          <meshStandardMaterial
            color={led.color}
            emissive={led.color}
            emissiveIntensity={1.1}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Whip antenna for the telemetry link. */
function Antenna({ deckY }) {
  return (
    <group position={[S.bodyWidth / 2 - 0.06, deckY + S.bodyHeight / 2, -0.42]}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.022, 0.05, 10]} />
        <Anodised />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0.06, 0, -0.05]} castShadow>
        <cylinderGeometry args={[0.004, 0.006, 0.34, 6]} />
        <meshStandardMaterial color="#26292c" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.375, 0]}>
        <sphereGeometry args={[0.011, 8, 6]} />
        <meshStandardMaterial color="#3c4247" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  )
}

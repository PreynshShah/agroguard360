import { PegasusProcedural } from './PegasusProcedural'

/**
 * PegasusModel.jsx
 * The seam between the drone's appearance and everything else in the app.
 *
 * Nothing outside this file knows how PEGASUS is built. The flight model moves
 * a group; this decides what sits inside it. To swap in a purchased or
 * commissioned GLB later, replace the body of this component — the flight
 * controller, camera focus, interface and scene graph all stay untouched.
 *
 * The GLTF path is sketched below rather than left to guesswork:
 *
 *   import { useGLTF } from '@react-three/drei'
 *
 *   export function PegasusModel({ rotorRefs }) {
 *     const { nodes } = useGLTF('/models/pegasus.glb')
 *     // Hand the four rotor nodes to the parent so it can spin them, exactly
 *     // as the procedural version does below.
 *     return <primitive object={nodes.Airframe} />
 *   }
 *   useGLTF.preload('/models/pegasus.glb')
 *
 * The one contract a replacement must honour: populate `rotorRefs` with four
 * objects that can be rotated about their local Y axis. Everything else about
 * the model is free to change.
 */
export function PegasusModel({ rotorRefs, navLightRef, gimbalRef }) {
  return (
    <PegasusProcedural rotorRefs={rotorRefs} navLightRef={navLightRef} gimbalRef={gimbalRef} />
  )
}

/**
 * Airframe dimensions, in metres. Exported because the landing pad, the
 * operator's eyeline and the camera framing all need to agree with the drone's
 * real size.
 *
 * These are the proportions of a professional agricultural inspection
 * quadcopter — roughly a 900 mm diagonal wheelbase — not a toy. The most
 * common mistake in a synthetic drone is arms that are too short and props
 * that are too small for the body; both are sized from the wheelbase here.
 */
export const PEGASUS_SPEC = {
  /** Motor-to-motor diagonal. */
  wheelbase: 0.9,
  bodyLength: 0.34,
  bodyWidth: 0.2,
  bodyHeight: 0.11,
  propRadius: 0.165,
  motorHeight: 0.052,
  legHeight: 0.24,
  /** Overall height, used to sit the drone correctly on the pad. */
  groundClearance: 0.06,
}

/**
 * Rotor turn direction per motor, in the same order the model builds its arms:
 * front-right, front-left, back-right, back-left.
 *
 * Diagonally opposite motors turn the same way and adjacent ones oppose, which
 * is what cancels torque on a real quadcopter. Exported so the flight rig spins
 * each rotor correctly instead of inferring it — a GLB replacement should
 * export the same order.
 */
export const PEGASUS_ROTOR_SPIN = [1, -1, -1, 1]

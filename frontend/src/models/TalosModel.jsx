import { TalosProcedural } from './TalosProcedural'
import { TalosHumanoid } from './TalosHumanoid'
import {
  TALOS_FORM,
  TALOS_SPEC,
  STATUS_COLORS,
  HUMANOID_SPEC,
  NOZZLE_BY_FORM,
  SHADOW_BY_FORM,
} from './talosSpec'

// Re-exported so existing imports of these from TalosModel keep working.
export { TALOS_FORM, TALOS_SPEC, STATUS_COLORS, HUMANOID_SPEC, NOZZLE_BY_FORM, SHADOW_BY_FORM }


/**
 * TalosModel.jsx
 * The seam between the rover's appearance and everything else.
 *
 * Same arrangement as PegasusModel and OperatorModel: nothing outside this
 * file knows how TALOS is built. The motion model moves a group; this decides
 * what sits inside it. To drop in a commissioned GLB later, replace the body
 * of this component and nothing else changes.
 *
 *   import { useGLTF } from '@react-three/drei'
 *
 *   export function TalosModel({ wheelRefs, lidarRef, statusRef }) {
 *     const { nodes } = useGLTF('/models/talos.glb')
 *     // Populate the refs from the named nodes, exactly as below.
 *     return <primitive object={nodes.Rover} />
 *   }
 *   useGLTF.preload('/models/talos.glb')
 *
 * The contract a replacement must honour:
 *   - four wheel groups in `wheelRefs`, rotatable about their local X axis,
 *     ordered front-left, front-right, rear-left, rear-right
 *   - `lidarRef` on something spinnable about Y
 *   - `statusRef` on a mesh whose material carries an emissive colour
 *   - the chassis facing +Z, standing on y = 0
 */
export function TalosModel({ wheelRefs, lidarRef, statusRef, rover }) {
  if (TALOS_FORM === 'humanoid') {
    // The humanoid poses its own limbs from the rover's live state — eight
    // joints moving in phase is not something to thread through this seam.
    return <TalosHumanoid rover={rover} statusRef={statusRef} lidarRef={lidarRef} />
  }

  return <TalosProcedural wheelRefs={wheelRefs} lidarRef={lidarRef} statusRef={statusRef} />
}

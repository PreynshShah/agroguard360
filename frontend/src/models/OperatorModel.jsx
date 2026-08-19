import { OperatorProcedural } from './OperatorProcedural'

/**
 * OperatorModel.jsx
 * The same swap seam PegasusModel provides, for the human figure.
 *
 * A rigged character is the most likely thing to be replaced with a real asset
 * later, since a proper GLTF human comes with skinning and idle animation that
 * would be pointless to hand-build. Keeping the seam here means that swap
 * touches one file:
 *
 *   import { useGLTF, useAnimations } from '@react-three/drei'
 *
 *   export function OperatorModel() {
 *     const { scene, animations } = useGLTF('/models/operator.glb')
 *     const { actions } = useAnimations(animations, ref)
 *     useEffect(() => actions.Idle?.play(), [actions])
 *     return <primitive object={scene} />
 *   }
 *
 * The contract: stand on the origin, face -Z, and be about 1.75 m tall. The
 * scene positions and rotates the figure from outside.
 */
export function OperatorModel() {
  return <OperatorProcedural />
}

/** Used by the camera director to frame the figure at eye height. */
export const OPERATOR_SPEC = {
  height: 1.75,
  eyeHeight: 1.62,
}

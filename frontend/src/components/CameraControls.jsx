import { OrbitControls } from '@react-three/drei'
import { CONTROLS } from '../systems/sceneConfig'

/**
 * CameraControls
 * Rotate, zoom and pan, with limits that keep the view usable.
 *
 * maxPolarAngle stops just above horizontal so the camera cannot drop under
 * the ground plane and leave the person staring at the underside of the field.
 * makeDefault registers these controls globally, so later phases can grab them
 * with useThree(state => state.controls) to fly the camera to a target.
 */
export function CameraControls() {
  return (
    <OrbitControls
      makeDefault
      target={CONTROLS.target}
      enableDamping
      dampingFactor={CONTROLS.dampingFactor}
      minDistance={CONTROLS.minDistance}
      maxDistance={CONTROLS.maxDistance}
      minPolarAngle={CONTROLS.minPolarAngle}
      maxPolarAngle={CONTROLS.maxPolarAngle}
      screenSpacePanning={CONTROLS.screenSpacePanning}
      panSpeed={CONTROLS.panSpeed}
      zoomSpeed={CONTROLS.zoomSpeed}
      zoomToCursor={CONTROLS.zoomToCursor}
      enablePan
      enableZoom
      enableRotate
    />
  )
}

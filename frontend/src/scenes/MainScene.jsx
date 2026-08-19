import { Suspense, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sky, AdaptiveDpr, AdaptiveEvents, BakeShadows } from '@react-three/drei'
import * as THREE from 'three'

import { SceneLighting } from '../components/SceneLighting'
import { CameraControls } from '../components/CameraControls'
import { Farm } from '../components/farm/Farm'
import { DroneRig } from '../components/drone/DroneRig'
import { TalosRig } from '../components/rover/TalosRig'
import { LandingPad } from '../components/drone/LandingPad'
import { Operator } from '../components/Operator'
import { CameraDirector } from '../components/CameraDirector'
import { CAMERA, SKY, SUN_POSITION, ATMOSPHERE, RENDERER } from '../systems/sceneConfig'

/**
 * MainScene
 * The root 3D view. Everything inside <Canvas> is Three.js; everything outside
 * it is regular DOM.
 *
 * Shadow type is PCFSoft, which trades a little performance for edges that
 * don't look like stair-steps. Tone mapping is ACES Filmic so the bright sky
 * and the shadowed soil can both hold detail instead of clipping.
 *
 * BakeShadows renders the shadow map once instead of every frame. Nothing in
 * this scene moves and the sun is fixed, so re-rendering ~7,000 crop instances
 * into a 4096² depth map sixty times a second would be pure waste. This is the
 * single biggest performance decision in Phase 2 — when a later phase adds
 * moving equipment, remove it and switch the sun to a lower shadow resolution.
 */
export function MainScene({
  onReady,
  hoveredZone,
  selectedZone,
  onHoverZone,
  onSelectZone,
  controller,
  focus,
  onFocusInterrupted,
  scanResults,
  activeZone,
  route,
  obstacles,
  rover,
  paused = false,
  problemSubject = null,
}) {
  return (
    <Canvas
      /**
       * Pausing the demo stops the render loop outright.
       *
       * Halting only the script would leave the drone flying and the pump
       * running while the narration stopped — the demonstration would carry on
       * without its commentary. Switching the frameloop off stops every
       * useFrame callback, and with them the flight model, the rover, the
       * inspection and the spray. The world genuinely freezes.
       */
      frameloop={paused ? 'never' : 'always'}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      camera={{
        position: CAMERA.position,
        fov: CAMERA.fov,
        near: CAMERA.near,
        far: CAMERA.far,
      }}
      dpr={[1, RENDERER.maxDpr]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: RENDERER.toneMappingExposure,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(ATMOSPHERE.fogColor)
        onReady?.()
      }}
    >
      {/* Distance haze, tinted to the horizon so the terrain edge doesn't
          announce itself as a hard line at the far clip. */}
      <fog attach="fog" args={[ATMOSPHERE.fogColor, ATMOSPHERE.fogNear, ATMOSPHERE.fogFar]} />

      <Suspense fallback={null}>
        <Sky
          distance={SKY.distance}
          sunPosition={SUN_POSITION}
          turbidity={SKY.turbidity}
          rayleigh={SKY.rayleigh}
          mieCoefficient={SKY.mieCoefficient}
          mieDirectionalG={SKY.mieDirectionalG}
        />

        <SceneLighting />

        <Farm
          hoveredZone={hoveredZone}
          selectedZone={selectedZone}
          onHoverZone={onHoverZone}
          onSelectZone={onSelectZone}
          results={scanResults}
          activeZone={activeZone}
          route={route}
          obstacles={obstacles}
        />

        <LandingPad />
        <Operator craft={controller.craft} />

        {/* Baked last among the static objects: the pad and the operator are
            fixed, so their shadows belong in the bake. PEGASUS moves, so it
            casts a projected shadow of its own instead. */}
        <DeferredBakeShadows frames={4} />

        <DroneRig controller={controller} />
        <TalosRig controller={rover} />
      </Suspense>

      <CameraControls />

      <CameraDirector
        focus={focus}
        subjects={{ pegasus: controller.craft, talos: rover.rover, problem: problemSubject }}
        onFocusInterrupted={onFocusInterrupted}
      />

      {/* Drops resolution while the camera is moving and restores it when it
          settles, and skips raycasts during motion. Both are invisible to the
          eye and buy headroom on weaker GPUs. */}
      <AdaptiveDpr pixelated={false} />
      <AdaptiveEvents />
    </Canvas>
  )
}

/**
 * DeferredBakeShadows
 * Freezes the shadow map, but only after the first few frames have rendered.
 *
 * Baking immediately is a trap: instanced matrices upload during layout
 * effects and the ridges, crops and trees may not be in place when frame one
 * draws. Baking that frame would freeze a shadow map of an empty field, and
 * the scene would render with no shadows at all and no obvious cause.
 */
function DeferredBakeShadows({ frames = 4 }) {
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState(0)

  useFrame(() => {
    if (ready) return
    setCount((n) => {
      const next = n + 1
      if (next >= frames) setReady(true)
      return next
    })
  })

  return ready ? <BakeShadows /> : null
}

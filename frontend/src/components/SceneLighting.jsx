import { LIGHTING, SUN_POSITION } from '../systems/sceneConfig'

/**
 * SceneLighting
 * Three lights, each with a distinct job:
 *
 *  1. ambientLight     — a small floor of light so nothing is pure black.
 *  2. hemisphereLight  — blue from the sky, warm bounce from the soil. This is
 *                        what stops shadowed faces looking flat and grey.
 *  3. directionalLight — the sun. The only light that casts shadows.
 *
 * The sun sits at SUN_POSITION, the same vector the <Sky> backdrop uses, so
 * shadows fall away from the visible sun rather than in some unrelated
 * direction.
 */
export function SceneLighting() {
  const { shadowExtent, shadowMapSize } = LIGHTING

  return (
    <>
      <ambientLight intensity={LIGHTING.ambientIntensity} />

      <hemisphereLight
        args={[LIGHTING.skyColor, LIGHTING.groundColor, LIGHTING.hemisphereIntensity]}
      />

      <directionalLight
        position={SUN_POSITION}
        intensity={LIGHTING.sunIntensity}
        color={LIGHTING.sunColor}
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        // An orthographic frustum sized to the working area. Too wide and the
        // shadow map blurs; too narrow and shadows clip out of existence.
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={0.5}
        shadow-camera-far={260}
        shadow-bias={LIGHTING.shadowBias}
        shadow-normalBias={LIGHTING.shadowNormalBias}
      />
    </>
  )
}

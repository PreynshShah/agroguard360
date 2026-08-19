/**
 * sceneConfig.js
 * Single source of truth for the 3D environment's tunable values.
 *
 * Phase 2 note: the ground plane and reference grid that lived here in Phase 1
 * were superseded by the Terrain component, which builds the turf, soil beds
 * and pathways from the farm layout. Field dimensions now live in
 * `farmLayout.js`; this file covers camera, light and atmosphere only.
 */

/**
 * Sun direction, expressed as a vector scaled to a distance.
 * The <Sky> backdrop and the directional light both read this, which is what
 * keeps the visible sun and the cast shadows pointing the same way.
 *
 * Lowered from Phase 1's near-overhead angle: mid-morning light rakes across
 * the crop rows and throws long shadows off the treeline, which reads as a
 * real time of day rather than generic noon.
 */
export const SUN_POSITION = [95, 62, 48]

export const CAMERA = {
  // Pulled back and raised — the farm block is ~104 m across.
  position: [62, 38, 74],
  fov: 42,
  near: 0.5,
  far: 2500,
}

export const CONTROLS = {
  target: [0, 1, 0],
  minDistance: 6,
  maxDistance: 320,
  /** Stops just short of horizontal so the camera never dips below ground. */
  maxPolarAngle: Math.PI / 2 - 0.035,
  minPolarAngle: 0.05,
  dampingFactor: 0.06,
  /** Keeps panning parallel to the field instead of the screen. */
  screenSpacePanning: false,
  panSpeed: 0.9,
  zoomSpeed: 0.9,
}

export const LIGHTING = {
  ambientIntensity: 0.3,
  hemisphereIntensity: 0.5,
  skyColor: '#c2d9ee',
  groundColor: '#6d6248',
  sunIntensity: 2.5,
  /** Slightly warm white — mid-morning sun, not studio white. */
  sunColor: '#fff1d6',

  /**
   * Orthographic shadow frustum half-extent, in metres. Must cover the farm
   * block, the treeline and the farmstead, or those objects light up with no
   * shadow beneath them.
   */
  shadowExtent: 105,

  /**
   * Shadow map resolution. At 4096 across a 210 m frustum each texel covers
   * about 5 cm, which is fine enough to resolve individual crop-row shadows.
   *
   * If frame rate is a problem on older hardware, drop this to 2048 first —
   * it is the single largest lever in the scene and costs only shadow
   * crispness, not geometry.
   */
  shadowMapSize: 4096,

  shadowBias: -0.0006,
  shadowNormalBias: 0.03,
}

export const SKY = {
  distance: 4500,
  /** Slight haze — a perfectly clear sky reads as synthetic. */
  turbidity: 6.5,
  rayleigh: 1.1,
  mieCoefficient: 0.008,
  mieDirectionalG: 0.82,
}

export const ATMOSPHERE = {
  /** Horizon-tinted haze, so distant trees soften instead of ending abruptly. */
  fogColor: '#cfdae4',
  fogNear: 140,
  fogFar: 760,
}

export const RENDERER = {
  /**
   * Device pixel ratio ceiling. Retina laptops report 2, which quadruples the
   * pixels shaded. 1.75 keeps text and edges crisp at noticeably lower cost.
   */
  maxDpr: 1.75,
  toneMappingExposure: 1.05,
}

/**
 * talosSpec.js
 * TALOS's form, dimensions and per-form offsets — pure data, no JSX.
 *
 * Split out of TalosModel.jsx so these can be imported by anything, including
 * the Node test harness, which cannot load a .jsx file. Keeping geometry
 * constants in a component file also meant every consumer of a dimension had
 * to import a React component to get it.
 */

/**
 * Which body TALOS wears.
 *
 * 'humanoid' — a walking robot carrying a backpack water tank and a
 *              pest-control satchel, spraying from a hand-held wand.
 * 'rover'    — the original four-wheel wheeled chassis.
 *
 * Both drive from the same motion model, so this is a genuine swap: change
 * this one string and nothing else in the application needs to know.
 */
export const TALOS_FORM = 'humanoid'

/**
 * Rover dimensions, in metres.
 *
 * Sized as a real field robot rather than a toy: 1.42 m long over a 1.05 m
 * wheelbase, 0.84 m wide, standing 0.94 m to the top of the sensor mast.
 * That is roughly a two-row inter-crop rover — narrow enough to fit a 4 m
 * track with room either side, which is exactly what PROMETHIA assumes when
 * it routes along them.
 *
 * The proportions that stop it reading as a toy: wheels large relative to the
 * body (0.26 m radius against a 0.44 m tall chassis), a long wheelbase rather
 * than a square footprint, and ground clearance of nearly a third of the body
 * height — field robots stand high to clear crop residue.
 */
export const TALOS_SPEC = {
  bodyLength: 1.1,
  bodyWidth: 0.62,
  bodyHeight: 0.34,

  wheelbase: 1.05,
  trackWidth: 0.84,
  wheelRadius: 0.26,
  wheelWidth: 0.17,

  /** Underside of the chassis above the ground. */
  groundClearance: 0.3,
  mastHeight: 0.94,
}

/** Status light colour by rover mode. */
export const STATUS_COLORS = {
  idle: '#4a8f96',
  navigating: '#c8a33c',
  inspecting: '#2e7d4f',
  blocked: '#a24f3f',
}

/**
 * Humanoid dimensions, in metres.
 *
 * 1.62 m to the crown — near human height on purpose. A field robot that walks
 * among crops has to clear them without towering over the operator working
 * beside it, and matching human scale is also what lets it use the same tracks
 * and gates.
 *
 * `wheelRadius` is retained deliberately: the motion model still reports wheel
 * rotations, and this is the constant that converts them back into distance
 * travelled so the gait can be driven from it.
 */
export const HUMANOID_SPEC = {
  height: 1.62,

  hipHeight: 0.86,
  hipWidth: 0.19,
  shoulderWidth: 0.36,

  torsoHeight: 0.5,
  thighLength: 0.42,
  shinLength: 0.4,
  upperArmLength: 0.26,
  forearmLength: 0.23,

  /**
   * Metres per full stride cycle.
   *
   * Raised alongside the speed increase. At 2.8 m/s a 1.3 m stride means over
   * two full cycles a second, which reads as frantic scurrying rather than
   * walking — a faster machine takes longer steps, not just quicker ones.
   */
  strideLength: 1.75,

  /** Must match ROVER.wheelRadius; converts wheel counters back to distance. */
  wheelRadius: 0.26,
}

/**
 * Where irrigation water leaves the machine, in its own local space.
 *
 * The rover sprays from a boom out to one side; the humanoid sprays from the
 * wand in its right hand, which is forward and much higher. The spray reads
 * this rather than hard-coding a position, so switching form moves the water
 * to the right place automatically.
 */
export const NOZZLE_BY_FORM = {
  // Measured from the transform chain, not estimated: shoulder → arm →
  // forearm (held forward at -0.95 rad) → wand (angled 1.15 rad) → fan tip.
  // An eyeballed value put the water 17 cm off the wand, which reads as a leak.
  humanoid: { x: 0.18, y: 0.549, z: 0.176 },
  rover: { x: -0.5, y: 0.31, z: -0.61 },
}

/** Contact shadow footprint per form — a walker casts a far smaller one. */
export const SHADOW_BY_FORM = {
  humanoid: [0.95, 1.05],
  rover: [1.5, 1.9],
}

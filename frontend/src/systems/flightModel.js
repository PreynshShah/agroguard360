/**
 * flightModel.js
 * PEGASUS flight behaviour, as a pure state machine.
 *
 * Deliberately free of Three.js and React: this module takes a state object, a
 * time step and an input, and returns the next state. That keeps the flight
 * behaviour testable outside a browser and stops the physics from becoming
 * tangled up in render code.
 *
 * Units are metres, seconds and radians throughout. Y is up.
 *
 * Modes:
 *   idle     on the pad, rotors stopped
 *   takeoff  rotors spinning up, then climbing to hover altitude
 *   hover    holding altitude, accepting pilot input
 *   landing  returning over the pad, then descending
 */

export const FLIGHT_CONFIG = {
  /** Working altitude above ground, in metres. */
  /**
   * Survey altitude. Lowered from 13 m — closer to the canopy makes the crop
   * rows legible from the aircraft's own camera view, and the drone reads as
   * working the field rather than passing over it.
   */
  hoverAltitude: 7,
  /**
   * Resting height of the drone's origin when parked.
   *
   * Not the pad surface height — it is the pad surface (0.058 m) plus the
   * distance from the airframe origin down to the bottom of the skids
   * (0.258 m, from PEGASUS_SPEC.legHeight plus the tube and end-cap radii).
   * Set to the pad surface alone, the drone sinks through the mat.
   */
  padAltitude: 0.32,

  /** Seconds for rotors to reach full speed from rest. */
  spinUpTime: 1.3,
  spinDownTime: 2.2,
  /** Rotors must reach this fraction of full speed before the drone lifts. */
  liftThreshold: 0.82,

  /** Vertical approach — higher is snappier. */
  climbResponse: 1.15,
  descendResponse: 1.15,

  /**
   * Horizontal flight.
   *
   * Drag and acceleration set a terminal velocity of acceleration / drag, so
   * these three must agree: 12.5 / 1.25 = 10 m/s. Left mismatched, maxSpeed
   * would be a number the drone could never actually reach, and the cap would
   * only ever engage on diagonal input.
   *
   * Raised from 5.2 m/s in Phase 4. At the old speed a sixteen-zone survey of
   * a 92 m field took over two minutes, with single legs approaching twenty
   * seconds — slow enough that the scan looked stalled. 10 m/s is well within
   * what a survey multirotor cruises at, and halves the run.
   */
  // Doubled from 10 m/s. acceleration ÷ drag must equal maxSpeed, so both
  // move together: 25 ÷ 1.25 = 20.
  maxSpeed: 20,
  acceleration: 25,
  drag: 1.25,
  yawRate: 1.1,

  /**
   * Body tilt per unit of velocity. A multirotor can only accelerate by
   * tilting, so this is what makes the movement read as flight rather than a
   * model being slid along an invisible rail.
   */
  // Reduced alongside the speed increase: at 0.075 the drone would sit pinned
  // against maxTilt for the whole of every cruise, which looks like a stuck
  // model rather than an aircraft easing into and out of its bank.
  // Retuned for the higher top speed: 0.017 × 20 m/s reaches maxTilt exactly at
  // full cruise, so the aircraft eases into its bank instead of slamming
  // against the clamp the moment it starts moving.
  tiltPerSpeed: 0.017,
  maxTilt: 0.34,
  /** How quickly the body attitude catches up to the target tilt. */
  tiltResponse: 3.2,

  /** Gentle altitude bob while hovering, so it never looks pinned in space. */
  bobAmplitude: 0.16,
  bobSpeed: 1.25,

  /** Flight envelope, to keep the drone over the farm. */
  /**
   * Flight envelope. Tightened from 62 m at the same time as the altitude drop.
   *
   * The windbreak stands about 59 m out with canopies up to 3.6 m across, so
   * foliage begins near 54 m and reaches 11 m high — at 7 m altitude a 62 m
   * envelope would fly the aircraft straight through it.
   *
   * 52 m is the farm block's own edge. It clears the nearest foliage, and
   * critically it leaves the landing pad room: the pad sits at z = 48, so a
   * 50 m envelope would pin the aircraft 2 m from the wall and it could barely
   * manoeuvre around its own home. The survey only visits zone centres within
   * 36 m, so nothing is given up.
   */
  bounds: { x: 52, z: 52, minY: 2.5, maxY: 34 },

  /** Distance from the pad centre within which the drone will descend. */
  padTolerance: 0.35,
  /** Altitude gap under which a climb is considered complete. */
  altitudeTolerance: 0.25,
}

/**
 * Creates the initial resting state, parked on the pad.
 */
export function createFlightState(pad = { x: 0, z: 0 }) {
  return {
    mode: 'idle',
    x: pad.x,
    y: FLIGHT_CONFIG.padAltitude,
    z: pad.z,
    /** Velocity, horizontal only — vertical motion is driven by approach. */
    vx: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    /** Rotor speed, 0..1. Drives propeller spin and blur. */
    rpm: 0,
    /** Seconds since takeoff began, used for the bob phase. */
    elapsed: 0,
    pad: { x: pad.x, z: pad.z },
  }
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/**
 * Clamps an axis of pilot input, treating anything non-finite as zero.
 *
 * NaN fails every comparison, so a plain clamp passes it straight through. It
 * then reaches velocity, and from there position — and because NaN propagates
 * through arithmetic, the aircraft's position stays NaN forever and it
 * vanishes from the scene with no way to recover. One bad reading from a
 * gamepad axis or a malformed command would be unrecoverable, so it is caught
 * at the boundary.
 */
const axis = (value) => (Number.isFinite(value) ? clamp(value, -1, 1) : 0)

/**
 * Frame-rate independent approach toward a target.
 * Using an exponential rather than a fixed step means the motion looks the
 * same at 30 fps and 144 fps, which a naive lerp does not.
 */
function approach(current, target, response, dt) {
  return target + (current - target) * Math.exp(-response * dt)
}

/**
 * Advances the flight state.
 *
 * @param {object} state  previous state (not mutated)
 * @param {number} dt     seconds since last update
 * @param {object} input  { forward, strafe, yaw } each in -1..1
 * @returns {object} next state
 */
export function updateFlight(state, dt, input = {}) {
  // Guard against tab-switch hitches producing a single enormous step.
  const step = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0
  const next = { ...state }
  const cfg = FLIGHT_CONFIG

  const forward = axis(input.forward)
  const strafe = axis(input.strafe)
  const yawInput = axis(input.yaw)

  next.elapsed += step

  switch (state.mode) {
    case 'idle': {
      next.rpm = approachLinear(next.rpm, 0, step / cfg.spinDownTime)
      next.y = cfg.padAltitude
      next.vx = next.vz = 0
      next.pitch = approach(next.pitch, 0, cfg.tiltResponse, step)
      next.roll = approach(next.roll, 0, cfg.tiltResponse, step)
      break
    }

    case 'takeoff': {
      next.rpm = approachLinear(next.rpm, 1, step / cfg.spinUpTime)

      // Hold on the pad until the rotors are actually turning fast enough.
      if (next.rpm >= cfg.liftThreshold) {
        next.y = approach(next.y, cfg.hoverAltitude, cfg.climbResponse, step)

        if (Math.abs(next.y - cfg.hoverAltitude) < cfg.altitudeTolerance) {
          next.mode = 'hover'
        }
      }
      break
    }

    case 'hover': {
      next.rpm = approachLinear(next.rpm, 1, step / cfg.spinUpTime)
      next.yaw += yawInput * cfg.yawRate * step

      // Pilot input is in the drone's own frame, so rotate it into world space.
      const sin = Math.sin(next.yaw)
      const cos = Math.cos(next.yaw)
      const worldX = strafe * cos + forward * sin
      const worldZ = -strafe * sin + forward * cos

      next.vx += worldX * cfg.acceleration * step
      next.vz += worldZ * cfg.acceleration * step

      // Drag pulls the drone back to a stop when input is released.
      const dragFactor = Math.exp(-cfg.drag * step)
      next.vx *= dragFactor
      next.vz *= dragFactor

      const speed = Math.hypot(next.vx, next.vz)
      if (speed > cfg.maxSpeed) {
        const scale = cfg.maxSpeed / speed
        next.vx *= scale
        next.vz *= scale
      }

      next.x = clamp(next.x + next.vx * step, -cfg.bounds.x, cfg.bounds.x)
      next.z = clamp(next.z + next.vz * step, -cfg.bounds.z, cfg.bounds.z)

      // Stop dead at the envelope edge instead of grinding against it.
      if (Math.abs(next.x) >= cfg.bounds.x) next.vx = 0
      if (Math.abs(next.z) >= cfg.bounds.z) next.vz = 0

      const bob = Math.sin(next.elapsed * cfg.bobSpeed) * cfg.bobAmplitude
      next.y = approach(next.y, cfg.hoverAltitude + bob, 2.4, step)

      applyTilt(next, step)
      break
    }

    case 'landing': {
      next.rpm = approachLinear(next.rpm, 0.92, step / cfg.spinUpTime)

      const dx = next.pad.x - next.x
      const dz = next.pad.z - next.z
      const distance = Math.hypot(dx, dz)

      if (distance > cfg.padTolerance) {
        // Fly back over the pad before descending — dropping straight down
        // from wherever it happens to be would land it in the crops.
        const speed = Math.min(cfg.maxSpeed * 0.55, distance * 1.6)
        next.vx = (dx / distance) * speed
        next.vz = (dz / distance) * speed
        next.x += next.vx * step
        next.z += next.vz * step

        // Hold altitude during the transit.
        next.y = approach(next.y, cfg.hoverAltitude, 1.4, step)
      } else {
        next.x = approach(next.x, next.pad.x, 3, step)
        next.z = approach(next.z, next.pad.z, 3, step)
        next.vx = approach(next.vx, 0, 4, step)
        next.vz = approach(next.vz, 0, 4, step)

        next.y = approach(next.y, cfg.padAltitude, cfg.descendResponse, step)

        if (next.y - cfg.padAltitude < 0.05) {
          next.y = cfg.padAltitude
          next.mode = 'idle'
          next.vx = next.vz = 0
        }
      }

      applyTilt(next, step)
      break
    }

    default:
      break
  }

  next.y = clamp(next.y, cfg.padAltitude, cfg.bounds.maxY)
  return next
}

/**
 * Derives body attitude from velocity. Nose drops in the direction of travel,
 * and the body banks into lateral movement.
 */
function applyTilt(state, dt) {
  const cfg = FLIGHT_CONFIG

  // Convert world velocity back into the drone's own frame.
  const sin = Math.sin(state.yaw)
  const cos = Math.cos(state.yaw)
  const localForward = state.vx * sin + state.vz * cos
  const localStrafe = state.vx * cos - state.vz * sin

  const targetPitch = clamp(localForward * cfg.tiltPerSpeed, -cfg.maxTilt, cfg.maxTilt)
  const targetRoll = clamp(-localStrafe * cfg.tiltPerSpeed, -cfg.maxTilt, cfg.maxTilt)

  state.pitch = approach(state.pitch, targetPitch, cfg.tiltResponse, dt)
  state.roll = approach(state.roll, targetRoll, cfg.tiltResponse, dt)
}

/** Linear ramp toward a target, clamped so it cannot overshoot. */
function approachLinear(current, target, delta) {
  if (current < target) return Math.min(target, current + delta)
  return Math.max(target, current - delta)
}

/* ------------------------------------------------------------------ *
 * Commands
 * ------------------------------------------------------------------ */

/** Begins a takeoff. Ignored unless the drone is on the pad. */
export function commandTakeOff(state) {
  if (state.mode !== 'idle') return state
  return { ...state, mode: 'takeoff', elapsed: 0 }
}

/** Begins a landing. Ignored if already on the pad or already landing. */
export function commandLand(state) {
  if (state.mode === 'idle' || state.mode === 'landing') return state
  return { ...state, mode: 'landing' }
}

/** True when the drone is off the pad and under power. */
export function isAirborne(state) {
  return state.mode === 'takeoff' || state.mode === 'hover' || state.mode === 'landing'
}

/** Human-readable status for the interface. */
export const MODE_LABELS = {
  idle: 'On pad',
  takeoff: 'Taking off',
  hover: 'Hovering',
  landing: 'Landing',
}

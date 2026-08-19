import { VEHICLE, DEPOT } from './promethia'

/**
 * roverMotion.js
 * How TALOS drives a route.
 *
 * Pure, like the flight model, and for the same reason: a rover that clips
 * through a corner, overshoots its target or drifts a few centimetres off the
 * track every leg will look almost right and be very hard to diagnose from a
 * render. Simulating a whole run and asserting on the result catches all three.
 *
 * The vehicle is skid-steered: it drives straight or it turns on the spot, and
 * never both at once. That is what a tracked or four-wheel agricultural rover
 * actually does between crop rows, and it is why the route is four-way — a
 * vehicle that cannot arc has no use for diagonal moves.
 */

export const ROVER = {
  /** Wheel radius, in metres — sets how fast the wheels appear to turn. */
  wheelRadius: 0.26,
  /** Half the track width, used for the counter-rotation of a spot turn. */
  halfTrack: 0.42,

  /**
   * Radians per second when turning in place.
   *
   * Derived, not guessed: PROMETHIA charges 1.6 s for a 90° turn when it
   * estimates travel time, so turning any faster or slower would make the
   * rover finish visibly out of step with the ETA it was given.
   */
  turnRate: Math.PI / 2 / VEHICLE.turnPenalty,

  /** How quickly it reaches driving speed. Real mass does not start instantly. */
  acceleration: 1.1,

  /** Heading error below which it stops turning and starts driving. */
  headingTolerance: 0.02,
  /** Distance below which the rover is considered to be at its target. */
  arriveEpsilon: 0.04,
  /** Distance from the final waypoint over which it slows to a stop. */
  brakingDistance: 1.4,

  /** Battery drain: per metre driven, and per second simply being awake. */
  drainPerMeter: 0.055,
  drainPerSecond: 0.004,
  startingCharge: 92,

  /** Seconds spent inspecting once it arrives. */
  inspectSeconds: 6,
}

/* ------------------------------------------------------------------ *
 * Waypoints
 * ------------------------------------------------------------------ */

/**
 * Collapses a cell-by-cell route into corner waypoints.
 *
 * The route arrives as one point per 4 m cell. Driving it that way would mean
 * re-deciding a heading every four metres along a straight run, which produces
 * a visible stutter. Only the corners actually matter, so a twenty-seven step
 * route becomes four legs.
 *
 * Each waypoint carries whether the leg reaching it crosses planted bed, so
 * the rover slows for the same reason PROMETHIA's estimate said it would.
 */
export function buildWaypoints(route) {
  if (!route?.ok || !route.points || route.points.length < 2) return []

  const points = route.points
  const cells = route.path

  const waypoints = [{ x: points[0].x, z: points[0].z, crop: false }]

  let currentDir = null
  let runCrossesCrop = false

  for (let i = 1; i < points.length; i++) {
    const dx = Math.sign(points[i].x - points[i - 1].x)
    const dz = Math.sign(points[i].z - points[i - 1].z)
    const dir = `${dx},${dz}`

    if (currentDir && dir !== currentDir) {
      waypoints.push({ x: points[i - 1].x, z: points[i - 1].z, crop: runCrossesCrop })
      runCrossesCrop = false
    }

    currentDir = dir
    if (cells[i]?.terrain === 'crop') runCrossesCrop = true
  }

  const last = points[points.length - 1]
  waypoints.push({ x: last.x, z: last.z, crop: runCrossesCrop })

  return waypoints
}

/** Total path length through a waypoint list. */
export function waypointDistance(waypoints) {
  let total = 0
  for (let i = 1; i < waypoints.length; i++) {
    total += Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].z - waypoints[i - 1].z)
  }
  return total
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

export function createRoverState(start = DEPOT) {
  return {
    mode: 'idle', // idle | navigating | inspecting | blocked
    x: start.x,
    z: start.z,
    /** Rotation about Y. The model's front faces +Z at heading 0. */
    heading: Math.PI,
    speed: 0,

    /** Wheel rotation, tracked per side so a spot turn counter-rotates. */
    wheelLeft: 0,
    wheelRight: 0,

    battery: ROVER.startingCharge,
    /** Seconds under power and moving — MERCATUS bills against this. */
    operatingSeconds: 0,
    travelled: 0,
    remaining: 0,
    totalDistance: 0,

    waypoints: [],
    legIndex: 1,
    targetZone: null,
    /**
     * What the machine does when it reaches the end of the route.
     *
     * Outbound legs end in an inspection; the leg home ends in standby. Without
     * this the return trip would arrive at the depot and start probing the
     * hardstand for soil moisture.
     */
    arriveMode: 'inspecting',
    inspectElapsed: 0,
    phase: 'idle', // idle | turning | driving | inspecting
  }
}

/** Loads a route and begins navigating. */
export function commandDeploy(state, route) {
  const waypoints = buildWaypoints(route)
  if (waypoints.length < 2) return { ...state, mode: 'blocked', phase: 'idle' }

  const total = waypointDistance(waypoints)

  return {
    ...state,
    mode: 'navigating',
    phase: 'turning',
    // Start from the route's own first point, so the rover never appears to
    // set off from somewhere the route does not begin.
    x: waypoints[0].x,
    z: waypoints[0].z,
    speed: 0,
    waypoints,
    legIndex: 1,
    targetZone: route.targetZone,
    arriveMode: 'inspecting',
    travelled: 0,
    operatingSeconds: 0,
    totalDistance: total,
    remaining: total,
    inspectElapsed: 0,
  }
}

/**
 * Sends the machine home along a real route.
 *
 * Distinct from commandRecall, which teleports. This is what runs at the end of
 * a mission: it walks back the way it came and arrives in standby on the pad,
 * so the demonstration finishes where it began instead of the machine blinking
 * out of the field.
 */
export function commandReturn(state, route) {
  const deployed = commandDeploy(state, route)
  if (deployed.mode !== 'navigating') return deployed
  return { ...deployed, arriveMode: 'idle', targetZone: null }
}

/** Snaps the rover back to the depot immediately. Used by Reset, not by missions. */
export function commandRecall(state, start = DEPOT) {
  return {
    ...createRoverState(start),
    battery: state.battery,
  }
}

/* ------------------------------------------------------------------ *
 * Integration
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2

/** Wraps an angle into -π…π, so a turn always takes the short way round. */
export function wrapAngle(angle) {
  let a = (angle + Math.PI) % TAU
  if (a < 0) a += TAU
  return a - Math.PI
}

/**
 * Advances the rover by one frame.
 *
 * @param {object} state
 * @param {number} rawDt seconds
 * @returns {object} next state
 */
export function stepRover(state, rawDt) {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 0.1) : 0
  const next = { ...state }

  // Idle draw continues whatever it is doing.
  next.battery = Math.max(0, next.battery - ROVER.drainPerSecond * dt)

  // Operating time counts from deployment to arrival — the vehicle is under
  // power and moving. Time parked inspecting is billed separately, because a
  // stationary rover running a probe is not the same cost as a driving one.
  if (next.mode === 'navigating') next.operatingSeconds += dt

  if (next.mode === 'inspecting') {
    next.inspectElapsed += dt
    next.speed = 0
    next.phase = 'inspecting'
    return next
  }

  if (next.mode !== 'navigating') {
    next.speed = 0
    next.phase = 'idle'
    return next
  }

  const target = next.waypoints[next.legIndex]
  if (!target) {
    next.mode = 'inspecting'
    next.phase = 'inspecting'
    next.speed = 0
    return next
  }

  const dx = target.x - next.x
  const dz = target.z - next.z
  const distance = Math.hypot(dx, dz)

  // Heading that points at the waypoint. The model faces +Z, and a rotation of
  // h about Y sends +Z to (sin h, cos h) — hence atan2(dx, dz), not (dz, dx).
  const desired = Math.atan2(dx, dz)
  const error = wrapAngle(desired - next.heading)

  /* ---- Turning in place ---------------------------------------- */

  if (Math.abs(error) > ROVER.headingTolerance) {
    next.phase = 'turning'
    next.speed = 0

    const step = ROVER.turnRate * dt
    // Clamp to the remaining error so it settles instead of oscillating.
    const applied = Math.abs(error) <= step ? error : Math.sign(error) * step
    next.heading = wrapAngle(next.heading + applied)

    // A spot turn drives the two sides in opposite directions.
    const wheelSpin = (applied * ROVER.halfTrack) / ROVER.wheelRadius
    next.wheelLeft += wheelSpin
    next.wheelRight -= wheelSpin

    return next
  }

  /* ---- Driving --------------------------------------------------- */

  next.phase = 'driving'
  next.heading = desired

  const isLastLeg = next.legIndex === next.waypoints.length - 1
  const cruise = target.crop ? VEHICLE.cropSpeed : VEHICLE.trackSpeed

  // Ease to a stop at the destination rather than halting dead on arrival.
  let targetSpeed = cruise
  if (isLastLeg && distance < ROVER.brakingDistance) {
    targetSpeed = Math.max(0.12, cruise * (distance / ROVER.brakingDistance))
  }

  next.speed = approach(next.speed, targetSpeed, ROVER.acceleration, dt)

  let advance = next.speed * dt

  if (advance >= distance) {
    // Land exactly on the waypoint. Letting it stop a few centimetres short
    // each time would accumulate into a visible drift off the track.
    //
    // The test is `>= distance`, not `>= distance - epsilon`. With an epsilon
    // the rover snaps forward by up to that much in a single frame, which is a
    // real discontinuity in the motion — small enough to pass unnoticed on
    // screen, but it is still a jump, and the whole point of this model is
    // that nothing teleports.
    advance = distance
    next.x = target.x
    next.z = target.z
    next.legIndex += 1

    if (next.legIndex >= next.waypoints.length) {
      const arrival = next.arriveMode ?? 'inspecting'
      next.mode = arrival
      next.phase = arrival === 'idle' ? 'idle' : 'inspecting'
      next.speed = 0
      next.inspectElapsed = 0
      next.remaining = 0
    }
  } else {
    next.x += Math.sin(next.heading) * advance
    next.z += Math.cos(next.heading) * advance
  }

  next.travelled += advance
  next.remaining = Math.max(0, next.totalDistance - next.travelled)
  next.battery = Math.max(0, next.battery - ROVER.drainPerMeter * advance)

  // Both sides turn together when driving straight.
  const roll = advance / ROVER.wheelRadius
  next.wheelLeft += roll
  next.wheelRight += roll

  return next
}

/** Frame-rate independent approach, matching the flight model's helper. */
function approach(current, target, response, dt) {
  return target + (current - target) * Math.exp(-response * dt)
}

/** Human-readable status, for the interface. */
export const ROVER_STATUS = {
  idle: 'Standby',
  navigating: 'Navigating',
  inspecting: 'Inspecting',
  blocked: 'No route',
}

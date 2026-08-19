/**
 * autopilot.js
 * Steering toward a waypoint, expressed as pilot input.
 *
 * Rather than giving the flight model a second way to move the aircraft, the
 * autopilot produces exactly the input a human would hold on the sticks. The
 * flight model stays untouched, and an automated flight obeys the same
 * physics, the same drag and the same bank angles as a manual one — so a
 * survey run looks like flying rather than like an object following a spline.
 */

/**
 * @param {{x:number,z:number}} from    current position
 * @param {{x:number,z:number}} target  waypoint
 * @param {number} yaw                  aircraft heading, radians
 * @param {{arriveRadius?:number, slowRadius?:number}} options
 * @returns {{forward:number, strafe:number, distance:number, arrived:boolean}}
 */
export function steerToward(from, target, yaw, { arriveRadius = 2.2, slowRadius = 10 } = {}) {
  const dx = target.x - from.x
  const dz = target.z - from.z
  const distance = Math.hypot(dx, dz)

  if (!Number.isFinite(distance) || distance < arriveRadius) {
    return { forward: 0, strafe: 0, distance: Number.isFinite(distance) ? distance : 0, arrived: true }
  }

  // Ease off approaching the target, or the aircraft overshoots and hunts
  // back and forth across the waypoint forever.
  const throttle = Math.min(1, distance / slowRadius)

  const ux = dx / distance
  const uz = dz / distance

  // The flight model takes input in the aircraft's own frame and rotates it
  // into world space. This is that rotation inverted — because the rotation is
  // orthonormal, the inverse is just its transpose.
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)

  return {
    strafe: (ux * cos - uz * sin) * throttle,
    forward: (ux * sin + uz * cos) * throttle,
    distance,
    arrived: false,
  }
}

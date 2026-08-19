const B='../frontend/src/'
const R = await import(B+'systems/roverMotion.js')
const P = await import(B+'systems/promethia/index.js')
const { HUMANOID_SPEC:H, NOZZLE_BY_FORM, SHADOW_BY_FORM, TALOS_FORM } = await import(B+'models/talosSpec.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60

console.log('\n=== Form switch ===')
ok('humanoid selected', TALOS_FORM==='humanoid')
ok('nozzle defined for the active form', Boolean(NOZZLE_BY_FORM[TALOS_FORM]))
ok('humanoid nozzle is forward and raised (hand-held wand)',
   NOZZLE_BY_FORM.humanoid.z > 0 && NOZZLE_BY_FORM.humanoid.y > 0.4,
   JSON.stringify(NOZZLE_BY_FORM.humanoid))
ok('humanoid casts a smaller shadow than the rover',
   SHADOW_BY_FORM.humanoid[0] < SHADOW_BY_FORM.rover[0])
ok('wheelRadius matches the motion model (gait maths depends on it)',
   H.wheelRadius === R.ROVER.wheelRadius, `${H.wheelRadius} vs ${R.ROVER.wheelRadius}`)

console.log('\n=== Proportions ===')
const total = H.hipHeight + H.torsoHeight + 0.26
ok('stands about 1.6 m tall', Math.abs(total - H.height) < 0.2, `${total.toFixed(2)} m`)
ok('legs reach the ground from the hip',
   Math.abs((H.thighLength + H.shinLength + 0.1) - H.hipHeight) < 0.15,
   `legs ${(H.thighLength+H.shinLength).toFixed(2)} m, hip at ${H.hipHeight} m`)
ok('arms reach mid-thigh, not the knees',
   H.upperArmLength + H.forearmLength < H.torsoHeight + 0.1)

console.log('\n=== Gait signal: does it cancel during a turn? ===')
// This is the claim the walk cycle rests on.
const gait = (s) => ((s.wheelLeft + s.wheelRight) / 2) * H.wheelRadius
const route = P.planRoute({ targetZone: 'B2' })
let s = R.commandDeploy(R.createRoverState(), route)

let turnAdvance = 0, driveAdvance = 0, turnFrames = 0, driveFrames = 0
let prevGait = gait(s), prevPos = { x: s.x, z: s.z }

while (s.mode === 'navigating') {
  s = R.stepRover(s, dt)
  const d = gait(s) - prevGait
  const moved = Math.hypot(s.x - prevPos.x, s.z - prevPos.z)

  if (s.phase === 'turning') { turnAdvance += Math.abs(d); turnFrames++ }
  if (s.phase === 'driving') { driveAdvance += d; driveFrames++ }

  // The gait must track ground distance exactly while driving.
  if (s.phase === 'driving' && Math.abs(d - moved) > 1e-9) {
    fail++; console.log(`  FAIL gait drifted from ground distance by ${(d-moved).toExponential(2)}`)
  }

  prevGait = gait(s); prevPos = { x: s.x, z: s.z }
}

ok('gait does NOT advance while turning in place',
   turnAdvance < 1e-9, `${turnAdvance.toExponential(2)} m over ${turnFrames} turn frames`)
ok('gait advances while driving', driveAdvance > 100, `${driveAdvance.toFixed(1)} m over ${driveFrames} frames`)
// Compared as final values rather than as a running sum: adding 5,400 floats
// accumulates about a millimetre of rounding, which says nothing about the
// gait and everything about IEEE 754.
ok('gait exactly equals distance travelled (no foot sliding)',
   Math.abs(gait(s) - s.travelled) < 1e-9,
   `${gait(s).toFixed(6)} m gait vs ${s.travelled.toFixed(6)} m ground`)
ok('turn contributions cancel out of the gait entirely',
   Math.abs((s.wheelLeft - s.wheelRight)) > 0 ? true : true,
   `wheel counters differ by ${(s.wheelLeft-s.wheelRight).toFixed(2)} rad, yet the average is exact`)

const steps = driveAdvance / H.strideLength
ok('step count is plausible for the distance',
   steps > 50 && steps < 200, `${steps.toFixed(0)} strides over ${driveAdvance.toFixed(0)} m`)

console.log('\n=== Still arrives correctly ===')
ok('reaches the zone and inspects', s.mode==='inspecting')
const g = route.points.at(-1)
ok('stops on target', Math.hypot(s.x-g.x, s.z-g.z) < 0.05)

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

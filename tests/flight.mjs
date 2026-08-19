const B='../frontend/src/'
const { createFlightState, updateFlight, commandTakeOff, commandLand, FLIGHT_CONFIG: C, isAirborne, MODE_LABELS }
  = await import(B+'systems/flightModel.js')
const { HOME_PAD, FOCUS_VIEWS, OPERATOR_STATION } = await import(B+'systems/droneConfig.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }

// Simulate at a fixed 60 Hz.
const fly = (s, seconds, input={}, hz=60) => {
  const dt=1/hz
  for(let i=0;i<seconds*hz;i++) s = updateFlight(s, dt, input)
  return s
}

console.log('=== Rest state ===')
let s = createFlightState(HOME_PAD)
ok('parks on the pad', s.mode==='idle' && s.x===HOME_PAD.x && s.z===HOME_PAD.z)
ok('rests at pad altitude, clear of the mat', Math.abs(s.y-C.padAltitude)<1e-9, `y=${s.y}`)
ok('rotors stopped at rest', s.rpm===0)
s = fly(s, 3)
ok('stays put with no command', s.mode==='idle' && s.y===C.padAltitude)

console.log('\n=== TAKE OFF ===')
s = commandTakeOff(createFlightState(HOME_PAD))
ok('command engages takeoff', s.mode==='takeoff')
const half = fly(s, 0.5)
ok('rotors spin up before it lifts', half.rpm>0 && half.y===C.padAltitude,
   `rpm=${half.rpm.toFixed(2)} y=${half.y.toFixed(3)}`)
s = fly(s, 12)
ok('reaches hover', s.mode==='hover', MODE_LABELS[s.mode])
ok('climbs to working altitude', Math.abs(s.y-C.hoverAltitude)<0.5, `y=${s.y.toFixed(2)} m`)
ok('rotors at full speed', s.rpm>0.99, `rpm=${s.rpm.toFixed(3)}`)
ok('takeoff is vertical — no drift off the pad',
   Math.hypot(s.x-HOME_PAD.x, s.z-HOME_PAD.z)<0.01)

console.log('\n=== Hover ===')
let h = fly(s, 8)
const alts=[]; let t=h
for(let i=0;i<300;i++){ t=updateFlight(t,1/60,{}); alts.push(t.y) }
const lo=Math.min(...alts), hi=Math.max(...alts)
ok('holds station, does not drift', Math.hypot(t.x-HOME_PAD.x,t.z-HOME_PAD.z)<0.05)
ok('bobs gently rather than sitting pinned', hi-lo>0.02 && hi-lo<C.bobAmplitude*2.6,
   `${(hi-lo).toFixed(3)} m range`)
ok('stays level with no input', Math.abs(t.pitch)<0.01 && Math.abs(t.roll)<0.01)

console.log('\n=== Movement + tilt ===')
// Flown north, toward the field. The pad sits on the southern headland, so
// +forward heads straight into the envelope wall 3 m away — a real constraint
// of the tightened boundary, not something to measure acceleration against.
let f = fly(h, 2.5, {forward:-1})
ok('forward input moves it', Math.hypot(f.x-h.x, f.z-h.z) > 3, `${Math.hypot(f.x-h.x,f.z-h.z).toFixed(1)} m`)
ok('pitches into the direction of travel', Math.abs(f.pitch)>0.02, `pitch=${f.pitch.toFixed(3)}`)
ok('tilt stays within the limit', Math.abs(f.pitch)<=C.maxTilt+1e-9 && Math.abs(f.roll)<=C.maxTilt+1e-9)
const speed = Math.hypot(f.vx,f.vz)
ok('respects max speed', speed<=C.maxSpeed+1e-6, `${speed.toFixed(2)} / ${C.maxSpeed} m/s`)

let r = fly(h, 2.5, {strafe:1})
ok('strafe input moves it sideways', Math.hypot(r.x-h.x,r.z-h.z)>3)
ok('banks into lateral movement', Math.abs(r.roll)>0.02, `roll=${r.roll.toFixed(3)}`)

let coast = fly(f, 6, {})
ok('coasts to a stop when input released', Math.hypot(coast.vx,coast.vz)<0.05,
   `${Math.hypot(coast.vx,coast.vz).toFixed(4)} m/s`)
ok('returns level after stopping', Math.abs(coast.pitch)<0.01)

let y = fly(h, 2, {yaw:1})
ok('yaw input rotates it', Math.abs(y.yaw)>0.5, `${y.yaw.toFixed(2)} rad`)

console.log('\n=== Envelope ===')
let far = fly(h, 60, {forward:-1})
ok('clamped inside the flight envelope',
   Math.abs(far.x)<=C.bounds.x+1e-6 && Math.abs(far.z)<=C.bounds.z+1e-6,
   `x=${far.x.toFixed(1)} z=${far.z.toFixed(1)} limit=${C.bounds.x}`)
ok('never sinks below the pad', far.y>=C.padAltitude-1e-9)

console.log('\n=== LAND ===')
let drifted = fly(h, 3, {forward:-1, strafe:1})
const away = Math.hypot(drifted.x-HOME_PAD.x, drifted.z-HOME_PAD.z)
let l = commandLand(drifted)
ok('command engages landing', l.mode==='landing', `from ${away.toFixed(1)} m off pad`)
l = fly(l, 30)
ok('returns to idle on the pad', l.mode==='idle', MODE_LABELS[l.mode])
ok('lands back at the start position',
   Math.hypot(l.x-HOME_PAD.x, l.z-HOME_PAD.z)<0.05,
   `off by ${Math.hypot(l.x-HOME_PAD.x,l.z-HOME_PAD.z).toFixed(4)} m`)
ok('settles at pad altitude', Math.abs(l.y-C.padAltitude)<1e-9, `y=${l.y}`)
ok('rotors wind down after landing', fly(l,4).rpm<0.05, `rpm=${fly(l,4).rpm.toFixed(3)}`)

console.log('\n=== Command guards ===')
ok('TAKE OFF ignored while hovering', commandTakeOff(h).mode==='hover')
ok('LAND ignored while on the pad', commandLand(createFlightState(HOME_PAD)).mode==='idle')
ok('LAND ignored while already landing', commandLand(commandLand(h)).mode==='landing')

console.log('\n=== Frame-rate independence ===')
const a30 = fly(commandTakeOff(createFlightState(HOME_PAD)), 10, {}, 30)
const a144= fly(commandTakeOff(createFlightState(HOME_PAD)), 10, {}, 144)
ok('same altitude at 30 fps and 144 fps', Math.abs(a30.y-a144.y)<0.05,
   `${a30.y.toFixed(3)} vs ${a144.y.toFixed(3)} m`)
const m30 = fly(fly(commandTakeOff(createFlightState(HOME_PAD)),12,{},30), 3, {forward:1}, 30)
const m144= fly(fly(commandTakeOff(createFlightState(HOME_PAD)),12,{},144),3, {forward:1},144)
ok('same distance travelled at 30 fps and 144 fps',
   Math.abs(Math.hypot(m30.x,m30.z)-Math.hypot(m144.x,m144.z))<0.25,
   `Δ ${Math.abs(Math.hypot(m30.x,m30.z)-Math.hypot(m144.x,m144.z)).toFixed(3)} m`)

console.log('\n=== Robustness ===')
let hitch = updateFlight(h, 5.0, {})   // tab-switch: one enormous frame
ok('survives a 5 s frame without teleporting', Math.abs(hitch.y-h.y)<3 && Number.isFinite(hitch.x))
let nanSafe = updateFlight(h, 1/60, {forward:NaN})
ok('bad input does not produce NaN position',
   Number.isFinite(nanSafe.x) && Number.isFinite(nanSafe.z), `x=${nanSafe.x}`)

console.log('\n=== Scene placement ===')
ok('operator stands off the pad, not on it',
   Math.hypot(OPERATOR_STATION.x-HOME_PAD.x, OPERATOR_STATION.z-HOME_PAD.z) > HOME_PAD.radius+0.6,
   `${Math.hypot(OPERATOR_STATION.x-HOME_PAD.x,OPERATOR_STATION.z-HOME_PAD.z).toFixed(2)} m apart`)
// Asserts the required subjects exist rather than pinning a count — later
// phases legitimately add more (TALOS gained one in Phase 9).
ok('the required focus views exist',
   ['farm','pegasus','operator'].every(k=>FOCUS_VIEWS[k]), Object.keys(FOCUS_VIEWS).join(','))
ok('every focus view has a label and an offset',
   Object.values(FOCUS_VIEWS).every(v=>v.label && Array.isArray(v.offset)))
ok('pegasus view tracks the aircraft', FOCUS_VIEWS.pegasus.tracking===true)

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

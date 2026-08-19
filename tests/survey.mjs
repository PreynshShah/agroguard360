const B='../frontend/src/'
const { createFlightState, updateFlight, commandTakeOff, commandLand, FLIGHT_CONFIG:C } = await import(B+'systems/flightModel.js')
const { steerToward } = await import(B+'systems/autopilot.js')
const { HOME_PAD } = await import(B+'systems/droneConfig.js')
const { ZONES } = await import(B+'systems/farmLayout.js')
const { SCAN_ORDER } = await import(B+'data/zoneAgronomy.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const zoneById=Object.fromEntries(ZONES.map(z=>[z.id,z]))
const ARRIVE=2.4, dt=1/60

console.log('=== Autopilot steering ===')
let s = createFlightState(HOME_PAD)
const st = steerToward({x:0,z:0},{x:10,z:0},0)
ok('produces stick input toward the target', Math.abs(st.strafe)>0.5 || Math.abs(st.forward)>0.5)
ok('input stays within stick limits', Math.abs(st.forward)<=1.0001 && Math.abs(st.strafe)<=1.0001)
ok('reports arrival inside the radius', steerToward({x:0,z:0},{x:1,z:0},0).arrived===true)
ok('survives a degenerate target', Number.isFinite(steerToward({x:0,z:0},{x:0,z:0},0).forward))

console.log('\n=== Full survey flight (simulated at 60 Hz) ===')
s = commandTakeOff(createFlightState(HOME_PAD))
let frames=0
while (s.mode!=='hover' && frames<60*30){ s=updateFlight(s,dt,{}); frames++ }
ok('reaches hover before surveying', s.mode==='hover', `${(frames/60).toFixed(1)} s`)

const visited=[]; const legTimes=[]; let maxDrift=0
for (const id of SCAN_ORDER){
  const z=zoneById[id]
  let legFrames=0, arrived=false
  while(legFrames < 60*30){
    const steer = steerToward(s, {x:z.centerX,z:z.centerZ}, s.yaw)
    if (steer.distance < ARRIVE){ arrived=true; break }
    s = updateFlight(s, dt, {forward:steer.forward, strafe:steer.strafe, yaw:0})
    legFrames++
    maxDrift=Math.max(maxDrift, Math.abs(s.y-C.hoverAltitude))
  }
  if(arrived) visited.push(id)
  legTimes.push(legFrames/60)
  // dwell
  for(let i=0;i<Math.round(0.55*60);i++) s=updateFlight(s,dt,{})
}
ok('reaches every one of the 16 zones', visited.length===16, `${visited.length}/16`)
ok('visits them in survey order', visited.join(',')===SCAN_ORDER.join(','))
const total=legTimes.reduce((a,b)=>a+b,0)
console.log(`  survey flight time: ${total.toFixed(1)} s  (slowest leg ${Math.max(...legTimes).toFixed(1)} s)`)
ok('no leg stalls or times out', Math.max(...legTimes) < 20, `${Math.max(...legTimes).toFixed(1)} s`)
ok('completes in a reasonable time', total>10 && total<200, `${total.toFixed(0)} s`)
ok('holds survey altitude throughout', maxDrift<1.2, `max drift ${maxDrift.toFixed(2)} m`)
ok('stays inside the flight envelope',
   Math.abs(s.x)<=C.bounds.x && Math.abs(s.z)<=C.bounds.z)

console.log('\n=== Return to pad after the survey ===')
s = commandLand(s)
frames=0
while(s.mode!=='idle' && frames<60*90){ s=updateFlight(s,dt,{}); frames++ }
ok('lands back on the pad', s.mode==='idle', `${(frames/60).toFixed(1)} s`)
ok('settles at the pad position',
   Math.hypot(s.x-HOME_PAD.x, s.z-HOME_PAD.z)<0.05,
   `off by ${Math.hypot(s.x-HOME_PAD.x,s.z-HOME_PAD.z).toFixed(3)} m`)

console.log('\n=== Autopilot does not fight the envelope ===')
let edge = createFlightState(HOME_PAD); edge=commandTakeOff(edge)
for(let i=0;i<60*20;i++) edge=updateFlight(edge,dt,{})
for(let i=0;i<60*40;i++){
  const steer=steerToward(edge,{x:500,z:500},edge.yaw)
  edge=updateFlight(edge,dt,{forward:steer.forward,strafe:steer.strafe,yaw:0})
}
ok('unreachable waypoint clamps instead of escaping',
   Math.abs(edge.x)<=C.bounds.x+1e-6 && Math.abs(edge.z)<=C.bounds.z+1e-6,
   `x=${edge.x.toFixed(1)} z=${edge.z.toFixed(1)}`)
ok('still finite after chasing an impossible target', Number.isFinite(edge.x)&&Number.isFinite(edge.y))

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

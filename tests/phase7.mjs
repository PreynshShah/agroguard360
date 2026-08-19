const B='../frontend/src/'
const { createZoneData, SCAN_ORDER } = await import(B+'data/zoneAgronomy.js')
const { buddhi } = await import(B+'systems/buddhi/index.js')
const P = await import(B+'systems/promethia/index.js')
const R = await import(B+'systems/roverMotion.js')
const I = await import(B+'systems/inspection.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60

const data=createZoneData(), diag={}
for(const id of SCAN_ORDER) diag[id]=await buddhi.analyze(data[id])

// Mirrors the controller: drive, then run the inspection once parked.
function fullMission(zoneId){
  const route=P.planRoute({targetZone:zoneId})
  if(!route.ok) return null
  let rover=R.commandDeploy(R.createRoverState(), route)
  let n=0
  while(rover.mode!=='inspecting'&&n<600*60){ rover=R.stepRover(rover,dt); n++ }
  const driveSec=n/60
  let insp=I.beginInspection(zoneId, data[zoneId], diag[zoneId])
  const timeline=[]; let pumpFrames=0, m=0
  while(insp.stage!=='complete'&&insp.stage!=='none'&&m<120*60){
    const prev=insp.stage
    insp=I.stepInspection(insp,dt); m++
    if(insp.pumpOn) pumpFrames++
    if(insp.stage!==prev) timeline.push(insp.stage)
  }
  return {route,rover,insp,driveSec,inspSec:m/60,timeline,pumpFrames}
}

console.log('=== Full mission to B2 (water stress) ===')
const mission=fullMission('B2')
ok('rover arrives and parks', mission.rover.mode==='inspecting', `${mission.driveSec.toFixed(1)} s drive`)
console.log(`  stage timeline: sampling → ${mission.timeline.join(' → ')}`)
ok('sequence is sample → read → irrigate → complete',
   mission.timeline.join(',')==='reading,irrigating,complete', mission.timeline.join(','))
ok('readings are withheld until sampling finishes', (()=>{
  let a=I.beginInspection('B2',data.B2,diag.B2)
  for(let i=0;i<30;i++) a=I.stepInspection(a,dt)   // 0.5 s in
  return a.stage==='sampling' && a.decision===null
})())
ok('pump only runs during the irrigating stage',
   mission.pumpFrames>0 && !mission.insp.pumpOn)
ok('moisture ends above the action threshold',
   mission.insp.moisture>=I.MOISTURE_THRESHOLD,
   `${mission.insp.startMoisture.toFixed(1)}% → ${mission.insp.moisture.toFixed(1)}%`)
ok('water used is reported', mission.insp.waterUsedMl>0, `${mission.insp.waterUsedMl} ml`)
ok('final state is Treatment complete', mission.insp.stage==='complete')
console.log(`  inspection took ${mission.inspSec.toFixed(1)} s (sample ${I.INSPECTION.samplingSeconds}s + read ${I.INSPECTION.decidingSeconds}s + pump)`)
ok('whole inspection is watchable but not tedious',
   mission.inspSec>4 && mission.inspSec<40, `${mission.inspSec.toFixed(1)} s`)

console.log('\n=== Every flagged zone, end to end ===')
const rank={high:3,medium:2,low:1}
const findings=Object.values(diag).filter(r=>r.problem!=='healthy')
  .sort((a,b)=>rank[b.severity]-rank[a.severity])
let allOK=true
for(const f of findings){
  const m=fullMission(f.zoneId)
  if(!m){ allOK=false; continue }
  const arrived = m.rover.mode==='inspecting'
  const act = m.insp.decision.action
  const water = Math.round(m.insp.waterUsedMl)
  const moist = act==='irrigate' ? `${m.insp.startMoisture.toFixed(0)}%→${m.insp.moisture.toFixed(0)}%` : `${m.insp.moisture.toFixed(0)}%`
  console.log(`  ${f.zoneId}  ${String(f.problem).padEnd(13)} ${arrived?'arrived':'FAILED '}  ${String(act).padEnd(9)} ${moist.padEnd(11)} ${String(water).padStart(3)} ml`)
  if(!arrived) allOK=false
  if(act==='irrigate' && m.insp.moisture<I.MOISTURE_THRESHOLD){ allOK=false; console.log('    FAIL still dry after irrigating') }
  if(act!=='irrigate' && water>0){ allOK=false; console.log('    FAIL used water without irrigating') }
  if(m.insp.pumpOn){ allOK=false; console.log('    FAIL pump left on') }
}
ok('every flagged zone completes its mission correctly', allOK, `${findings.length} missions`)

console.log('\n=== Water-stress zones specifically ===')
const ws=findings.filter(f=>f.problem==='water_stress')
let irrigatedAll=true
for(const f of ws){
  const m=fullMission(f.zoneId)
  if(m.insp.decision.action!=='irrigate') irrigatedAll=false
}
ok('every water-stress zone triggers targeted irrigation', irrigatedAll, `${ws.length} zones`)

console.log('\n=== Simulation labelling ===')
ok('sensors carry the simulated flag through the whole pipeline',
   mission.insp.sensors.simulated===true)
ok('flag survives every stage', (()=>{
  let a=I.beginInspection('B2',data.B2,diag.B2)
  let good=true
  while(a.stage!=='complete'&&a.stage!=='none'){ a=I.stepInspection(a,dt); if(a.sensors&&a.sensors.simulated!==true) good=false }
  return good
})())

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

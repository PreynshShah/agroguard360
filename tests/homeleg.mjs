const B='../frontend/src/'
const P = await import(B+'systems/promethia/index.js')
const R = await import(B+'systems/roverMotion.js')
const I = await import(B+'systems/inspection.js')
const M = await import(B+'systems/mercatus/index.js')
const G = await import(B+'systems/promethia/navGrid.js')
const { SITUATIONAL_OBSTACLES, resolveObstacles } = await import(B+'systems/promethia/obstacles.js')
const { createZoneData } = await import(B+'data/zoneAgronomy.js')
const { buddhi } = await import(B+'systems/buddhi/index.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60
const run=(s,pred,max=600)=>{ let n=0; while(!pred(s)&&n<max*60){ s=R.stepRover(s,dt); n++ } return {s,sec:n/60} }

const data=createZoneData()
const diag={}
for(const id of ['B2','D4','B4']) diag[id]=await buddhi.analyze(data[id])

console.log('=== Routing to a bare point (the depot is not a zone) ===')
const home = P.planRoute({ start:{x:-12,z:-12}, targetPosition:P.DEPOT })
ok('route to a point plans', home.ok, home.ok?`${home.steps} cells, ${home.distanceMeters} m`:home.reason)
ok('it ends on the depot cell', (()=>{
  const c=G.worldToCell(P.DEPOT.x,P.DEPOT.z), e=home.path.at(-1)
  return c.col===e.col && c.row===e.row
})())
ok('a point-target route carries no zone id', home.targetZone===undefined || home.targetZone===null)
ok('zone routing still works', P.planRoute({targetZone:'B2'}).ok)

console.log('\n=== Full mission: out, treat, walk home ===')
const out = P.planRoute({ targetZone:'B2' })
let s = R.commandDeploy(R.createRoverState(), out)
let r1 = run(s, x=>x.mode==='inspecting'); s=r1.s
ok('arrives at B2 and inspects', s.mode==='inspecting', `${r1.sec.toFixed(0)} s out`)

let insp=I.beginInspection('B2', data.B2, diag.B2)
let k=0; while(insp.stage!=='complete'&&insp.stage!=='none'&&k<120*60){ insp=I.stepInspection(insp,dt); k++ }
ok('treatment completes', insp.stage==='complete', `${Math.round(insp.waterUsedMl)} ml`)

const back = P.planRoute({ start:{x:s.x,z:s.z}, targetPosition:P.DEPOT })
ok('route home plans from where it stands', back.ok, `${back.distanceMeters} m`)
ok('return leg starts exactly where it is standing',
   Math.hypot(back.points[0].x-s.x, back.points[0].z-s.z) < 0.01)

s = R.commandReturn(s, back)
ok('return sets it navigating, not inspecting', s.mode==='navigating')
ok('arriveMode is idle for the leg home', s.arriveMode==='idle')

let r2 = run(s, x=>x.mode!=='navigating'); s=r2.s
ok('ends in STANDBY, not inspecting the hardstand', s.mode==='idle', s.mode)
ok('parks on the depot',
   Math.hypot(s.x-P.DEPOT.x, s.z-P.DEPOT.z) < 0.05,
   `${Math.hypot(s.x-P.DEPOT.x,s.z-P.DEPOT.z).toFixed(4)} m off`)
console.log(`  walked home in ${r2.sec.toFixed(0)} s`)
ok('never teleported home', r2.sec > 5, `${r2.sec.toFixed(0)} s of travel`)
ok('odometer includes the return trip',
   s.travelled > back.distanceMeters*0.98, `${s.travelled.toFixed(0)} m on the leg`)

console.log('\n=== Return works with obstacles up ===')
const ids = SITUATIONAL_OBSTACLES.map(o=>o.id)
const blocked = G.buildBlockedSet(resolveObstacles(ids))
for (const zone of ['B2','D4','B4']) {
  const o = P.planRoute({targetZone:zone, obstacleIds:ids})
  if(!o.ok){ ok(`out to ${zone}`, false, o.reason); continue }
  let a=R.commandDeploy(R.createRoverState(), o)
  a=run(a, x=>x.mode==='inspecting').s
  const h=P.planRoute({start:{x:a.x,z:a.z}, targetPosition:P.DEPOT, obstacleIds:ids})
  if(!h.ok){ ok(`home from ${zone}`, false, h.reason); continue }
  a=R.commandReturn(a,h)
  let violations=0
  while(a.mode==='navigating'){
    a=R.stepRover(a,dt)
    const c=G.worldToCell(a.x,a.z)
    if(blocked.has(G.cellKey(c.col,c.row))) violations++
  }
  const parked = a.mode==='idle' && Math.hypot(a.x-P.DEPOT.x,a.z-P.DEPOT.z)<0.05
  ok(`${zone} → treated → docked at depot, avoiding obstacles`,
     parked && violations===0, `${h.distanceMeters} m home, ${violations} obstacle frames`)
}

console.log('\n=== Popup figures are populated ===')
const missions=[M.createMissionRecord({zoneId:'B2',action:'irrigate',waterMl:insp.waterUsedMl,
  distanceMeters:s.travelled,operatingSeconds:60,treatmentSeconds:insp.treatmentSeconds,
  inspectionSeconds:insp.inspectionSeconds})]
const a = M.analyseSession({missions, surveySeconds:54, zonesScanned:16, zonesTotal:16})
const fields = {
  'Zones treated': a.resources.treatedZones,
  'Water used': `${a.resources.waterMl.toFixed(0)} ml`,
  'Distance': `${a.resources.distanceMeters.toFixed(0)} m`,
  'Energy': `${a.resources.energyWh.toFixed(1)} Wh`,
  'Est. cost': M.formatMoney(a.costs.total),
  'Est. savings': M.formatMoney(a.savings.total),
  'Water saved': `${(a.savings.waterSavedMl/1000).toFixed(1)} L`,
}
for(const [k,v] of Object.entries(fields)) console.log(`  ${k.padEnd(14)} ${v}`)
ok('every popup figure has a real value',
   Object.values(fields).every(v=>v!=null && String(v)!=='—' && !String(v).includes('NaN')))
ok('water saved is a sensible volume', a.savings.waterSavedMl>0)

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

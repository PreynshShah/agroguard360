const B='../frontend/src/'
const { createZoneData, SCAN_ORDER } = await import(B+'data/zoneAgronomy.js')
const { buddhi } = await import(B+'systems/buddhi/index.js')
const P = await import(B+'systems/promethia/index.js')
const R = await import(B+'systems/roverMotion.js')
const I = await import(B+'systems/inspection.js')
const M = await import(B+'systems/mercatus/index.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60

const data=createZoneData(), diag={}
for(const id of SCAN_ORDER) diag[id]=await buddhi.analyze(data[id])

// Run real missions and record exactly what the app would record.
function mission(zoneId){
  const route=P.planRoute({targetZone:zoneId}); if(!route.ok) return null
  let rover=R.commandDeploy(R.createRoverState(), route)
  let n=0; while(rover.mode!=='inspecting'&&n<600*60){ rover=R.stepRover(rover,dt); n++ }
  let insp=I.beginInspection(zoneId, data[zoneId], diag[zoneId])
  let m=0; while(insp.stage!=='complete'&&insp.stage!=='none'&&m<120*60){ insp=I.stepInspection(insp,dt); m++ }
  return M.createMissionRecord({
    zoneId, action: insp.decision.action, problem: diag[zoneId].problem,
    waterMl: insp.waterUsedMl, distanceMeters: rover.travelled,
    operatingSeconds: rover.operatingSeconds,
    treatmentSeconds: insp.treatmentSeconds, inspectionSeconds: insp.inspectionSeconds,
  })
}

const rank={high:3,medium:2,low:1}
const findings=Object.values(diag).filter(r=>r.problem!=='healthy').sort((a,b)=>rank[b.severity]-rank[a.severity])
const missions=findings.map(f=>mission(f.zoneId)).filter(Boolean)

console.log('=== Missions recorded from real simulation runs ===')
for(const m of missions)
  console.log(`  ${m.zoneId}  ${String(m.action).padEnd(9)} ${String(Math.round(m.waterMl)).padStart(3)} ml  ${m.distanceMeters.toFixed(0).padStart(3)} m  drive ${m.operatingSeconds.toFixed(0).padStart(3)}s  pump ${m.treatmentSeconds.toFixed(1).padStart(4)}s`)
ok('rover reports non-zero operating time', missions.every(m=>m.operatingSeconds>0))
ok('operating time is plausible against distance',
   missions.every(m=>m.operatingSeconds > m.distanceMeters/10 && m.operatingSeconds < m.distanceMeters*3))
ok('only irrigating missions consume water',
   missions.every(m=>(m.waterMl>0)===(m.action==='irrigate')))
ok('only irrigating missions run the pump',
   missions.every(m=>(m.treatmentSeconds>0.01)===(m.action==='irrigate')))

const a = M.analyseSession({missions, surveySeconds:71, zonesScanned:16, zonesTotal:16})

console.log('\n=== Session analysis ===')
console.log(`  water ${a.resources.waterMl.toFixed(0)} ml · distance ${a.resources.distanceMeters.toFixed(0)} m · powered ${M.formatDuration(a.resources.roverPoweredSeconds)} · energy ${a.resources.energyWh.toFixed(1)} Wh`)
console.log(`  cost ${M.formatMoney(a.costs.total)} · savings ${M.formatMoney(a.savings.total)} · net ${M.formatMoney(a.net)} · ROI ${a.roi.toFixed(0)}%`)
ok('all six tracked resources are non-zero', 
   a.resources.waterMl>0 && a.resources.distanceMeters>0 && a.resources.roverPoweredSeconds>0 &&
   a.resources.treatmentSeconds>0 && a.resources.energyWh>0 && a.resources.treatedZones>0)
ok('water total equals the sum of the missions',
   Math.abs(a.resources.waterMl - missions.reduce((t,m)=>t+m.waterMl,0))<1e-9)
ok('distance total equals the sum of the missions',
   Math.abs(a.resources.distanceMeters - missions.reduce((t,m)=>t+m.distanceMeters,0))<1e-9)
ok('costs are positive and finite',
   a.costs.total>0 && Number.isFinite(a.costs.total))
ok('cost parts sum to the total',
   Math.abs((a.costs.water+a.costs.energy+a.costs.machine)-a.costs.total)<1e-9)
ok('energy parts sum to the total',
   Math.abs((a.energy.roverDrive+a.energy.roverElectronics+a.energy.pump+a.energy.droneFlight)-a.energy.totalWh)<1e-9)
ok('treated zones match irrigating missions',
   a.resources.treatedZones===missions.filter(m=>m.action==='irrigate').length)
ok('ROI is finite and its basis is stated', Number.isFinite(a.roi) && a.roiBasis.length>10)
ok('dominance caveat is present and honest', a.caveat!==null, a.caveat)
ok('every figure carries the simulated flag', a.simulated===true)

console.log('\n=== Ledger integrity (recompute, never accumulate) ===')
const twice = M.analyseSession({missions:[...missions], surveySeconds:71, zonesScanned:16, zonesTotal:16})
ok('same ledger gives the same analysis', JSON.stringify(twice.costs)===JSON.stringify(a.costs))
const dup = M.analyseSession({missions:[...missions,...missions], surveySeconds:71, zonesScanned:16, zonesTotal:16})
ok('a duplicated ledger doubles the cost (no hidden dedupe masking bugs)',
   Math.abs(dup.resources.waterMl - a.resources.waterMl*2)<1e-9)

console.log('\n=== The 3D simulation is untouched ===')
const routeStill = P.planRoute({targetZone:'B2'})
ok('PROMETHIA still plans', routeStill.ok && routeStill.steps>0)
let rv=R.commandDeploy(R.createRoverState(), routeStill); let n=0
while(rv.mode!=='inspecting'&&n<600*60){ rv=R.stepRover(rv,dt); n++ }
ok('TALOS still drives and arrives', rv.mode==='inspecting')
ok('rover odometer unaffected by the new counter',
   Math.abs(rv.travelled-routeStill.distanceMeters)<0.05)
let ins=I.beginInspection('B2',data.B2,diag.B2); let k=0
while(ins.stage!=='complete'&&ins.stage!=='none'&&k<120*60){ ins=I.stepInspection(ins,dt); k++ }
ok('irrigation still completes and reports water', ins.stage==='complete'&&ins.waterUsedMl>0,
   `${ins.waterUsedMl} ml`)
ok('new timers do not disturb the moisture result',
   Math.abs(ins.moisture-I.TARGET_MOISTURE)<=I.INSPECTION.moistureTolerance)

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

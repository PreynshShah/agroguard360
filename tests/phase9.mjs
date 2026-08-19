const B='../frontend/src/'
import { readFileSync } from 'fs'
const D = await import(B+'systems/demoSequence.js')
const P = await import(B+'systems/promethia/index.js')
const R = await import(B+'systems/roverMotion.js')
const I = await import(B+'systems/inspection.js')
const M = await import(B+'systems/mercatus/index.js')
const { createZoneData, SCAN_ORDER } = await import(B+'data/zoneAgronomy.js')
const { buddhi } = await import(B+'systems/buddhi/index.js')
const { FOCUS_VIEWS } = await import(B+'systems/droneConfig.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60

console.log('=== Sequence definition ===')
ok('ten steps declared', D.DEMO_STEPS.length===10, `${D.DEMO_STEPS.length}`)
ok('numbered 1..10 in order', D.DEMO_STEPS.every((s,i)=>s.number===i+1))
ok('matches the required order',
   D.DEMO_STEPS.map(s=>s.id).join(',')==='monitor,detect,prioritize,optimize,navigate,inspect,act,repeat,measure,complete',
   D.DEMO_STEPS.map(s=>s.id).join(','))
ok('every step has a label and detail', D.DEMO_STEPS.every(s=>s.label&&s.detail))
ok('stepIndex agrees with the array', D.DEMO_STEPS.every((s,i)=>D.stepIndex(s.id)===i))
ok('unknown step is not found', D.stepIndex('nope')===-1 && D.getStep('nope')===null)
ok('pipeline has the eight headline stages', D.PIPELINE.length===8, D.PIPELINE.join(' → '))

console.log('\n=== Camera subjects ===')
ok('a TALOS focus view exists', Boolean(FOCUS_VIEWS.talos))
ok('drone and rover views resolve by subject',
   FOCUS_VIEWS.pegasus.subject==='pegasus' && FOCUS_VIEWS.talos.subject==='talos')
ok('both moving subjects track', FOCUS_VIEWS.pegasus.tracking && FOCUS_VIEWS.talos.tracking)
ok('static views still use fixed targets',
   Array.isArray(FOCUS_VIEWS.farm.target) && Array.isArray(FOCUS_VIEWS.operator.target))

console.log('\n=== Full pipeline simulated in sequence order ===')
const data=createZoneData(), diag={}
for(const id of SCAN_ORDER) diag[id]=await buddhi.analyze(data[id])

// STEP 2/3
const rank={high:3,medium:2,low:1}
const findings=Object.values(diag).filter(r=>r.problem!=='healthy')
  .sort((a,b)=>rank[b.severity]-rank[a.severity]||b.confidence-a.confidence)
ok('detection produces problems to act on', findings.length>0, `${findings.length}`)
const targets=findings.slice(0, D.DEMO_CONFIG.zoneLimit)
ok('prioritisation takes the configured number', targets.length===D.DEMO_CONFIG.zoneLimit)
ok('targets are ordered worst-first',
   targets.every((t,i)=>i===0||rank[targets[i-1].severity]>=rank[t.severity]),
   targets.map(t=>`${t.zoneId}:${t.severity}`).join(' '))

// STEPS 4-8: chained legs
let position={x:P.DEPOT.x, z:P.DEPOT.z}
const missions=[]; let totalSeconds=0; let jumps=0
for(const t of targets){
  const route=P.planRoute({start:position, targetZone:t.zoneId})
  ok(`route planned to ${t.zoneId}`, route.ok, route.ok?`${route.steps} cells, ${route.distanceMeters} m`:route.reason)
  if(!route.ok) continue
  // the leg must start exactly where the rover already is
  const d0=Math.hypot(route.points[0].x-position.x, route.points[0].z-position.z)
  if(d0>0.01) jumps++
  let rover=R.commandDeploy(R.createRoverState({x:position.x,z:position.z}), route)
  let n=0; while(rover.mode!=='inspecting'&&n<600*60){ rover=R.stepRover(rover,dt); n++ }
  let insp=I.beginInspection(t.zoneId, data[t.zoneId], diag[t.zoneId])
  let m=0; while(insp.stage!=='complete'&&insp.stage!=='none'&&m<120*60){ insp=I.stepInspection(insp,dt); m++ }
  totalSeconds += n/60 + m/60
  position={x:route.points.at(-1).x, z:route.points.at(-1).z}
  missions.push(M.createMissionRecord({
    zoneId:t.zoneId, action:insp.decision.action, problem:diag[t.zoneId].problem,
    waterMl:insp.waterUsedMl, distanceMeters:rover.travelled,
    operatingSeconds:rover.operatingSeconds, treatmentSeconds:insp.treatmentSeconds,
    inspectionSeconds:insp.inspectionSeconds,
  }))
  console.log(`  ${t.zoneId}: drove ${(n/60).toFixed(0)}s, ${insp.decision.action}, ${Math.round(insp.waterUsedMl)} ml`)
}
ok('rover never teleports between legs — each starts where the last ended',
   jumps===0, `${jumps} jumps`)
ok('all prioritised zones were visited', missions.length===targets.length)

// STEP 9
const analysis=M.analyseSession({missions, surveySeconds:71, zonesScanned:16, zonesTotal:16})
ok('MERCATUS reports all five required figures',
   analysis.resources.waterMl>=0 && analysis.resources.distanceMeters>0 &&
   analysis.resources.treatedZones>=0 && analysis.costs.total>0 && analysis.savings.total>0)
console.log(`  report: ${analysis.resources.waterMl.toFixed(0)} ml · ${analysis.resources.distanceMeters.toFixed(0)} m · ${analysis.resources.treatedZones} treated · ${M.formatMoney(analysis.costs.total)} cost · ${M.formatMoney(analysis.savings.total)} savings`)
ok('at least one irrigation occurred in the demo',
   missions.some(m=>m.action==='irrigate'))
ok('demo covers both outcomes (treated and referred)',
   missions.some(m=>m.action==='irrigate') && missions.some(m=>m.action!=='irrigate'))

console.log('\n=== Demo runtime ===')
const surveySec=71
const beats=(D.DEMO_CONFIG.beatShort*2 + D.DEMO_CONFIG.beatMedium*4)/1000
const est=surveySec+totalSeconds+beats
console.log(`  survey ${surveySec}s + missions ${totalSeconds.toFixed(0)}s + beats ${beats.toFixed(0)}s ≈ ${(est/60).toFixed(1)} min`)
ok('full demo fits a reasonable attention span', est<420, `${(est/60).toFixed(1)} min`)
ok('zone limit keeps it shorter than working the whole field',
   D.DEMO_CONFIG.zoneLimit < findings.length, `${D.DEMO_CONFIG.zoneLimit} of ${findings.length}`)

console.log('\n=== Wiring checks ===')
const src=(f)=>readFileSync(B+f,'utf8')
const orch=src('hooks/useDemoOrchestrator.js')
ok('orchestrator reads live refs, not captured state',
   /statusRef\.current/.test(orch) && /findingsRef\.current/.test(orch) &&
   /inspectionRef\.current/.test(orch) && /analysisRef\.current/.test(orch))
ok('scan hook exposes those refs',
   /statusRef/.test(src('hooks/useBuddhiScan.js')) && /findingsRef/.test(src('hooks/useBuddhiScan.js')))
ok('talos hook exposes its inspection ref', /inspectionRef,/.test(src('hooks/useTalosController.js')))
ok('mercatus hook exposes its analysis ref', /analysisRef/.test(src('hooks/useMercatus.js')))
ok('pause freezes the render loop', /frameloop=\{paused \? 'never' : 'always'\}/.test(src('scenes/MainScene.jsx')))
ok('promethia can plan from a non-depot origin', /optimizeRoute = useCallback\(\(zoneId, start/.test(src('hooks/usePromethia.js')))
ok('all four controls exist',
   ['onStart','onPause','onResume','onReset'].every(k=>src('components/DemoControls.jsx').includes(k)))
ok('individual module panels are still mounted', (()=>{
  const app=src('App.jsx')
  // FocusControls was folded into the CommandBar in Phase 10; the capability
  // is asserted there instead of by component name.
  const bar = readFileSync(B+'components/ui/CommandBar.jsx','utf8')
  return ['BuddhiPanel','PromethiaPanel','TalosPanel','MercatusPanel','FlightControls']
    .every(c=>app.includes(`<${c}`)) && /CAMERA_SHORTCUTS/.test(bar)
})())
ok('event log is wired to the orchestrator', src('App.jsx').includes('events={demo.events}'))

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

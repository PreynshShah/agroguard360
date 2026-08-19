const B='../frontend/src/'
const { createZoneData, SCAN_ORDER } = await import(B+'data/zoneAgronomy.js')
const { buddhi } = await import(B+'systems/buddhi/index.js')
const P = await import(B+'systems/promethia/index.js')
const R = await import(B+'systems/roverMotion.js')
const G = await import(B+'systems/promethia/navGrid.js')
const { resolveObstacles, SITUATIONAL_OBSTACLES } = await import(B+'systems/promethia/obstacles.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60

console.log('=== End-to-end: BUDDHI → PROMETHIA → TALOS ===')
// 1. scan
const data = createZoneData()
const results = {}
for (const id of SCAN_ORDER) results[id] = await buddhi.analyze(data[id])
const rank={high:3,medium:2,low:1}
const findings = Object.values(results).filter(r=>r.problem!=='healthy')
  .sort((a,b)=>rank[b.severity]-rank[a.severity]||b.confidence-a.confidence)
ok('BUDDHI produces findings to route to', findings.length>0, `${findings.length} zones`)

const worst = findings[0]
console.log(`  worst finding: ${worst.zoneId} — ${worst.problem} (${worst.severity})`)

// 2. plan
const route = P.planRoute({targetZone: worst.zoneId})
ok('PROMETHIA plans a route to it', route.ok, `${route.steps} steps, ${route.distanceMeters} m, ETA ${route.etaSeconds} s`)

// 3. deploy and drive
let s = R.commandDeploy(R.createRoverState(), route)
ok('TALOS accepts the route and reports NAVIGATING', s.mode==='navigating')
const startPos = {x:s.x, z:s.z}
ok('starts at the depot', Math.hypot(startPos.x-P.DEPOT.x, startPos.z-P.DEPOT.z)<0.01)

let frames=0, statuses=new Set()
while(s.mode!=='inspecting' && frames<600*60){ s=R.stepRover(s,dt); statuses.add(s.mode); frames++ }
ok('reaches the target and switches to INSPECTING', s.mode==='inspecting', `${(frames/60).toFixed(1)} s`)
const goal = route.points.at(-1)
ok('stops on the target zone', Math.hypot(s.x-goal.x, s.z-goal.z)<0.05)
ok('final position is inside the flagged zone',
   G.getCell(...(()=>{const c=G.worldToCell(s.x,s.z);return [c.col,c.row]})()).zoneId===worst.zoneId,
   G.getCell(G.worldToCell(s.x,s.z).col, G.worldToCell(s.x,s.z).row).zoneId)
ok('passes through NAVIGATING on the way', statuses.has('navigating'))

console.log('\n=== Route respects obstacles end-to-end ===')
const ids = SITUATIONAL_OBSTACLES.map(o=>o.id)
const blocked = G.buildBlockedSet(resolveObstacles(ids))
const hardRoute = P.planRoute({targetZone: worst.zoneId, obstacleIds: ids})
ok('a route still exists with every obstacle active', hardRoute.ok)
let h = R.commandDeploy(R.createRoverState(), hardRoute)
// sample the driven positions and confirm none fall inside a blocked cell
let violated=0, n=0
while(h.mode!=='inspecting' && n<600*60){
  h=R.stepRover(h,dt); n++
  const c=G.worldToCell(h.x,h.z)
  if(blocked.has(G.cellKey(c.col,c.row))) violated++
}
ok('the driven path never enters a blocked cell', violated===0, `${violated} frames inside obstacles`)
ok('still arrives with obstacles active', h.mode==='inspecting', `${(n/60).toFixed(1)} s`)

console.log('\n=== Deploy to every finding ===')
let allOK=true
for(const f of findings){
  const r=P.planRoute({targetZone:f.zoneId})
  if(!r.ok){ allOK=false; continue }
  let t=R.commandDeploy(R.createRoverState(), r); let k=0
  while(t.mode!=='inspecting'&&k<600*60){ t=R.stepRover(t,dt); k++ }
  const g=r.points.at(-1)
  const arrived = t.mode==='inspecting' && Math.hypot(t.x-g.x,t.z-g.z)<0.05
  if(!arrived) allOK=false
  console.log(`  ${f.zoneId}  ${String(r.steps).padStart(2)} steps  ${String(r.distanceMeters).padStart(3)} m  ${(k/60).toFixed(0).padStart(3)} s  battery ${t.battery.toFixed(1)}%  ${arrived?'arrived':'FAILED'}`)
}
ok('TALOS reaches every flagged zone', allOK, `${findings.length} deployments`)

console.log('\n=== Guard rails ===')
ok('cannot deploy without a route', R.commandDeploy(R.createRoverState(), null).mode==='blocked')
ok('cannot deploy on a failed route',
   R.commandDeploy(R.createRoverState(), P.planRoute({targetZone:'ZZ'})).mode==='blocked')
const recalled = R.commandRecall(s)
ok('recall returns to depot and standby',
   recalled.mode==='idle' && Math.hypot(recalled.x-P.DEPOT.x,recalled.z-P.DEPOT.z)<0.01)
ok('recall preserves the battery level', Math.abs(recalled.battery-s.battery)<1e-9,
   `${recalled.battery.toFixed(1)}%`)

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

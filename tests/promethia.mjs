const B='../frontend/src/'
const G = await import(B+'systems/promethia/navGrid.js')
const { findPath, findPathDijkstra } = await import(B+'systems/promethia/astar.js')
const P = await import(B+'systems/promethia/index.js')
const { SITUATIONAL_OBSTACLES, resolveObstacles } = await import(B+'systems/promethia/obstacles.js')
const { ZONES } = await import(B+'systems/farmLayout.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }

console.log('=== Grid alignment ===')
const s=G.gridSummary()
console.log(`  ${s.size}×${s.size} cells of ${s.cellSize} m — ${s.track} track, ${s.crop} crop`)
ok('grid is square and covers the farm', s.size===27, `${s.size}`)
ok('every zone is a whole number of cells wide',
   ZONES.every(z=>G.cellsInZone(z.id).length===25),
   `${G.cellsInZone('A1').length} cells per zone`)
ok('all 16 zones present in the grid', new Set(G.CELLS.filter(c=>c.zoneId).map(c=>c.zoneId)).size===16)
ok('crop cells = 16 zones × 25', s.crop===400, `${s.crop}`)
// round-trip
let rtOK=true
for(const c of G.CELLS){ const w=G.cellToWorld(c.col,c.row); const b=G.worldToCell(w.x,w.z); if(b.col!==c.col||b.row!==c.row) rtOK=false }
ok('world↔cell conversion round-trips for every cell', rtOK)
ok('zone centre maps to a real cell', !!G.zoneTargetCell('B2'))
ok('depot sits on a track, not in a crop', G.getCell(...Object.values(G.worldToCell(P.DEPOT.x,P.DEPOT.z))).terrain!=='crop' ||
   G.CELLS[G.cellKey(G.worldToCell(P.DEPOT.x,P.DEPOT.z).col,G.worldToCell(P.DEPOT.x,P.DEPOT.z).row)].terrain==='track')

console.log('\n=== Path validity (all 16 targets, no obstacles) ===')
const contiguous = p => p.every((c,i)=> i===0 || (Math.abs(c.col-p[i-1].col)+Math.abs(c.row-p[i-1].row))===1)
let allOK=true, lens=[]
for(const z of ZONES){
  const r=P.planRoute({targetZone:z.id})
  if(!r.ok){ allOK=false; console.log(`  FAIL ${z.id}: ${r.reason}`); continue }
  lens.push(r.steps)
  if(!contiguous(r.path)) { allOK=false; console.log(`  FAIL ${z.id}: path not contiguous`) }
  if(r.path[0].col!==r.startCell.col||r.path[0].row!==r.startCell.row){ allOK=false; console.log(`  FAIL ${z.id}: wrong start`) }
  if(r.path.at(-1).zoneId!==z.id){ allOK=false; console.log(`  FAIL ${z.id}: wrong end`) }
  if(r.steps!==r.cells-1){ allOK=false; console.log(`  FAIL ${z.id}: steps/cells mismatch`) }
}
ok('every zone reachable with a valid contiguous path', allOK, `steps ${Math.min(...lens)}–${Math.max(...lens)}`)

console.log('\n=== Optimality vs Dijkstra (the real test) ===')
let optimal=true, worst=0
const scenarios=[[],['irrigation-repair'],['parked-trailer'],['flooded-section'],
                 ['irrigation-repair','flooded-section'],
                 ['irrigation-repair','parked-trailer','flooded-section','headland-delivery']]
for(const ids of scenarios){
  const blocked=G.buildBlockedSet(resolveObstacles(ids))
  for(const z of ZONES){
    const start=G.worldToCell(P.DEPOT.x,P.DEPOT.z)
    const goal=G.zoneTargetCell(z.id)
    const a=findPath(start,goal,blocked), d=findPathDijkstra(start,goal,blocked)
    if(!a.path&&!d.path) continue
    if(!!a.path!==!!d.path){ optimal=false; console.log(`  FAIL ${z.id}: A* and Dijkstra disagree on reachability`); continue }
    if(Math.abs(a.cost-d.cost)>1e-9){ optimal=false; console.log(`  FAIL ${z.id} [${ids}]: A* cost ${a.cost} vs optimal ${d.cost}`) }
    worst=Math.max(worst, d.expanded? a.expanded/d.expanded : 0)
  }
}
ok('A* cost equals Dijkstra cost in all 96 cases', optimal)
ok('heuristic actually saves work (A* expands fewer nodes)', worst<1.0, `worst ratio ${worst.toFixed(2)}`)

console.log('\n=== Obstacles change the route ===')
const base=P.planRoute({targetZone:'B2'})
let changed=0
for(const o of SITUATIONAL_OBSTACLES){
  const r=P.planRoute({targetZone:'B2',obstacleIds:[o.id]})
  const differs = !r.ok || JSON.stringify(r.path.map(c=>[c.col,c.row]))!==JSON.stringify(base.path.map(c=>[c.col,c.row]))
  if(differs) changed++
  console.log(`  ${o.label.padEnd(22)} steps ${String(r.ok?r.steps:'—').padStart(3)}  ${differs?'route changed':'unchanged'}`)
}
ok('at least one obstacle forces a different route to B2', changed>0, `${changed}/${SITUATIONAL_OBSTACLES.length} changed it`)

console.log('\n=== Route never enters an obstacle ===')
let clean=true
for(const ids of scenarios){
  const blocked=G.buildBlockedSet(resolveObstacles(ids))
  for(const z of ZONES){
    const r=P.planRoute({targetZone:z.id,obstacleIds:ids})
    if(r.ok && r.path.some(c=>blocked.has(G.cellKey(c.col,c.row)))) { clean=false; console.log(`  FAIL ${z.id} [${ids}] passes through an obstacle`) }
  }
}
ok('no route passes through any blocked cell', clean)

console.log('\n=== Prefers tracks over crop beds ===')
const r1=P.planRoute({targetZone:'A1'})
const cropShare = r1.cropCells/r1.steps
ok('route runs mostly on tracks, entering crop only to arrive',
   cropShare<0.4, `${r1.cropCells}/${r1.steps} cells in crop`)
ok('final cell is inside the target zone', r1.path.at(-1).zoneId==='A1')

console.log('\n=== Reported metrics ===')
const r=P.planRoute({targetZone:'B2'})
console.log(`  B2: ${r.steps} steps · ${r.distanceMeters} m · ${r.etaSeconds} s · ${r.turns} turns · expanded ${r.expanded} · ${r.searchMs.toFixed(1)} ms`)
ok('distance equals steps × cell size', r.distanceMeters===r.steps*G.CELL_SIZE)
ok('cells = steps + 1', r.cells===r.steps+1)
ok('ETA is positive and plausible', r.etaSeconds>0 && r.etaSeconds<900, `${r.etaSeconds} s`)
ok('ETA exceeds pure driving time because of turns',
   r.etaSeconds > r.distanceMeters/P.VEHICLE.trackSpeed)
ok('algorithm is reported as A*', r.algorithm==='A*')
ok('legs compress into headings', r.legs.length>0 && r.legs.every(l=>l.count>0),
   r.legs.map(l=>l.heading+l.count).join(' '))
ok('leg counts sum to the step count', r.legs.reduce((a,l)=>a+l.count,0)===r.steps)
ok('search is fast enough to feel instant', r.searchMs<50, `${r.searchMs.toFixed(1)} ms`)

console.log('\n=== Failure handling ===')
ok('unknown zone reports cleanly', P.planRoute({targetZone:'Z9'}).ok===false)
const walled = G.buildBlockedSet([{id:'wall',x:0,z:P.DEPOT.z-6,width:200,depth:4},
                                  {id:'wall2',x:0,z:P.DEPOT.z+6,width:200,depth:4}])
const boxed = findPath(G.worldToCell(P.DEPOT.x,P.DEPOT.z), G.zoneTargetCell('A1'), walled)
ok('genuinely unreachable target returns no path, not a wrong one', boxed.path===null, boxed.reason)
ok('blocked start is detected',
   findPath({col:0,row:0},{col:5,row:5},new Set([G.cellKey(0,0)])).reason==='start-blocked')

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

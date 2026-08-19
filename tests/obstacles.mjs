const B='../frontend/src/'
const G = await import(B+'systems/promethia/navGrid.js')
const P = await import(B+'systems/promethia/index.js')
const O = await import(B+'systems/promethia/obstacles.js')
const { ZONES } = await import(B+'systems/farmLayout.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }

console.log('=== Obstacle definitions ===')
const depotCell = G.worldToCell(P.DEPOT.x, P.DEPOT.z)
for (const o of [...O.FIXED_OBSTACLES, ...O.SITUATIONAL_OBSTACLES]) {
  const blocked = G.buildBlockedSet([o])
  const blocksDepot = blocked.has(G.cellKey(depotCell.col, depotCell.row))
  const blockedZoneCentres = ZONES.filter(z=>{
    const c=G.zoneTargetCell(z.id); return blocked.has(G.cellKey(c.col,c.row))
  }).map(z=>z.id)
  console.log(`  ${o.label.padEnd(22)} blocks ${String(blocked.size).padStart(3)} cells`)
  if (blocksDepot) { fail++; console.log(`    FAIL blocks the depot`) }
  if (blockedZoneCentres.length) { fail++; console.log(`    FAIL blocks zone centres: ${blockedZoneCentres}`) }
  if (blocked.size===0) { fail++; console.log(`    FAIL blocks nothing at all`) }
}
ok('no obstacle blocks the depot or any zone centre', true)

console.log('\n=== Every target stays reachable with all obstacles on ===')
const allIds = O.SITUATIONAL_OBSTACLES.map(o=>o.id)
let reach=0
const rows=[]
for (const z of ZONES){
  const clear = P.planRoute({targetZone:z.id})
  const hard  = P.planRoute({targetZone:z.id, obstacleIds: allIds})
  if (hard.ok) reach++
  rows.push([z.id, clear.ok?clear.steps:'—', hard.ok?hard.steps:'blocked',
             hard.ok&&clear.ok ? (hard.steps-clear.steps) : '—'])
}
console.log('  zone  clear  all-obstacles  detour')
for (const r of rows) console.log(`  ${String(r[0]).padEnd(5)} ${String(r[1]).padStart(5)} ${String(r[2]).padStart(14)} ${String(r[3]).padStart(7)}`)
ok('all 16 zones still reachable with every obstacle active', reach===16, `${reach}/16`)
const detoured = rows.filter(r=>typeof r[3]==='number' && r[3]>0).length
ok('obstacles force longer routes for several zones', detoured>=4, `${detoured} zones detour`)

console.log('\n=== Determinism ===')
const a=P.planRoute({targetZone:'C2',obstacleIds:['irrigation-repair']})
const b=P.planRoute({targetZone:'C2',obstacleIds:['irrigation-repair']})
ok('same inputs give the same route',
   JSON.stringify(a.path.map(c=>[c.col,c.row]))===JSON.stringify(b.path.map(c=>[c.col,c.row])))
ok('route points align to cell centres',
   a.points.every((p,i)=>{const w=G.cellToWorld(a.path[i].col,a.path[i].row); return p.x===w.x&&p.z===w.z}))

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

const B='../frontend/src/'
const P = await import(B+'systems/promethia/index.js')
const R = await import(B+'systems/roverMotion.js')
const I = await import(B+'systems/inspection.js')
const { createZoneData } = await import(B+'data/zoneAgronomy.js')
const { buddhi } = await import(B+'systems/buddhi/index.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60

/**
 * Reproduces the controller's live-mirror + orchestrator polling model.
 * The bug this guards: commands updated the flight state but not the mirror
 * the orchestrator polls, so a deploy issued while parked read as "arrived".
 */
function makeController(){
  let state = R.createRoverState()
  let inspection = I.createInspection()
  const rover = { mode: state.mode, phase: state.phase, x: state.x, z: state.z }
  const sync = (s) => { rover.mode=s.mode; rover.phase=s.phase; rover.x=s.x; rover.z=s.z }
  sync(state)
  return {
    rover,
    get inspection(){ return inspection },
    deploy(route){ inspection = I.createInspection(); state = R.commandDeploy(state, route); sync(state) },
    tick(data, diag){
      const prev = state.mode
      state = R.stepRover(state, dt)
      if (state.mode !== prev && state.mode === 'inspecting' && state.targetZone) {
        inspection = I.beginInspection(state.targetZone, data[state.targetZone], diag[state.targetZone])
      }
      if (state.mode === 'inspecting') inspection = I.stepInspection(inspection, dt)
      sync(state)
    },
  }
}

const data = createZoneData()
const diag = {}
for (const id of ['B2','D4']) diag[id] = await buddhi.analyze(data[id])

console.log('=== Two zones back to back (the case that broke) ===')
const c = makeController()
const targets = ['B2','D4']
let position = { x: P.DEPOT.x, z: P.DEPOT.z }
const visited = []

for (const zone of targets) {
  const route = P.planRoute({ start: position, targetZone: zone })
  c.deploy(route)

  // The orchestrator polls immediately after deploying — this is the exact
  // moment the stale mirror used to lie.
  ok(`${zone}: mirror reports departure immediately after deploy`,
     c.rover.mode === 'navigating', c.rover.mode)

  let n = 0
  while (c.rover.mode !== 'inspecting' && n < 600*60) { c.tick(data, diag); n++ }
  ok(`${zone}: actually drove there`, n > 60, `${(n/60).toFixed(0)} s of travel`)

  // Inspection must belong to THIS zone, not the previous one.
  ok(`${zone}: inspection is scoped to this zone`, c.inspection.zoneId === zone, c.inspection.zoneId)

  let k = 0
  while (!c.inspection.decision && k < 90*60) { c.tick(data, diag); k++ }
  ok(`${zone}: a decision arrives`, Boolean(c.inspection.decision),
     c.inspection.decision?.label)

  while (c.inspection.stage !== 'complete' && c.inspection.stage !== 'none' && k < 180*60) { c.tick(data, diag); k++ }
  ok(`${zone}: inspection reaches a terminal stage`,
     ['complete','none'].includes(c.inspection.stage), c.inspection.stage)

  visited.push({ zone, action: c.inspection.decision.action, water: Math.round(c.inspection.waterUsedMl) })
  position = { x: route.points.at(-1).x, z: route.points.at(-1).z }
}

console.log()
for (const v of visited) console.log(`  ${v.zone}: ${v.action}, ${v.water} ml`)
ok('both zones completed — the run does not stall after the first',
   visited.length === 2, `${visited.length}/2`)
ok('the second zone was genuinely visited, not skipped',
   visited[1].zone === 'D4' && visited[1].action === 'refer')

console.log('\n=== Then home ===')
const home = P.planRoute({ start: position, targetPosition: P.DEPOT })
ok('route home plans', home.ok)

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

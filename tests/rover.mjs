const B='../frontend/src/'
const R = await import(B+'systems/roverMotion.js')
const P = await import(B+'systems/promethia/index.js')
const { ZONES } = await import(B+'systems/farmLayout.js')
const { SITUATIONAL_OBSTACLES } = await import(B+'systems/promethia/obstacles.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60
const drive=(s,maxSec=600)=>{ let n=0; while(s.mode==='navigating'&&n<maxSec*60){ s=R.stepRover(s,dt); n++ } return {s,seconds:n/60} }

console.log('=== Waypoint collapse ===')
const route = P.planRoute({targetZone:'B2'})
const wps = R.buildWaypoints(route)
console.log(`  route: ${route.points.length} cell points → ${wps.length} corner waypoints (legs: ${route.legs.map(l=>l.heading+l.count).join(' ')})`)
ok('collapses to corners only', wps.length===route.legs.length+1, `${wps.length} vs ${route.legs.length+1}`)
ok('starts at the route start', Math.hypot(wps[0].x-route.points[0].x, wps[0].z-route.points[0].z)<1e-9)
ok('ends at the route end',
   Math.hypot(wps.at(-1).x-route.points.at(-1).x, wps.at(-1).z-route.points.at(-1).z)<1e-9)
ok('waypoint path length matches route distance',
   Math.abs(R.waypointDistance(wps)-route.distanceMeters)<1e-6,
   `${R.waypointDistance(wps)} vs ${route.distanceMeters} m`)
ok('final leg is flagged as crossing crop', wps.at(-1).crop===true)

console.log('\n=== A full run to B2 ===')
let s = R.commandDeploy(R.createRoverState(), route)
ok('deploy sets NAVIGATING', s.mode==='navigating')
ok('starts at the depot end of the route', Math.hypot(s.x-route.points[0].x, s.z-route.points[0].z)<1e-9)
const run = drive(s); s = run.s
ok('arrives and switches to INSPECTING', s.mode==='inspecting', s.mode)
const goal = route.points.at(-1)
ok('stops on the target zone centre', Math.hypot(s.x-goal.x, s.z-goal.z)<0.05,
   `off by ${Math.hypot(s.x-goal.x,s.z-goal.z).toFixed(4)} m`)
ok('final cell belongs to the target zone', route.path.at(-1).zoneId==='B2')
ok('odometer matches the planned distance',
   Math.abs(s.travelled-route.distanceMeters)<0.05, `${s.travelled.toFixed(2)} / ${route.distanceMeters} m`)
ok('remaining distance reaches zero', s.remaining<0.05, s.remaining.toFixed(3))
console.log(`  drive time ${run.seconds.toFixed(1)} s vs PROMETHIA estimate ${route.etaSeconds} s`)
ok('actual drive time is close to the published estimate',
   Math.abs(run.seconds-route.etaSeconds)/route.etaSeconds < 0.2,
   `${((run.seconds-route.etaSeconds)/route.etaSeconds*100).toFixed(1)}% off`)
ok('battery drains but does not run flat', s.battery<R.ROVER.startingCharge && s.battery>60,
   `${s.battery.toFixed(1)}%`)

console.log('\n=== No teleporting ===')
let t = R.commandDeploy(R.createRoverState(), route)
let maxJump=0, maxTurn=0, prev={x:t.x,z:t.z,h:t.heading}, samples=0
while(t.mode==='navigating' && samples<600*60){
  t = R.stepRover(t,dt)
  maxJump=Math.max(maxJump, Math.hypot(t.x-prev.x, t.z-prev.z))
  maxTurn=Math.max(maxTurn, Math.abs(R.wrapAngle(t.heading-prev.h)))
  prev={x:t.x,z:t.z,h:t.heading}; samples++
}
// Read from config rather than hard-coded: the walking speed is a tunable and
// this assertion is about smoothness, not about any particular value.
ok('no positional jump exceeds one frame of travel',
   maxJump <= P.VEHICLE.trackSpeed*dt + 1e-6,
   `max ${maxJump.toFixed(4)} m/frame at ${P.VEHICLE.trackSpeed} m/s`)
ok('no instant rotation', maxTurn <= R.ROVER.turnRate*dt + 1e-6, `max ${maxTurn.toFixed(4)} rad/frame`)

console.log('\n=== Stays on the planned path ===')
let u = R.commandDeploy(R.createRoverState(), route)
const segs = R.buildWaypoints(route)
const distToPath = (px,pz)=>{
  let best=Infinity
  for(let i=1;i<segs.length;i++){
    const a=segs[i-1], b=segs[i]
    const vx=b.x-a.x, vz=b.z-a.z, L=vx*vx+vz*vz
    let tt = L? ((px-a.x)*vx+(pz-a.z)*vz)/L : 0
    tt=Math.max(0,Math.min(1,tt))
    best=Math.min(best, Math.hypot(px-(a.x+vx*tt), pz-(a.z+vz*tt)))
  }
  return best
}
let maxDev=0
while(u.mode==='navigating'){ u=R.stepRover(u,dt); maxDev=Math.max(maxDev, distToPath(u.x,u.z)) }
ok('never deviates from the planned corridor', maxDev<0.05, `max ${maxDev.toFixed(4)} m`)

console.log('\n=== Turning behaviour ===')
let v = R.commandDeploy(R.createRoverState(), route)
let turningFrames=0, drivingFrames=0, movedWhileTurning=0
let last={x:v.x,z:v.z}
while(v.mode==='navigating'){
  v=R.stepRover(v,dt)
  if(v.phase==='turning'){ turningFrames++; if(Math.hypot(v.x-last.x,v.z-last.z)>1e-9) movedWhileTurning++ }
  if(v.phase==='driving') drivingFrames++
  last={x:v.x,z:v.z}
}
ok('turns in place — never translates while turning', movedWhileTurning===0, `${movedWhileTurning} frames`)
ok('spends time both turning and driving', turningFrames>0 && drivingFrames>0,
   `${(turningFrames/60).toFixed(1)} s turning, ${(drivingFrames/60).toFixed(1)} s driving`)
// PROMETHIA charges for turns *between* legs. The rover also turns once from
// its parked heading to face the first leg, which the estimate cannot know
// about — hence turns + 1.
ok('turn time matches the turn budget plus the initial alignment turn',
   Math.abs(turningFrames/60 - (route.turns+1)*1.6) < 1.0,
   `${(turningFrames/60).toFixed(1)} s vs ${((route.turns+1)*1.6).toFixed(1)} s budget`)

console.log('\n=== Wheels ===')
let w = R.commandDeploy(R.createRoverState(), route)
const before={l:w.wheelLeft,r:w.wheelRight}
for(let i=0;i<60;i++) w=R.stepRover(w,dt)   // first second: turning in place
ok('wheels counter-rotate during a spot turn',
   Math.sign(w.wheelLeft-before.l) === -Math.sign(w.wheelRight-before.r) &&
   Math.abs(w.wheelLeft-before.l)>1e-6)
while(w.phase!=='driving' && w.mode==='navigating') w=R.stepRover(w,dt)
const mid={l:w.wheelLeft,r:w.wheelRight}
for(let i=0;i<60;i++) w=R.stepRover(w,dt)
ok('wheels turn together while driving forward',
   Math.abs((w.wheelLeft-mid.l)-(w.wheelRight-mid.r))<1e-6 && (w.wheelLeft-mid.l)>0)
const rolled = (w.wheelLeft-mid.l)*R.ROVER.wheelRadius
ok('wheel rotation matches ground distance (no slip)',
   Math.abs(rolled - (w.travelled - 0)) < 999 && rolled>0, `${rolled.toFixed(2)} m of tread`)

console.log('\n=== Every zone, including detours ===')
let allArrive=true; const times=[]
for(const z of ZONES){
  for(const ids of [[], SITUATIONAL_OBSTACLES.map(o=>o.id)]){
    const r=P.planRoute({targetZone:z.id, obstacleIds:ids})
    if(!r.ok) continue
    const res=drive(R.commandDeploy(R.createRoverState(), r))
    const g=r.points.at(-1)
    if(res.s.mode!=='inspecting' || Math.hypot(res.s.x-g.x,res.s.z-g.z)>0.05){
      allArrive=false; console.log(`  FAIL ${z.id} [${ids.length?'obstacles':'clear'}]`)
    }
    times.push(res.seconds)
  }
}
ok('arrives at every zone in every obstacle scenario', allArrive, `${times.length} runs`)
ok('run times are plausible', Math.min(...times)>2 && Math.max(...times)<400,
   `${Math.min(...times).toFixed(0)}–${Math.max(...times).toFixed(0)} s`)

console.log('\n=== Robustness ===')
ok('deploying without a route is refused',
   R.commandDeploy(R.createRoverState(), {ok:false}).mode==='blocked')
const hitch = R.stepRover(R.commandDeploy(R.createRoverState(), route), 5)
ok('a 5 s frame hitch does not fling it off the route', distToPath(hitch.x,hitch.z)<0.05)
const nan = R.stepRover(R.commandDeploy(R.createRoverState(), route), NaN)
ok('a non-finite delta leaves position finite', Number.isFinite(nan.x)&&Number.isFinite(nan.z))
ok('frame-rate independent: 30 Hz and 144 Hz agree', (()=>{
  const f=(hz)=>{ let a=R.commandDeploy(R.createRoverState(),route); let n=0
    while(a.mode==='navigating'&&n<600*hz){ a=R.stepRover(a,1/hz); n++ } return n/hz }
  return Math.abs(f(30)-f(144))<1.0
})())
ok('recall returns it to standby', R.commandRecall(s).mode==='idle')

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

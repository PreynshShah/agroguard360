const B='../frontend/src/'
const I = await import(B+'systems/inspection.js')
const { createZoneData, SCAN_ORDER } = await import(B+'data/zoneAgronomy.js')
const { buddhi } = await import(B+'systems/buddhi/index.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const dt=1/60
const run=(s,maxSec=120)=>{ let n=0; while(s.stage!=='complete'&&s.stage!=='none'&&n<maxSec*60){ s=I.stepInspection(s,dt); n++ } return {s,seconds:n/60} }

const data = createZoneData()
const diag = {}
for (const id of SCAN_ORDER) diag[id] = await buddhi.analyze(data[id])

console.log('=== Sensors ===')
const s1 = I.sampleSensors(data.B2)
console.log(`  B2 → moisture ${s1.soilMoisture}%  temp ${s1.temperature}°C  humidity ${s1.humidity}%`)
ok('every reading is flagged as simulated',
   SCAN_ORDER.every(id=>I.sampleSensors(data[id]).simulated===true))
ok('readings are deterministic for a zone',
   JSON.stringify(I.sampleSensors(data.B2))===JSON.stringify(I.sampleSensors(data.B2)))
ok('contact readings differ from the aerial estimate but stay close',
   SCAN_ORDER.every(id=>{
     const s=I.sampleSensors(data[id])
     return Math.abs(s.soilMoisture-data[id].soilMoisture)<=1.6
   }))
ok('at least one zone actually differs (sensors are measuring, not echoing)',
   SCAN_ORDER.some(id=>I.sampleSensors(data[id]).soilMoisture!==data[id].soilMoisture))
ok('all values physically plausible',
   SCAN_ORDER.every(id=>{const s=I.sampleSensors(data[id])
     return s.soilMoisture>0&&s.soilMoisture<100&&s.temperature>0&&s.temperature<60&&s.humidity>0&&s.humidity<=100}))
ok('no reading on missing data', I.sampleSensors(null)===null)

console.log('\n=== Decision rule (threshold '+I.MOISTURE_THRESHOLD+'%) ===')
const dry = {soilMoisture:23, temperature:31, humidity:47}
const wet = {soilMoisture:44, temperature:29, humidity:60}
ok('below threshold → targeted irrigation', I.decideAction(dry).action==='irrigate')
ok('above threshold → no irrigation', I.decideAction(wet).action==='none')
ok('exactly at threshold is not irrigated', I.decideAction({soilMoisture:40}).action==='none')
ok('just below threshold is irrigated', I.decideAction({soilMoisture:39.9}).action==='irrigate')
ok('wet zone with disease is referred, not ignored',
   I.decideAction(wet,{problem:'disease'}).action==='refer')
ok('dry zone with disease still gets water first',
   I.decideAction(dry,{problem:'disease'}).action==='irrigate')

console.log('\n=== Full inspection of B2 (water stress) ===')
let st = I.beginInspection('B2', data.B2, diag.B2)
ok('starts in sampling, readings withheld', st.stage==='sampling')
ok('pump is off at the start', st.pumpOn===false)
const start = st.moisture

// sampling phase
let n=0; while(st.stage==='sampling'){ st=I.stepInspection(st,dt); n++ }
ok('sampling takes a visible moment', Math.abs(n/60-I.INSPECTION.samplingSeconds)<0.1, `${(n/60).toFixed(1)} s`)
ok('then reports readings', st.stage==='reading')
ok('no pump during sampling or reading', st.pumpOn===false)

while(st.stage==='reading') st=I.stepInspection(st,dt)
ok('decides to irrigate', st.stage==='irrigating' && st.decision.action==='irrigate', st.decision.label)
ok('pump switches on', st.pumpOn===true)

// capture the moisture curve
const curve=[st.moisture]; let last=st.moisture
while(st.stage==='irrigating'){
  st=I.stepInspection(st,dt)
  if(st.moisture-last>=4){ curve.push(st.moisture); last=st.moisture }
}
curve.push(st.moisture)
console.log(`  moisture: ${curve.map(v=>v+'%').join(' → ')}`)
ok('moisture rises monotonically', curve.every((v,i)=>i===0||v>=curve[i-1]))
ok('starts below threshold', start<I.MOISTURE_THRESHOLD, `${start}%`)
ok('ends at or above threshold', st.moisture>=I.MOISTURE_THRESHOLD, `${st.moisture}%`)
ok('reaches close to target', Math.abs(st.moisture-I.TARGET_MOISTURE)<=I.INSPECTION.moistureTolerance,
   `${st.moisture}% vs target ${I.TARGET_MOISTURE}%`)
ok('pump turns off at the end', st.pumpOn===false)
ok('stage is complete', st.stage==='complete')
ok('water used is reported and plausible', st.waterUsedMl>40 && st.waterUsedMl<400, `${st.waterUsedMl} ml`)
ok('moisture gain matches start and end',
   Math.abs(I.moistureGain(st)-(st.moisture-start))<0.05, `+${I.moistureGain(st)}%`)
ok('rise decelerates as it approaches capacity', (()=>{
  // first half of the gain should take less time than the second half
  let a=I.beginInspection('B2',data.B2,diag.B2)
  while(a.stage!=='irrigating') a=I.stepInspection(a,dt)
  const s0=a.moisture, mid=s0+(I.TARGET_MOISTURE-s0)/2
  let t1=0; while(a.moisture<mid && a.stage==='irrigating'){ a=I.stepInspection(a,dt); t1++ }
  let t2=0; while(a.stage==='irrigating'){ a=I.stepInspection(a,dt); t2++ }
  return t2>t1
})())

console.log('\n=== Zones that should NOT be irrigated ===')
let refers=0, nones=0, irrigates=0
for(const id of SCAN_ORDER){
  const res = run(I.beginInspection(id, data[id], diag[id]))
  const a = res.s.decision.action
  if(a==='irrigate') irrigates++; else if(a==='refer') refers++; else nones++
  if(a!=='irrigate' && res.s.waterUsedMl!==0){ fail++; console.log(`  FAIL ${id} used water without deciding to irrigate`) }
  if(a!=='irrigate' && res.s.pumpOn){ fail++; console.log(`  FAIL ${id} left the pump on`) }
}
console.log(`  ${irrigates} irrigated · ${refers} referred · ${nones} no action`)
ok('no water is used unless irrigation was chosen', true)
ok('the field produces a mix of outcomes', irrigates>0 && (refers>0||nones>0))
ok('every dry zone gets irrigated', SCAN_ORDER.every(id=>{
  const sensors=I.sampleSensors(data[id])
  const res=run(I.beginInspection(id,data[id],diag[id]))
  return (sensors.soilMoisture<I.MOISTURE_THRESHOLD) === (res.s.decision.action==='irrigate')
}))

console.log('\n=== Guard rails ===')
ok('pump cannot run past its cap', (()=>{
  const weird={...data.B2, soilMoisture:1}
  const res=run(I.beginInspection('X',weird,null),200)
  return res.s.stage==='complete' && res.s.elapsed<=I.INSPECTION.maxPumpSeconds+1
})())
ok('a 5 s frame hitch does not overshoot the target', (()=>{
  let a=I.beginInspection('B2',data.B2,diag.B2)
  while(a.stage!=='irrigating') a=I.stepInspection(a,dt)
  a=I.stepInspection(a,5)
  return a.moisture<=I.TARGET_MOISTURE+0.01
})())
ok('non-finite delta is ignored', (()=>{
  let a=I.beginInspection('B2',data.B2,diag.B2)
  a=I.stepInspection(a,NaN)
  return Number.isFinite(a.elapsed)&&Number.isFinite(a.moisture)
})())
ok('frame rate does not change water used', (()=>{
  const f=hz=>{ let a=I.beginInspection('B2',data.B2,diag.B2)
    while(a.stage!=='complete'&&a.stage!=='none') a=I.stepInspection(a,1/hz)
    return a.waterUsedMl }
  return Math.abs(f(30)-f(144))<10
})(), `30Hz vs 144Hz`)
ok('completed state is stable', (()=>{
  let a=run(I.beginInspection('B2',data.B2,diag.B2)).s
  const before=JSON.stringify(a)
  for(let i=0;i<120;i++) a=I.stepInspection(a,dt)
  return JSON.stringify(a)===before
})())

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

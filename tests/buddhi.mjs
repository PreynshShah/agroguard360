const B='../frontend/src/'
const { createZoneData, SCAN_ORDER } = await import(B+'data/zoneAgronomy.js')
const { buddhi, createBuddhiEngine, deriveSeverity } = await import(B+'systems/buddhi/index.js')
const { CLASS_ORDER, CLASSES } = await import(B+'systems/buddhi/classes.js')
const { extractFeatures, FEATURE_NAMES } = await import(B+'systems/buddhi/features.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }

const data = createZoneData()
const ids = Object.keys(data)

console.log('=== Dataset ===')
ok('16 zone records', ids.length===16)
ok('scan order covers every zone', SCAN_ORDER.length===16 && SCAN_ORDER.every(id=>data[id]))
ok('diagnosis fields start empty', ids.every(id=>data[id].problem===null && data[id].severity===null))
ok('readings are within physical ranges', ids.every(id=>{
  const r=data[id]
  return r.soilMoisture>0 && r.soilMoisture<100 && r.humidity>0 && r.humidity<=100 &&
         r.ndvi>0 && r.ndvi<=1 && r.health>0 && r.health<=100
}))
const d1=createZoneData(), d2=createZoneData()
ok('deterministic across reloads', JSON.stringify(d1)===JSON.stringify(d2))

console.log('\n=== Features ===')
const f = extractFeatures(data.B2)
ok('feature vector matches declared names', f.length===FEATURE_NAMES.length, `${f.length} features`)
ok('features normalised to 0..1', ids.every(id=>extractFeatures(data[id]).every(v=>v>=0&&v<=1)))

console.log('\n=== Classification vs ground truth (never seen by the model) ===')
const results={}
let correct=0
for (const id of SCAN_ORDER) {
  const r = await buddhi.analyze(data[id])
  results[id]=r
  const truth = data[id]._condition
  const hit = r.problem===truth
  if (hit) correct++
  const sevTruth = data[id]._trueSeverity
  console.log(`  ${id}  ${String(CLASSES[r.problem].label).padEnd(13)} ${(r.confidence*100).toFixed(0).padStart(3)}%  sev ${String(r.severity).padEnd(6)} | truth ${String(CLASSES[truth].label).padEnd(13)} ${sevTruth.padEnd(6)} ${hit?'':'  <-- MISS'}`)
}
ok('classifier recovers ground truth on all 16 zones', correct===16, `${correct}/16`)

console.log('\n=== Probability integrity ===')
ok('probabilities sum to 1', SCAN_ORDER.every(id=>{
  const s=Object.values(results[id].probabilities).reduce((a,b)=>a+b,0)
  return Math.abs(s-1)<1e-9
}))
ok('probabilities cover all four classes',
  SCAN_ORDER.every(id=>CLASS_ORDER.every(c=>typeof results[id].probabilities[c]==='number')))
ok('confidence is the winning probability',
  SCAN_ORDER.every(id=>Math.abs(results[id].confidence-Math.max(...Object.values(results[id].probabilities)))<1e-12))
ok('no NaN anywhere in output',
  SCAN_ORDER.every(id=>Object.values(results[id].probabilities).every(Number.isFinite)))

console.log('\n=== Spec examples ===')
ok('B2 is Water Stress, High severity',
   results.B2.problem==='water_stress' && results.B2.severity==='high',
   `${results.B2.problem}/${results.B2.severity} @ ${(results.B2.confidence*100).toFixed(0)}%`)
ok('B2 crop is Tomato', data.B2.cropType==='Tomato')
ok('B2 soil moisture is low, as a stressed zone should be',
   data.B2.soilMoisture<30, `${data.B2.soilMoisture}%`)
ok('C3 is Disease, Medium severity',
   results.C3.problem==='disease' && results.C3.severity==='medium',
   `${results.C3.problem}/${results.C3.severity} @ ${(results.C3.confidence*100).toFixed(0)}%`)
ok('C3 crop is Tomato', data.C3.cropType==='Tomato')

console.log('\n=== Class coverage and severity spread ===')
const found=new Set(SCAN_ORDER.map(id=>results[id].problem))
ok('all four classes appear in the field', found.size===4, [...found].join(', '))
const sevs=new Set(SCAN_ORDER.filter(id=>results[id].problem!=='healthy').map(id=>results[id].severity))
ok('low, medium and high severities all present', sevs.size===3, [...sevs].join(', '))
const problems=SCAN_ORDER.filter(id=>results[id].problem!=='healthy')
ok('a meaningful minority of zones need attention',
   problems.length>=4 && problems.length<=9, `${problems.length}/16`)
ok('healthy zones report severity none',
   SCAN_ORDER.filter(id=>results[id].problem==='healthy').every(id=>results[id].severity==='none'))

console.log('\n=== Confidence sanity ===')
const conf=SCAN_ORDER.map(id=>results[id].confidence)
ok('confidence always above chance (0.25)', conf.every(c=>c>0.25), `min ${(Math.min(...conf)*100).toFixed(0)}%`)
ok('confidence never exactly 100% (no false certainty)', conf.every(c=>c<0.9999),
   `max ${(Math.max(...conf)*100).toFixed(1)}%`)

console.log('\n=== Swappable backend contract ===')
const stub = createBuddhiEngine({ backend: { name:'stub', version:'0.0.1', trained:true,
  async predict(){ return { healthy:0.1, water_stress:0.7, disease:0.1, pest_damage:0.1 } } } })
const stubbed = await stub.analyze(data.A1)
ok('alternate backend is used without touching call sites', stubbed.problem==='water_stress',
   `${stubbed.problem} @ ${(stubbed.confidence*100).toFixed(0)}%`)
ok('engine reports which backend is active', stub.describe().name==='stub' && stub.describe().trained===true)
ok('default engine reports itself as simulated, not trained',
   buddhi.describe().name==='simulated' && buddhi.describe().trained===false)
ok('analyze is async (returns a promise)', stub.analyze(data.A1) instanceof Promise)

console.log('\n=== Severity is evidence-driven, not confidence-driven ===')
const mild = { soilMoisture: 34, canopyDelta: 0.7, lesionIndex: 0, canopyLoss: 0 }
const severe = { soilMoisture: 14, canopyDelta: 5.6, lesionIndex: 0, canopyLoss: 0 }
ok('a confident call on a mild problem is not High',
   deriveSeverity('water_stress', 0.98, mild)!=='high', deriveSeverity('water_stress',0.98,mild))
ok('a less confident call on a severe problem still escalates',
   deriveSeverity('water_stress', 0.55, severe)==='high', deriveSeverity('water_stress',0.55,severe))

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

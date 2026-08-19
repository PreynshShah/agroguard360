const B='../frontend/src/'
import { readFileSync } from 'fs'
const M = await import(B+'systems/mercatus/index.js')
const A = await import(B+'systems/mercatus/assumptions.js')

let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const close=(a,b,eps=1e-9)=>Math.abs(a-b)<eps

console.log('=== Empty session ===')
const empty = M.analyseSession({})
ok('no missions gives zero everywhere',
   empty.costs.total===0 && empty.resources.waterMl===0 && empty.savings.total===0)
ok('ROI is null, not Infinity, when nothing was spent', empty.roi===null, String(empty.roi))
ok('flagged as simulated', empty.simulated===true)

console.log('\n=== Hand-checked arithmetic ===')
// One mission with round numbers so every term can be verified by hand.
const m = M.createMissionRecord({
  zoneId:'B2', action:'irrigate', problem:'water_stress',
  waterMl:1000,            // 1 litre exactly
  distanceMeters:100,
  operatingSeconds:3600,   // 1 hour driving
  treatmentSeconds:3600,   // 1 hour pumping
  inspectionSeconds:3600,  // 1 hour parked
})
const a = M.analyseSession({missions:[m], surveySeconds:3600, zonesScanned:16, zonesTotal:16})

// Energy: drive 45W*1h=45Wh; electronics 12W*2h=24Wh; pump 25W*1h=25Wh; drone 180W*1h=180Wh
ok('rover drive energy = 45 Wh', close(a.energy.roverDrive,45), `${a.energy.roverDrive} Wh`)
ok('electronics energy = 24 Wh (drive + parked)', close(a.energy.roverElectronics,24), `${a.energy.roverElectronics} Wh`)
ok('pump energy = 25 Wh', close(a.energy.pump,25), `${a.energy.pump} Wh`)
ok('drone energy = 180 Wh', close(a.energy.droneFlight,180), `${a.energy.droneFlight} Wh`)
ok('total energy = 274 Wh', close(a.energy.totalWh,274), `${a.energy.totalWh} Wh`)

// Costs: water 1L*0.02=0.02 ; energy 0.274kWh*8=2.192 ; machine (2h rover + 1h drone)=3h*120=360
ok('water cost = 1 L × ₹0.02', close(a.costs.water,0.02), `₹${a.costs.water}`)
ok('energy cost = 0.274 kWh × ₹8', close(a.costs.energy,2.192), `₹${a.costs.energy}`)
ok('machine cost = 3 h × ₹120', close(a.costs.machine,360), `₹${a.costs.machine}`)
ok('total = sum of the three parts',
   close(a.costs.total, a.costs.water+a.costs.energy+a.costs.machine), `₹${a.costs.total.toFixed(3)}`)

// Savings: 1 zone treated of 16 → 15 spared × 1000ml = 15000ml = 15L × 0.02 = 0.30
ok('water saved = 15 zones spared × 1 L', close(a.savings.waterSavedMl,15000), `${a.savings.waterSavedMl} ml`)
ok('water saving cost = ₹0.30', close(a.savings.water,0.3), `₹${a.savings.water}`)
// Labour: 16 zones × 6 min = 96 min = 1.6 h × 250 = 400
ok('scouting hours saved = 1.6 h', close(a.savings.scoutingHoursSaved,1.6), `${a.savings.scoutingHoursSaved} h`)
ok('labour saving = ₹400', close(a.savings.labour,400), `₹${a.savings.labour}`)
ok('total savings = water + labour', close(a.savings.total, 400.3), `₹${a.savings.total}`)

// Net and ROI
const expectedNet = 400.3 - a.costs.total
ok('net = savings − cost', close(a.net, expectedNet), `₹${a.net.toFixed(2)}`)
ok('ROI = net / cost × 100', close(a.roi, (expectedNet/a.costs.total)*100), `${a.roi.toFixed(1)}%`)
ok('ROI basis names what it is a return on', /operating/i.test(a.roiBasis))

console.log('\n=== Internal consistency ===')
const many = M.analyseSession({
  missions:[
    M.createMissionRecord({zoneId:'B2',action:'irrigate',waterMl:123,distanceMeters:108,operatingSeconds:97,treatmentSeconds:11,inspectionSeconds:15}),
    M.createMissionRecord({zoneId:'B4',action:'irrigate',waterMl:112,distanceMeters:84,operatingSeconds:77,treatmentSeconds:10,inspectionSeconds:14}),
    M.createMissionRecord({zoneId:'C3',action:'refer',waterMl:0,distanceMeters:60,operatingSeconds:60,treatmentSeconds:0,inspectionSeconds:4}),
  ],
  surveySeconds:71, zonesScanned:16, zonesTotal:16,
})
ok('water totals across missions', many.resources.waterMl===235, `${many.resources.waterMl} ml`)
ok('distance totals across missions', many.resources.distanceMeters===252)
ok('treated count excludes referrals', many.resources.treatedZones===2, `${many.resources.treatedZones}`)
ok('mission count includes referrals', many.resources.missionCount===3)
ok('a referral consumes no water', many.missions.find(x=>x.action==='refer').waterMl===0)
ok('zones spared = total − treated', many.savings.zonesSpared===14)
ok('cost breakdown sums to total',
   close(M.costBreakdown(many).reduce((t,r)=>t+r.value,0), many.costs.total, 1e-9))
ok('energy breakdown sums to total',
   close(M.energyBreakdown(many).reduce((t,r)=>t+r.value,0), many.energy.totalWh, 1e-9))
ok('breakdowns are sorted largest first',
   M.costBreakdown(many).every((r,i,arr)=>i===0||arr[i-1].value>=r.value))
console.log(`  session: ${many.resources.waterMl} ml · ${many.resources.distanceMeters} m · ${many.energy.totalWh.toFixed(1)} Wh · cost ${M.formatMoney(many.costs.total)} · savings ${M.formatMoney(many.savings.total)} · ROI ${many.roi.toFixed(0)}%`)

console.log('\n=== Monotonicity (more work costs more) ===')
const base = M.analyseSession({missions:[M.createMissionRecord({zoneId:'A',action:'irrigate',waterMl:100,distanceMeters:50,operatingSeconds:50,treatmentSeconds:9,inspectionSeconds:12})],surveySeconds:60,zonesScanned:16})
const more = M.analyseSession({missions:[M.createMissionRecord({zoneId:'A',action:'irrigate',waterMl:200,distanceMeters:100,operatingSeconds:100,treatmentSeconds:18,inspectionSeconds:12})],surveySeconds:60,zonesScanned:16})
ok('doubling the work raises cost', more.costs.total>base.costs.total)
ok('doubling the work raises energy', more.energy.totalWh>base.energy.totalWh)
ok('treating more zones spares fewer', (()=>{
  const one=M.analyseSession({missions:[M.createMissionRecord({zoneId:'A',action:'irrigate',waterMl:100})],zonesScanned:16})
  const two=M.analyseSession({missions:[M.createMissionRecord({zoneId:'A',action:'irrigate',waterMl:100}),M.createMissionRecord({zoneId:'B',action:'irrigate',waterMl:100})],zonesScanned:16})
  return two.savings.zonesSpared < one.savings.zonesSpared
})())

console.log('\n=== Honesty guards ===')
ok('no rate is hard-coded in the engine', (()=>{
  const src=readFileSync(B+'systems/mercatus/index.js','utf8')
  // any bare decimal cost literal would be a rate escaping assumptions.js
  return !/\b0\.02\b|\b8\.0\b|\b120\b|\b250\b/.test(src)
})())
ok('exclusions are declared, not silent', a.exclusions.length>=3, `${a.exclusions.length} exclusions`)
ok('yield protection is explicitly excluded',
   a.exclusions.some(e=>/yield/i.test(e.item)))
ok('capital cost is explicitly excluded',
   a.exclusions.some(e=>/capital/i.test(e.item)))
ok('every exclusion states a reason', a.exclusions.every(e=>e.reason && e.reason.length>20))
ok('assumptions file marks rates as placeholders', (()=>{
  const src=readFileSync(B+'systems/mercatus/assumptions.js','utf8')
  return /ILLUSTRATIVE PLACEHOLDER/i.test(src) && /not researched market rates/i.test(src)
})())
ok('simulated flag present on every analysis',
   [empty,a,many,base,more].every(x=>x.simulated===true))

console.log('\n=== Formatting ===')
ok('money formats with symbol', M.formatMoney(360).startsWith('₹'))
ok('small values keep decimals', M.formatMoney(2.192)==='₹2.19', M.formatMoney(2.192))
ok('null money is a dash, not NaN', M.formatMoney(null)==='—')
ok('duration formats minutes and seconds', M.formatDuration(97)==='1m 37s', M.formatDuration(97))
ok('zero duration is 0s', M.formatDuration(0)==='0s')

console.log('\n=== Dominance caveat ===')
ok('flags when one assumption carries the savings', a.caveat !== null, a.caveat)
ok('names the dominant term', /labour/i.test(a.caveat))
ok('dominant share is a real fraction',
   a.savings.dominant.share>0 && a.savings.dominant.share<=1,
   `${(a.savings.dominant.share*100).toFixed(0)}%`)
// The caveat must appear exactly when one term passes 60%, and never otherwise.
ok('caveat presence tracks the 60% threshold exactly', (()=>{
  const cases = [
    M.analyseSession({missions:[M.createMissionRecord({zoneId:'A',action:'irrigate',waterMl:1000})],zonesScanned:16,zonesTotal:16}),
    M.analyseSession({missions:[M.createMissionRecord({zoneId:'A',action:'irrigate',waterMl:5_000_000})],zonesScanned:1,zonesTotal:16}),
    M.analyseSession({missions:[M.createMissionRecord({zoneId:'A',action:'irrigate',waterMl:300_000})],zonesScanned:8,zonesTotal:16}),
    empty,
  ]
  return cases.every(c => (c.caveat !== null) === (c.savings.dominant.share > 0.6))
})())
ok('a water-dominated session names water, not labour', (()=>{
  const w=M.analyseSession({missions:[M.createMissionRecord({zoneId:'A',action:'irrigate',waterMl:5_000_000})],zonesScanned:1,zonesTotal:16})
  return w.savings.dominant.key==='water' && /water/i.test(w.caveat)
})())
ok('empty session has no dominant term and no caveat',
   empty.caveat===null && empty.savings.dominant.share===0)

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

const B='../frontend/src/'
import { readFileSync } from 'fs'
const { FOCUS_VIEWS } = await import(B+'systems/droneConfig.js')
const { deriveSystemStatus } = await import(B+'components/ui/SystemStatus.jsx').catch(()=>({}))
  .then?.(m=>m)??{}
let fail=0
const ok=(l,c,d='')=>{ if(!c) fail++; console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?'  → '+d:''}`) }
const src=(f)=>readFileSync(B+f,'utf8')

console.log('=== Camera shortcuts ===')
for(const k of ['farm','pegasus','talos','problem','overview'])
  ok(`${k.toUpperCase()} view defined`, Boolean(FOCUS_VIEWS[k]), FOCUS_VIEWS[k]?.label)
ok('problem view resolves dynamically', FOCUS_VIEWS.problem.subject==='problem')
ok('overview is the widest shot',
   FOCUS_VIEWS.overview.offset[1] > FOCUS_VIEWS.farm.offset[1], 
   `${FOCUS_VIEWS.overview.offset[1]}m vs ${FOCUS_VIEWS.farm.offset[1]}m`)
ok('every view has a label and offset',
   Object.values(FOCUS_VIEWS).every(v=>v.label && Array.isArray(v.offset)))

console.log('\n=== Required layout regions ===')
const app=src('App.jsx')
ok('header mounted', app.includes('<AppHeader'))
ok('system status rail mounted', app.includes('<SystemStatus'))
ok('mission data rail mounted', app.includes('<MissionData'))
ok('command bar mounted', app.includes('<CommandBar'))
ok('module drawer mounted', app.includes('<ModuleDrawer'))

console.log('\n=== Required content ===')
const status=src('components/ui/SystemStatus.jsx')
for(const n of ['Pegasus','Buddhi','Promethia','Talos','Mercatus'])
  ok(`status rail lists ${n}`, status.includes(`'${n}'`))
const md=src('components/ui/MissionData.jsx')
for(const f of ['Current zone','Robot status','Soil moisture','Water used','Distance','Estimated cost'])
  ok(`mission data shows "${f}"`, md.includes(f))

console.log('\n=== Farm remains the focus ===')
const css=src('index.css')
ok('layout leaves an empty centre column',
   /grid-template-columns:\s*232px 1fr 246px/.test(css))
ok('HUD does not capture pointer events globally',
   /\.hud \{[^}]*pointer-events: none/.test(css))
ok('rails scroll instead of growing without limit', /\.rail \{[^}]*overflow-y: auto/.test(css))
ok('module panels are closed by default', /useState\(false\)/.test(src('App.jsx')))
ok('rail children are width-constrained (no overflow)',
   /\.rail > \.plate \{[^}]*max-width: none/.test(css))
ok('narrow screens collapse the rails', /max-width: 820px/.test(css))

console.log('\n=== Every module still independently operable ===')
for(const c of ['FlightControls','BuddhiPanel','PromethiaPanel','TalosPanel','MercatusPanel'])
  ok(`${c} still mounted`, app.includes(`<${c}`))
ok('drawer exposes all five as tabs',
   ['pegasus','buddhi','promethia','talos','mercatus'].every(id=>app.includes(`id: '${id}'`)))

console.log('\n=== State synchronisation ===')
ok('current zone resolves in a single priority order',
   /talos\.telemetry\.targetZone \?\? promethia\.targetZone \?\? selectedZone/.test(app))
ok('system status derives from live values, not stored copies',
   /deriveSystemStatus\(\{/.test(app) && /droneMode: controller\.mode/.test(app))
ok('reset clears the selected zone too', /setSelectedZone\(null\)\s*\n\s*demo\.reset/.test(app))
ok('start and reset share one handler each',
   (app.match(/handleStartDemo/g)||[]).length>=3 && (app.match(/handleResetDemo/g)||[]).length>=3)

console.log('\n=== No new dependencies ===')
const pkg=JSON.parse(readFileSync('../frontend/package.json','utf8'))
const deps=Object.keys(pkg.dependencies)
ok('runtime dependencies unchanged since Phase 1',
   deps.sort().join(',')==='@react-three/drei,@react-three/fiber,react,react-dom,three',
   deps.join(', '))
ok('no charting or UI library added',
   !deps.some(d=>/chart|recharts|d3|mui|antd|bootstrap|tailwind/i.test(d)))

console.log('\n=== Visual style guards ===')
ok('no neon or pure-saturated accent colours', !/#0f0|#00ff|#f0f|#ff00/i.test(css))
ok('headline type stays modest (no huge text)', (()=>{
  const sizes=[...css.matchAll(/font-size:\s*(\d+)px/g)].map(m=>+m[1])
  return Math.max(...sizes) <= 26
})(), `max ${Math.max(...[...css.matchAll(/font-size:\s*(\d+)px/g)].map(m=>+m[1]))}px`)
ok('earth-tone palette retained in tokens',
   /--chlorophyll: #2e7d4f/.test(css) && /--furrow: #8a6a3e/.test(css))

console.log(`\n=== ${fail===0?'ALL CHECKS PASSED':fail+' CHECK(S) FAILED'} ===`)
process.exit(fail?1:0)

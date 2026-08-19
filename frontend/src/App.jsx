import { useCallback, useEffect, useRef, useState } from 'react'

import { MainScene } from './scenes/MainScene'
import { ZoneReadout } from './components/ZoneReadout'
import { ViewControlsKey } from './components/ViewControlsKey'
import { FlightControls } from './components/FlightControls'
import { BuddhiPanel } from './components/BuddhiPanel'
import { PromethiaPanel } from './components/PromethiaPanel'
import { TalosPanel } from './components/TalosPanel'
import { MercatusPanel } from './components/MercatusPanel'
import { DemoControls } from './components/DemoControls'
import { AppHeader } from './components/ui/AppHeader'
import { SystemStatus, deriveSystemStatus } from './components/ui/SystemStatus'
import { MissionData } from './components/ui/MissionData'
import { CommandBar } from './components/ui/CommandBar'
import { ModuleDrawer } from './components/ui/ModuleDrawer'
import { EventLog } from './components/EventLog'
import { MissionComplete } from './components/MissionComplete'
import { getZone } from './systems/farmLayout'
import { useWebGLSupport } from './hooks/useWebGLSupport'
import { useDroneController } from './hooks/useDroneController'
import { useBuddhiScan } from './hooks/useBuddhiScan'
import { usePromethia } from './hooks/usePromethia'
import { useTalosController } from './hooks/useTalosController'
import { useMercatus } from './hooks/useMercatus'
import { useDemoOrchestrator } from './hooks/useDemoOrchestrator'

/**
 * App
 * Decides what the person sees: the field view, a loading state while the
 * renderer starts, or an explanation if this browser can't run WebGL.
 *
 * The drone controller is created here rather than inside the canvas, because
 * both the 3D rig and the DOM flight panel need the same instance — the panel
 * issues commands, the rig flies them. One controller, two consumers.
 */
export default function App() {
  const webgl = useWebGLSupport()
  const [sceneReady, setSceneReady] = useState(false)

  const [hoveredZone, setHoveredZone] = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)
  const [focus, setFocus] = useState(null)

  const controller = useDroneController()
  const scan = useBuddhiScan(controller)
  const promethia = usePromethia()
  // TALOS samples the same field state BUDDHI surveyed, and reads its
  // diagnosis, so the ground sensors and the aerial scan describe one field
  // rather than two.
  const talos = useTalosController({
    getReading: (zoneId) => scan.zoneData[zoneId],
    getDiagnosis: (zoneId) => scan.results[zoneId],
  })

  const mercatus = useMercatus({
    inspection: talos.inspection,
    telemetry: talos.telemetry,
    surveySeconds: scan.surveySeconds,
    zonesScanned: scan.completedCount,
    zonesTotal: scan.total,
  })

  const [summaryDismissed, setSummaryDismissed] = useState(false)
  const [manualSummary, setManualSummary] = useState(null)

  const demo = useDemoOrchestrator({
    scan,
    promethia,
    talos,
    mercatus,
    setFocus: (next) => {
      setFocus(null)
      requestAnimationFrame(() => setFocus(next))
    },
  })

  const [modulesOpen, setModulesOpen] = useState(false)
  const [uiHidden, setUiHidden] = useState(false)

  // The zone BUDDHI ranked worst, used by the PROBLEM ZONE camera shortcut.
  const worstFinding = scan.findings[0] ?? null
  const problemZone = worstFinding ? getZone(worstFinding.zoneId) : null
  const problemSubject = problemZone
    ? { x: problemZone.centerX, y: 0, z: problemZone.centerZ }
    : null

  const systemStatus = deriveSystemStatus({
    droneMode: controller.mode,
    scan,
    promethiaRoute: promethia.route,
    talosMode: talos.mode,
    inspection: talos.inspection,
    missions: mercatus.missions.length,
  })

  // One name for "the zone the system is working on", resolved in priority
  // order: what the rover is treating, then what a route targets, then what
  // the operator selected. Without this the header could disagree with itself.
  const currentZone =
    talos.telemetry.targetZone ?? promethia.targetZone ?? selectedZone ?? worstFinding?.zoneId ?? null

  // When the machine docks after working on its own — outside the scripted
  // demo — the same summary card is shown. Someone driving the modules by hand
  // deserves the totals as much as someone watching the demo, and the MERCATUS
  // panel may not even be open.
  const dockedAtRef = useRef(0)
  useEffect(() => {
    const missionCount = mercatus.missions.length

    if (talos.mode === 'idle' && missionCount > 0 && !demo.running) {
      if (dockedAtRef.current !== missionCount) {
        dockedAtRef.current = missionCount
        setManualSummary({
          zones: mercatus.missions.map((m) => m.zoneId),
          analysis: mercatus.analysis,
          docked: true,
          healthy: false,
        })
        setSummaryDismissed(false)
      }
    }

    if (missionCount === 0) dockedAtRef.current = 0
  }, [talos.mode, mercatus.missions, mercatus.analysis, demo.running])

  // H clears the interface for a full-screen view of the field. Escape brings
  // it back — a hidden interface with no visible way out is a trap, so Escape
  // only ever restores, never hides.
  useEffect(() => {
    const onKey = (event) => {
      const typing =
        event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
      if (typing) return

      if (event.key === 'h' || event.key === 'H') {
        setUiHidden((v) => !v)
      } else if (event.key === 'Escape') {
        setUiHidden(false)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleStartDemo = useCallback(() => {
    setSummaryDismissed(false)
    demo.start()
  }, [demo])

  const handleResetDemo = useCallback(() => {
    setSummaryDismissed(false)
    setManualSummary(null)
    dockedAtRef.current = 0
    setSelectedZone(null)
    demo.reset()
  }, [demo])

  const handleHover = useCallback((id) => setHoveredZone(id), [])
  const handleSelect = useCallback((id) => setSelectedZone(id), [])

  // Re-selecting the same subject should re-frame it, so clear first.
  const handleFocus = useCallback((next) => {
    setFocus(null)
    requestAnimationFrame(() => setFocus(next))
  }, [])

  // Taking the camera by hand drops the focus highlight.
  const handleFocusInterrupted = useCallback(() => setFocus(null), [])

  if (webgl === 'unsupported') {
    return (
      <div className="state-screen">
        <h1 className="state-screen__title">This browser can't run the field view</h1>
        <p className="state-screen__body">
          AGROGUARD 360 draws the field with WebGL, and this browser didn't provide it.
          Turn on hardware acceleration in your browser settings, update your graphics
          driver, or open the app in a current version of Chrome, Edge, Firefox or Safari.
        </p>
      </div>
    )
  }

  return (
    <div className={`scene-shell${hoveredZone ? ' scene-shell--pointing' : ''}`}>
      {webgl === 'supported' && (
        <MainScene
          onReady={() => setSceneReady(true)}
          hoveredZone={hoveredZone}
          selectedZone={selectedZone}
          onHoverZone={handleHover}
          onSelectZone={handleSelect}
          controller={controller}
          focus={focus}
          onFocusInterrupted={handleFocusInterrupted}
          scanResults={scan.results}
          activeZone={scan.activeZone}
          route={promethia.route}
          obstacles={promethia.obstacles}
          rover={talos}
          paused={demo.paused}
          problemSubject={problemSubject}
        />
      )}

      {!sceneReady && (
        <div className="state-screen">
          <span className="state-screen__label">Loading field view</span>
          <span className="state-screen__bar">
            <span />
          </span>
        </div>
      )}

      <div className={`hud${uiHidden ? ' hud--hidden' : ''}`}>
        <AppHeader demoRunning={demo.running} demoPaused={demo.paused} />

        <div className="hud__body">
          <div className="rail rail--left">
            <SystemStatus {...systemStatus} />
            <DemoControls
              running={demo.running}
              paused={demo.paused}
              currentStep={demo.currentStep}
              onStart={handleStartDemo}
              onPause={demo.pause}
              onResume={demo.resume}
              onReset={handleResetDemo}
              compact
            />
            <ViewControlsKey />
          </div>

          <div className="rail rail--right">
            <MissionData
              zone={currentZone}
              roverMode={talos.mode}
              inspection={talos.inspection}
              analysis={mercatus.analysis}
            />
            <EventLog events={demo.events} />
            <ZoneReadout
              zoneId={selectedZone}
              reading={selectedZone ? scan.zoneData[selectedZone] : null}
              diagnosis={selectedZone ? scan.results[selectedZone] : null}
              onClear={() => setSelectedZone(null)}
            />
          </div>
        </div>

        <CommandBar
          demo={demo}
          focus={focus}
          onFocus={handleFocus}
          hasProblem={Boolean(problemZone)}
          modulesOpen={modulesOpen}
          onToggleModules={() => setModulesOpen((v) => !v)}
          onHideUi={() => {
            setModulesOpen(false)
            setUiHidden(true)
          }}
          onStart={handleStartDemo}
          onReset={handleResetDemo}
        />

        <ModuleDrawer
          open={modulesOpen && !uiHidden}
          onClose={() => setModulesOpen(false)}
          tabs={[
            {
              id: 'pegasus',
              label: 'Pegasus',
              render: () => (
                <FlightControls
                  mode={controller.mode}
                  scanning={scan.isScanning}
                  onTakeOff={controller.takeOff}
                  onLand={controller.land}
                  onInput={controller.setInput}
                  onClearInput={controller.clearInput}
                />
              ),
            },
            {
              id: 'buddhi',
              label: 'Buddhi',
              render: () => (
                <BuddhiPanel
                  status={scan.status}
                  isScanning={scan.isScanning}
                  findings={scan.findings}
                  activeZone={scan.activeZone}
                  completedCount={scan.completedCount}
                  total={scan.total}
                  engine={scan.engine}
                  onRun={scan.runScan}
                  onCancel={scan.cancelScan}
                  onSelectZone={handleSelect}
                  selectedZone={selectedZone}
                />
              ),
            },
            {
              id: 'promethia',
              label: 'Promethia',
              render: () => (
                <PromethiaPanel
                  findings={scan.findings}
                  targetZone={promethia.targetZone}
                  route={promethia.route}
                  obstacleIds={promethia.obstacleIds}
                  available={promethia.available}
                  depot={promethia.depot}
                  onOptimize={(zoneId) => {
                    promethia.optimizeRoute(zoneId)
                    setSelectedZone(zoneId)
                  }}
                  onClear={promethia.clearRoute}
                  onToggleObstacle={promethia.toggleObstacle}
                />
              ),
            },
            {
              id: 'talos',
              label: 'Talos',
              render: () => (
                <TalosPanel
                  mode={talos.mode}
                  telemetry={talos.telemetry}
                  inspection={talos.inspection}
                  route={promethia.route}
                  onDeploy={() => talos.deploy(promethia.route)}
                  onRecall={talos.recall}
                  onReturn={() => talos.returnToDepot(promethia.obstacleIds)}
                />
              ),
            },
            {
              id: 'mercatus',
              label: 'Mercatus',
              render: () => (
                <MercatusPanel analysis={mercatus.analysis} onReset={mercatus.reset} />
              ),
            },
          ]}
        />
      </div>

      {uiHidden && (
        <button type="button" className="ui-restore" onClick={() => setUiHidden(false)}>
          Show interface
          <kbd>H</kbd>
        </button>
      )}

      {!summaryDismissed && (
        <MissionComplete
          summary={demo.summary ?? manualSummary}
          onDismiss={() => setSummaryDismissed(true)}
        />
      )}
    </div>
  )
}

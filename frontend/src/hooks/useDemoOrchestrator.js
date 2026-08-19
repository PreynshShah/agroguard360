import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DEMO_CONFIG, DEMO_STEPS } from '../systems/demoSequence'
import { planRoute, DEPOT } from '../systems/promethia'

/**
 * useDemoOrchestrator
 * Runs the whole pipeline as one scripted sequence.
 *
 * Written as a single async function rather than a per-frame state machine.
 * The steps are genuinely sequential and each waits on a real condition —
 * rotors up, survey finished, rover arrived, pump stopped — so a switch
 * statement stepped once per frame would scatter an obvious order across ten
 * disconnected branches.
 *
 * ---------------------------------------------------------------------------
 * How pause works
 * ---------------------------------------------------------------------------
 * Pausing the script alone would not pause the demonstration: the drone would
 * keep flying and the pump would keep running while the narration stopped. So
 * pause freezes the render loop itself — the canvas frameloop is switched off,
 * which stops every useFrame callback, and with them the flight model, the
 * rover, the inspection and the spray. The world genuinely stops.
 *
 * The orchestrator additionally gates its own waits, so a step boundary
 * reached at the moment of pausing does not slip through.
 */
export function useDemoOrchestrator({ scan, promethia, talos, mercatus, setFocus }) {
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [events, setEvents] = useState([])
  const [summary, setSummary] = useState(null)
  const [queue, setQueue] = useState([])

  const abortRef = useRef(false)
  const pausedRef = useRef(false)
  const runningRef = useRef(false)
  const eventId = useRef(0)
  const stepRef = useRef(null)

  useEffect(() => () => {
    abortRef.current = true
  }, [])

  /* ---- Event log ------------------------------------------------- */

  const log = useCallback((text, kind = 'info') => {
    eventId.current += 1
    const entry = { id: eventId.current, text, kind, at: Date.now() }
    // Newest first, capped. An unbounded log would grow all session and push
    // the useful lines off the top of a fixed-height panel anyway.
    setEvents((current) => [entry, ...current].slice(0, 60))
  }, [])

  /* ---- Cooperative waiting --------------------------------------- */

  const gate = useCallback(
    () =>
      new Promise((resolve) => {
        const tick = () => {
          if (abortRef.current) return resolve(false)
          if (!pausedRef.current) return resolve(true)
          setTimeout(tick, 120)
        }
        tick()
      }),
    [],
  )

  const hold = useCallback(
    async (ms) => {
      const deadline = Date.now() + ms
      // Time spent paused does not count toward the wait, so resuming does not
      // immediately skip the beat that was interrupted.
      while (Date.now() < deadline) {
        if (!(await gate())) return false
        await new Promise((r) => setTimeout(r, Math.min(80, Math.max(0, deadline - Date.now()))))
        if (pausedRef.current) {
          const remaining = deadline - Date.now()
          if (!(await gate())) return false
          if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
          break
        }
      }
      return !abortRef.current
    },
    [gate],
  )

  const until = useCallback(
    async (predicate, timeoutSeconds = 300) => {
      const deadline = Date.now() + timeoutSeconds * 1000
      for (;;) {
        if (!(await gate())) return false
        if (predicate()) return true
        if (Date.now() > deadline) return false
        await new Promise((r) => setTimeout(r, 90))
      }
    },
    [gate],
  )

  /* ---- The sequence ---------------------------------------------- */

  const start = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    abortRef.current = false
    pausedRef.current = false

    stepRef.current = null
    setRunning(true)
    setPaused(false)
    setSummary(null)
    setEvents([])
    mercatus.reset()
    promethia.clearRoute()

    const step = (id) => {
      stepRef.current = id
      setCurrentStep(id)
      const meta = DEMO_STEPS.find((s) => s.id === id)
      if (meta) log(`Step ${meta.number} — ${meta.label.toUpperCase()}: ${meta.detail}`, 'step')
    }

    try {
      /* -- 1. MONITOR -------------------------------------------- */
      step('monitor')
      setFocus('pegasus')
      log('PEGASUS taking off…')
      await scan.runScan()
      if (!(await until(() => scan.statusRef.current === 'complete', 240))) return
      log(`PEGASUS survey complete — ${scan.totalRef.current} zones imaged`, 'ok')

      /* -- 2. DETECT --------------------------------------------- */
      step('detect')
      setFocus('farm')
      log('BUDDHI analyzing zone imagery…')
      if (!(await hold(DEMO_CONFIG.beatMedium))) return

      const findings = scan.findingsRef.current
      if (findings.length === 0) {
        log('No problems detected — field is healthy.', 'ok')
        step('complete')
        setSummary({ zones: [], healthy: true })
        return
      }

      for (const finding of findings.slice(0, 6)) {
        log(`${finding.zoneId} → ${labelFor(finding.problem)} (${finding.severity})`, 'alert')
      }

      /* -- 3. PRIORITIZE ----------------------------------------- */
      step('prioritize')
      const targets = findings.slice(0, DEMO_CONFIG.zoneLimit)
      setQueue(targets.map((f) => f.zoneId))
      log(
        `Prioritized ${targets.length} of ${findings.length} zones by severity — ${targets
          .map((t) => t.zoneId)
          .join(', ')}`,
        'ok',
      )
      if (!(await hold(DEMO_CONFIG.beatMedium))) return

      /* -- 4→8. Per zone ----------------------------------------- */
      let position = { x: DEPOT.x, z: DEPOT.z }

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        if (abortRef.current) return

        if (i > 0) {
          step('repeat')
          log(`Moving to next problem zone — ${target.zoneId}`)
          if (!(await hold(DEMO_CONFIG.beatShort))) return
        }

        /* -- 4. OPTIMIZE ----------------------------------------- */
        step('optimize')
        setFocus('farm')
        log(`PROMETHIA calculating A* route to ${target.zoneId}…`)

        // Planned directly so the route is in hand this tick. The hook is told
        // separately so the panel and the 3D ribbon show the same thing —
        // planRoute is deterministic, so both get an identical result.
        const route = planRoute({
          start: position,
          targetZone: target.zoneId,
          obstacleIds: promethia.obstacleIds,
        })
        promethia.optimizeRoute(target.zoneId, position)

        if (!route.ok) {
          log(`No route to ${target.zoneId} — skipping`, 'warn')
          continue
        }

        log(
          `Route found — ${route.steps} cells, ${route.distanceMeters} m, est. ${route.etaSeconds}s`,
          'ok',
        )
        if (!(await hold(DEMO_CONFIG.beatMedium))) return

        /* -- 5. NAVIGATE ----------------------------------------- */
        step('navigate')
        setFocus('talos')
        log(`TALOS deployed to ${target.zoneId}`)
        talos.deploy(route)

        // Wait for departure before waiting for arrival. Checking only for
        // 'inspecting' would match the machine still standing on the previous
        // zone, and the run would skip straight past the drive.
        if (!(await until(() => talos.rover.mode === 'navigating', 15))) return
        if (!(await until(() => talos.rover.mode === 'inspecting', 300))) return
        position = { x: route.points[route.points.length - 1].x, z: route.points[route.points.length - 1].z }
        log(`TALOS arrived at ${target.zoneId}`, 'ok')

        /* -- 6. INSPECT ------------------------------------------ */
        step('inspect')
        log('TALOS inspecting — probe settling…')
        // Tied to this zone specifically: a stale inspection left over from the
        // previous one would satisfy a bare stage check instantly.
        const inspectingHere = () => talos.inspectionRef.current?.zoneId === target.zoneId

        if (!(await until(() => inspectingHere() && stageOf(talos) !== 'sampling', 60))) return

        const sensors = talos.inspectionRef.current.sensors
        if (sensors) {
          log(
            `Readings — moisture ${sensors.soilMoisture}%, ${sensors.temperature}°C, humidity ${sensors.humidity}% (simulated)`,
            'data',
          )
        }

        /* -- 7. ACT ---------------------------------------------- */
        step('act')
        if (!(await until(() => inspectingHere() && Boolean(talos.inspectionRef.current.decision), 60)))
          return

        const decision = talos.inspectionRef.current.decision
        if (decision.action === 'irrigate') {
          log(`Water stress confirmed — irrigation started at ${target.zoneId}`, 'alert')
          if (!(await until(() => stageOf(talos) === 'complete', 120))) return
          const done = talos.inspectionRef.current
          log(
            `Treatment complete — ${Math.round(done.waterUsedMl)} ml used, moisture ${done.startMoisture.toFixed(0)}% → ${done.moisture.toFixed(0)}%`,
            'ok',
          )
        } else {
          log(`${decision.label} — ${target.zoneId} needs no water`, 'warn')
          if (!(await until(() => stageOf(talos) === 'none', 60))) return
        }

        if (!(await hold(DEMO_CONFIG.beatShort))) return
      }

      /* -- Return home ------------------------------------------- */
      // The mission is not finished when the last zone is treated — the
      // machine has to get back. Reported under step 8, since it is the last
      // movement of the run rather than a stage of its own.
      step('repeat')
      setFocus('talos')
      log('Work complete — TALOS returning to depot')

      if (talos.returnToDepot(promethia.obstacleIds)) {
        if (!(await until(() => talos.rover.mode === 'idle', 300))) return
        log('TALOS docked at depot', 'ok')
      } else {
        log('No route back to depot — recalled directly', 'warn')
      }

      /* -- 9. MEASURE -------------------------------------------- */
      step('measure')
      setFocus('farm')
      log('MERCATUS generating session report…')
      // A beat for the ledger effect to record the final mission before the
      // analysis is read — the record is written on the render after the
      // inspection completes, not during it.
      if (!(await hold(DEMO_CONFIG.beatMedium))) return

      const analysis = mercatus.analysisRef.current
      log(
        `Report — ${analysis.resources.waterMl.toFixed(0)} ml water, ${analysis.resources.distanceMeters.toFixed(0)} m travelled, ${analysis.resources.treatedZones} treated`,
        'ok',
      )

      /* -- 10. COMPLETE ------------------------------------------ */
      step('complete')
      setSummary({
        zones: targets.map((t) => t.zoneId),
        analysis,
        healthy: false,
      })
      log('MISSION COMPLETE', 'ok')
    } finally {
      runningRef.current = false
      setRunning(false)

      // A step that gave up used to end the run with no explanation, which
      // looks identical to the demo simply stopping. Say so.
      if (!abortRef.current && stepRef.current && stepRef.current !== 'complete') {
        log(`Sequence stopped at ${stepRef.current.toUpperCase()} — step timed out`, 'warn')
      }
    }
  }, [scan, promethia, talos, mercatus, setFocus, log, hold, until])

  /* ---- Controls -------------------------------------------------- */

  const pause = useCallback(() => {
    if (!runningRef.current) return
    pausedRef.current = true
    setPaused(true)
    log('Demo paused', 'warn')
  }, [log])

  const resume = useCallback(() => {
    if (!runningRef.current) return
    pausedRef.current = false
    setPaused(false)
    log('Demo resumed')
  }, [log])

  const reset = useCallback(() => {
    abortRef.current = true
    pausedRef.current = false
    runningRef.current = false

    setRunning(false)
    setPaused(false)
    setCurrentStep(null)
    setSummary(null)
    setQueue([])
    setEvents([])

    scan.cancelScan()
    promethia.clearRoute()
    talos.recall()
    mercatus.reset()
    setFocus('farm')
  }, [scan, promethia, talos, mercatus, setFocus])

  return useMemo(
    () => ({
      running,
      paused,
      currentStep,
      events,
      summary,
      queue,
      start,
      pause,
      resume,
      reset,
      log,
    }),
    [running, paused, currentStep, events, summary, queue, start, pause, resume, reset, log],
  )
}

const stageOf = (talos) => talos.inspectionRef.current?.stage
const LABELS = {
  water_stress: 'Water Stress',
  disease: 'Disease',
  pest_damage: 'Pest Damage',
  healthy: 'Healthy',
}
const labelFor = (id) => LABELS[id] ?? id

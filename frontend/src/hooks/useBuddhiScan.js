import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ZONES } from '../systems/farmLayout'
import { createZoneData, SCAN_ORDER } from '../data/zoneAgronomy'
import { buddhi } from '../systems/buddhi'

/**
 * useBuddhiScan
 * Runs a survey: launch, fly the field zone by zone, analyse each one, land.
 *
 * The scan is written as one async sequence rather than a state machine driven
 * from useFrame. The steps are genuinely sequential and each waits on a real
 * condition — rotors up, aircraft over the zone, analysis returned — and a
 * frame-by-frame machine would scatter that order across a switch statement.
 *
 * Results are published zone by zone as they come in, not in one batch at the
 * end. A survey takes the better part of a minute, and a blank panel for the
 * whole of it would look broken.
 */

/** Seconds the aircraft holds over a zone before its reading is taken. */
const DWELL_SECONDS = 0.55
/** Distance at which the aircraft counts as being over the zone. */
const ARRIVE_RADIUS = 2.4
/** Give up on a leg that takes implausibly long, rather than hanging forever. */
const LEG_TIMEOUT_SECONDS = 25

export function useBuddhiScan(controller) {
  // The measurements. Built once — a scan reads the field, it doesn't change it.
  const zoneData = useMemo(() => createZoneData(), [])

  const [status, setStatus] = useState('idle') // idle | scanning | complete
  const [results, setResults] = useState({})
  const [activeZone, setActiveZone] = useState(null)
  const [completedCount, setCompletedCount] = useState(0)
  const [surveySeconds, setSurveySeconds] = useState(0)

  /** Set when a run should stop early — unmount, or the user cancelling. */
  const abortRef = useRef(false)
  const runningRef = useRef(false)

  const zoneById = useMemo(
    () => Object.fromEntries(ZONES.map((zone) => [zone.id, zone])),
    [],
  )

  useEffect(() => () => {
    // Stop the sequence if the component goes away mid-survey, or its
    // setState calls fire into a dead tree.
    abortRef.current = true
  }, [])

  const runScan = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    abortRef.current = false

    const startedAt = performance.now()
    setStatus('scanning')
    setResults({})
    setSurveySeconds(0)
    setCompletedCount(0)
    setActiveZone(null)

    const craft = controller.craft

    try {
      // 1 — Launch, if it isn't already up.
      if (craft.mode === 'idle') controller.takeOff()
      const airborne = await waitUntil(() => craft.mode === 'hover', 20, abortRef)
      if (!airborne || abortRef.current) return

      // 2 — Fly the field, analysing as it goes.
      for (const zoneId of SCAN_ORDER) {
        if (abortRef.current) return

        const zone = zoneById[zoneId]
        setActiveZone(zoneId)
        controller.setWaypoint({ x: zone.centerX, z: zone.centerZ })

        await waitUntil(
          () => craft.waypointDistance !== null && craft.waypointDistance < ARRIVE_RADIUS,
          LEG_TIMEOUT_SECONDS,
          abortRef,
        )
        if (abortRef.current) return

        // 3 — Hold station while the payload captures the zone.
        await delay(DWELL_SECONDS * 1000, abortRef)
        if (abortRef.current) return

        // 4 — BUDDHI analyses the readings. Awaited because a real model will
        //     be doing actual work here.
        const diagnosis = await buddhi.analyze(zoneData[zoneId])
        if (abortRef.current) return

        setResults((previous) => ({ ...previous, [zoneId]: diagnosis }))
        setCompletedCount((n) => n + 1)
      }

      // 5 — Survey complete: release the autopilot and bring it home.
      setActiveZone(null)
      controller.setWaypoint(null)
      controller.land()
      // Flight time is what MERCATUS bills the drone's energy against.
      setSurveySeconds((performance.now() - startedAt) / 1000)
      setStatus('complete')
    } finally {
      runningRef.current = false
      if (abortRef.current) {
        controller.setWaypoint(null)
        setActiveZone(null)
      }
    }
  }, [controller, zoneById, zoneData])

  const cancelScan = useCallback(() => {
    abortRef.current = true
    controller.setWaypoint(null)
    setActiveZone(null)
    setStatus((current) => (current === 'scanning' ? 'idle' : current))
  }, [controller])

  /** Zones needing attention, worst first. */
  const findings = useMemo(() => {
    const rank = { high: 3, medium: 2, low: 1, none: 0 }
    return Object.values(results)
      .filter((result) => result.problem !== 'healthy')
      .sort((a, b) => rank[b.severity] - rank[a.severity] || b.confidence - a.confidence)
  }, [results])

  // Mirrors of the values the demo orchestrator reads.
  //
  // The orchestrator is one long-lived async function, so it closes over the
  // state values as they were when it started. Reading `status` inside it
  // would report 'idle' forever no matter what the scan did. Refs always read
  // current.
  const statusRef = useRef(status)
  const findingsRef = useRef(findings)
  const totalRef = useRef(SCAN_ORDER.length)
  statusRef.current = status
  findingsRef.current = findings

  return {
    status,
    statusRef,
    findingsRef,
    totalRef,
    results,
    findings,
    activeZone,
    zoneData,
    completedCount,
    surveySeconds,
    total: SCAN_ORDER.length,
    isScanning: status === 'scanning',
    runScan,
    cancelScan,
    engine: buddhi.describe(),
  }
}

/* ------------------------------------------------------------------ *
 * Waiting helpers
 * ------------------------------------------------------------------ */

/**
 * Polls a condition on animation frames until it holds or the timeout expires.
 * Frames rather than an interval, so polling stops when the tab is hidden and
 * stays in step with the flight model that is producing the condition.
 */
function waitUntil(predicate, timeoutSeconds, abortRef) {
  return new Promise((resolve) => {
    const deadline = performance.now() + timeoutSeconds * 1000

    const tick = () => {
      if (abortRef.current) return resolve(false)
      if (predicate()) return resolve(true)
      if (performance.now() > deadline) return resolve(false)
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

function delay(ms, abortRef) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    const guard = setInterval(() => {
      if (abortRef.current) {
        clearTimeout(timer)
        clearInterval(guard)
        resolve()
      }
    }, 80)
    setTimeout(() => clearInterval(guard), ms + 40)
  })
}

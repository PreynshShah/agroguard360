import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { analyseSession, createMissionRecord } from '../systems/mercatus'

/**
 * useMercatus
 * Keeps the session ledger and derives the analysis from it.
 *
 * The ledger is the only state held. Every figure MERCATUS reports is
 * recomputed from it, rather than being accumulated into running totals as
 * events arrive. Running totals drift the moment one update is missed or
 * applied twice, and a cost panel that quietly double-counts a treatment is
 * worse than no panel — it looks authoritative while being wrong.
 *
 * Missions are recorded once each, keyed on zone and completion time, because
 * the inspection state is published several times per second and the same
 * completed treatment would otherwise be logged on every frame.
 */
export function useMercatus({ inspection, telemetry, surveySeconds, zonesScanned, zonesTotal }) {
  const [missions, setMissions] = useState([])
  const recordedRef = useRef(new Set())

  useEffect(() => {
    if (!inspection) return

    const finished = inspection.stage === 'complete' || inspection.stage === 'none'
    if (!finished || !inspection.zoneId) return

    // One record per completed inspection. `completedAt` is stamped once when
    // the stage is entered, so it identifies this treatment rather than this
    // render.
    const key = `${inspection.zoneId}:${inspection.completedAt ?? 'x'}`
    if (recordedRef.current.has(key)) return
    recordedRef.current.add(key)

    setMissions((current) => [
      ...current,
      createMissionRecord({
        zoneId: inspection.zoneId,
        action: inspection.decision?.action ?? 'none',
        problem: inspection.pendingDiagnosis?.problem ?? null,
        waterMl: inspection.waterUsedMl ?? 0,
        // Distance and drive time come from the rover's own odometer for the
        // run that just ended.
        distanceMeters: telemetry?.travelled ?? 0,
        operatingSeconds: telemetry?.operatingSeconds ?? 0,
        treatmentSeconds: inspection.treatmentSeconds ?? 0,
        inspectionSeconds: inspection.inspectionSeconds ?? 0,
      }),
    ])
  }, [inspection, telemetry])

  const analysis = useMemo(
    () =>
      analyseSession({
        missions,
        surveySeconds: surveySeconds ?? 0,
        zonesScanned: zonesScanned ?? 0,
        zonesTotal: zonesTotal ?? 16,
      }),
    [missions, surveySeconds, zonesScanned, zonesTotal],
  )

  const reset = useCallback(() => {
    recordedRef.current = new Set()
    setMissions([])
  }, [])

  // Live handle for the orchestrator, which reads the report at the end of a
  // sequence it started long before this value existed.
  const analysisRef = useRef(analysis)
  analysisRef.current = analysis

  return { analysis, analysisRef, missions, reset }
}

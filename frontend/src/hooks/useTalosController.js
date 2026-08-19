import { useCallback, useMemo, useRef, useState } from 'react'

import {
  createRoverState,
  commandDeploy,
  commandRecall,
  commandReturn,
  stepRover,
  ROVER,
} from '../systems/roverMotion'
import { planRoute, DEPOT } from '../systems/promethia'
import {
  createInspection,
  beginInspection,
  stepInspection,
  isPumping,
} from '../systems/inspection'

/**
 * useTalosController
 * Bridges the pure rover motion model to the scene and the interface.
 *
 * Same split as the drone: the model's state is replaced every frame and kept
 * in a ref, while a single long-lived `rover` object is rewritten in place for
 * the scene to read. Only the discrete mode and the handful of figures the
 * panel displays reach React state, and those are throttled — battery and
 * distance change continuously, and re-rendering the interface sixty times a
 * second to move a readout by a hundredth of a percent is wasted work.
 */

/** How often the interface figures refresh, in seconds. */
const TELEMETRY_INTERVAL = 0.25

export function useTalosController({ getReading, getDiagnosis } = {}) {
  const stateRef = useRef(createRoverState())
  const modeRef = useRef(stateRef.current.mode)
  const telemetryClock = useRef(0)

  const inspectionRef = useRef(createInspection())
  const [inspection, setInspection] = useState(inspectionRef.current)
  const inspectionStageRef = useRef(inspectionRef.current.stage)

  const [mode, setMode] = useState(stateRef.current.mode)
  const [telemetry, setTelemetry] = useState({
    battery: ROVER.startingCharge,
    remaining: 0,
    travelled: 0,
    targetZone: null,
    speed: 0,
    operatingSeconds: 0,
  })

  /** Live transform the scene reads each frame. */
  const rover = useRef({
    x: stateRef.current.x,
    z: stateRef.current.z,
    heading: stateRef.current.heading,
    wheelLeft: 0,
    wheelRight: 0,
    mode: stateRef.current.mode,
    phase: 'idle',
    speed: 0,
    /** Read by the spray to decide whether water is leaving the nozzle. */
    pumping: false,
  }).current

  /**
   * Mirrors the flight state onto the live `rover` object.
   *
   * Must run on every command, not only on the frame tick. The orchestrator
   * polls `rover.mode` between frames, so a command that changed the state but
   * left this mirror stale would be read as the *previous* mode — and a
   * deploy issued while the machine was still parked from the last zone looked
   * to the orchestrator like it had already arrived at the next one.
   */
  const syncRover = useCallback(
    (state) => {
      rover.x = state.x
      rover.z = state.z
      rover.heading = state.heading
      rover.wheelLeft = state.wheelLeft
      rover.wheelRight = state.wheelRight
      rover.mode = state.mode
      rover.phase = state.phase
      rover.speed = state.speed
    },
    [rover],
  )

  const publish = useCallback((state) => {
    setTelemetry({
      battery: state.battery,
      remaining: state.remaining,
      travelled: state.travelled,
      targetZone: state.targetZone,
      speed: state.speed,
      operatingSeconds: state.operatingSeconds ?? 0,
    })
  }, [])

  const deploy = useCallback(
    (route) => {
      // A new run clears the previous inspection, or the panel would show the
      // last zone's readings while driving to a different one.
      inspectionRef.current = createInspection()
      inspectionStageRef.current = 'idle'
      setInspection(inspectionRef.current)

      const next = commandDeploy(stateRef.current, route)
      stateRef.current = next
      syncRover(next)
      modeRef.current = next.mode
      setMode(next.mode)
      publish(next)
    },
    [publish],
  )

  /**
   * Walks the machine home from wherever it is standing.
   *
   * Plans a fresh route from the current position rather than reusing the
   * outbound one reversed — obstacles may have been toggled mid-mission, and
   * retracing a route that is no longer clear would drive it through a
   * blockage. Falls back to an instant recall only if no route home exists.
   */
  const returnToDepot = useCallback(
    (obstacleIds = []) => {
      const current = stateRef.current
      const route = planRoute({
        start: { x: current.x, z: current.z },
        targetPosition: DEPOT,
        obstacleIds,
      })

      if (!route.ok) {
        const snapped = commandRecall(current)
        stateRef.current = snapped
        syncRover(snapped)
        modeRef.current = snapped.mode
        setMode(snapped.mode)
        publish(snapped)
        return false
      }

      inspectionRef.current = createInspection()
      inspectionStageRef.current = 'idle'
      setInspection(inspectionRef.current)

      const next = commandReturn(current, route)
      stateRef.current = next
      syncRover(next)
      modeRef.current = next.mode
      setMode(next.mode)
      publish(next)
      return true
    },
    [publish, syncRover],
  )

  const recall = useCallback(() => {
    inspectionRef.current = createInspection()
    inspectionStageRef.current = 'idle'
    setInspection(inspectionRef.current)

    const next = commandRecall(stateRef.current)
    stateRef.current = next
    syncRover(next)
    modeRef.current = next.mode
    setMode(next.mode)
    publish(next)
  }, [publish])

  const update = useCallback(
    (delta) => {
      const next = stepRover(stateRef.current, delta)
      stateRef.current = next

      syncRover(next)

      // Arriving on the zone starts the inspection sequence.
      if (next.mode !== modeRef.current) {
        modeRef.current = next.mode

        if (next.mode === 'inspecting' && next.targetZone) {
          inspectionRef.current = beginInspection(
            next.targetZone,
            getReading?.(next.targetZone),
            getDiagnosis?.(next.targetZone),
          )
          inspectionStageRef.current = inspectionRef.current.stage
          setInspection(inspectionRef.current)
        }

        setMode(next.mode)
        publish(next)
        telemetryClock.current = 0
      }

      // Step the inspection while the rover is parked on the zone.
      if (next.mode === 'inspecting') {
        const nextInspection = stepInspection(inspectionRef.current, delta)
        inspectionRef.current = nextInspection
        rover.pumping = isPumping(nextInspection)

        // Publish on every stage change, and otherwise on the telemetry tick —
        // the moisture readout climbs continuously while the pump runs, and
        // only re-rendering at stage boundaries would leave it frozen.
        if (nextInspection.stage !== inspectionStageRef.current) {
          inspectionStageRef.current = nextInspection.stage
          setInspection(nextInspection)
        } else if (telemetryClock.current + delta >= TELEMETRY_INTERVAL) {
          setInspection(nextInspection)
        }
      } else {
        rover.pumping = false
      }

      telemetryClock.current += delta
      if (telemetryClock.current >= TELEMETRY_INTERVAL) {
        telemetryClock.current = 0
        publish(next)
      }
    },
    [publish, rover, getReading, getDiagnosis],
  )

  return useMemo(
    // `rover` and `inspectionRef` are the live handles the demo orchestrator
    // polls; `mode`, `telemetry` and `inspection` are the rendered snapshots.
    () => ({
      rover,
      inspectionRef,
      mode,
      telemetry,
      inspection,
      deploy,
      recall,
      returnToDepot,
      update,
    }),
    [rover, inspectionRef, mode, telemetry, inspection, deploy, recall, returnToDepot, update],
  )
}

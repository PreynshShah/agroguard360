import { useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  createFlightState,
  updateFlight,
  commandTakeOff,
  commandLand,
  FLIGHT_CONFIG,
} from '../systems/flightModel'
import { HOME_PAD } from '../systems/droneConfig'
import { steerToward } from '../systems/autopilot'

/** Rotor speed at full power, radians per second. */
const ROTOR_MAX_SPEED = 190

/**
 * useDroneController
 * The bridge between the pure flight model and the parts of the app that need
 * to see the aircraft.
 *
 * Two separate representations, on purpose:
 *
 *   - `flightRef` holds the model's immutable state, replaced each frame.
 *   - `craft` is one long-lived mutable object with a THREE.Vector3 position,
 *     rewritten in place every frame.
 *
 * The scene reads `craft`. Handing components a new object sixty times a
 * second would either force renders or leave them holding stale references;
 * one stable object they can keep a pointer to avoids both.
 *
 * Only `mode` — the discrete flight phase the buttons care about — reaches
 * React state.
 */
export function useDroneController() {
  const flightRef = useRef(createFlightState(HOME_PAD))
  const [mode, setMode] = useState(flightRef.current.mode)
  const modeRef = useRef(flightRef.current.mode)

  const input = useRef({ forward: 0, strafe: 0, yaw: 0 }).current

  /**
   * Autopilot waypoint. When set, it overrides the sticks — BUDDHI is flying,
   * and stray manual input mid-survey would fight it.
   */
  const waypointRef = useRef(null)

  const craft = useRef({
    position: new THREE.Vector3(HOME_PAD.x, FLIGHT_CONFIG.padAltitude, HOME_PAD.z),
    yaw: 0,
    pitch: 0,
    roll: 0,
    /** 0..1 */
    rpm: 0,
    /** Accumulated rotor rotation, so blades never jump between frames. */
    rotorAngle: 0,
    mode: flightRef.current.mode,
    /** Metres to the active waypoint, or null when hand-flown. */
    waypointDistance: null,
  }).current

  const syncMode = useCallback((next) => {
    if (next === modeRef.current) return
    modeRef.current = next
    setMode(next)
  }, [])

  const takeOff = useCallback(() => {
    flightRef.current = commandTakeOff(flightRef.current)
    syncMode(flightRef.current.mode)
  }, [syncMode])

  const land = useCallback(() => {
    flightRef.current = commandLand(flightRef.current)
    syncMode(flightRef.current.mode)
  }, [syncMode])

  const setInput = useCallback(
    (axis, value) => {
      input[axis] = value
    },
    [input],
  )

  const clearInput = useCallback(() => {
    input.forward = 0
    input.strafe = 0
    input.yaw = 0
  }, [input])

  /** Hands steering to the autopilot. Pass null to return control to the sticks. */
  const setWaypoint = useCallback(
    (target) => {
      waypointRef.current = target
      if (!target) {
        input.forward = 0
        input.strafe = 0
        input.yaw = 0
      }
    },
    [input],
  )

  /** Advances the model one frame and mirrors it onto `craft`. */
  const update = useCallback(
    (delta) => {
      // Under autopilot, the waypoint synthesises the same stick input a
      // person would hold — the flight model never learns the difference.
      let commanded = input
      const waypoint = waypointRef.current

      if (waypoint && flightRef.current.mode === 'hover') {
        const steer = steerToward(flightRef.current, waypoint, flightRef.current.yaw)
        commanded = { forward: steer.forward, strafe: steer.strafe, yaw: 0 }
        craft.waypointDistance = steer.distance
      } else {
        craft.waypointDistance = waypoint ? Infinity : null
      }

      const next = updateFlight(flightRef.current, delta, commanded)
      flightRef.current = next

      craft.position.set(next.x, next.y, next.z)
      craft.yaw = next.yaw
      craft.pitch = next.pitch
      craft.roll = next.roll
      craft.rpm = next.rpm
      craft.mode = next.mode
      craft.rotorAngle += next.rpm * ROTOR_MAX_SPEED * Math.min(delta, 0.1)

      syncMode(next.mode)
    },
    [craft, input, syncMode],
  )

  return useMemo(
    () => ({ craft, mode, takeOff, land, setInput, clearInput, setWaypoint, update }),
    [craft, mode, takeOff, land, setInput, clearInput, setWaypoint, update],
  )
}

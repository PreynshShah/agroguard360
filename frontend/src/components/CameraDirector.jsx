import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

import { FOCUS_VIEWS, FOCUS_TRANSITION } from '../systems/droneConfig'

/**
 * CameraDirector
 * Moves the camera between the three focus subjects.
 *
 * The hard part is coexisting with OrbitControls rather than fighting it.
 * Writing to camera.position while the controls also write to it produces a
 * camera that jitters or snaps back. So this drives the *controls* — it moves
 * `controls.target` and the camera together, and hands authority straight back
 * to the user the moment they touch the mouse.
 *
 * Two behaviours:
 *   - A transition: a timed move to the subject, which any user input cancels.
 *   - Tracking: after arriving at PEGASUS, the target keeps following the
 *     aircraft, so it stays framed while it flies. Orbiting and zooming still
 *     work throughout; the user is steering around a moving subject.
 */
export function CameraDirector({ focus, subjects, onFocusInterrupted }) {
  const { camera, controls } = useThree()

  const transition = useRef(null)
  const tracking = useRef(false)

  // Scratch vectors, allocated once. Creating vectors inside useFrame is the
  // classic way to hand the garbage collector 60 allocations a second.
  const scratch = useRef({
    subject: new THREE.Vector3(),
    desiredPos: new THREE.Vector3(),
    offset: new THREE.Vector3(),
  }).current

  /**
   * Where the current focus subject is right now.
   *
   * Subjects are looked up by name rather than special-cased, so adding a
   * vehicle to follow is a config entry and a map key, not another branch.
   * The two shapes differ — the drone carries a THREE.Vector3, the rover holds
   * plain x/z — so both are accepted rather than forcing one to change.
   */
  const resolveSubject = (mode, out) => {
    const view = FOCUS_VIEWS[mode]
    if (!view) return out.set(0, 1, 0)

    const subject = view.subject ? subjects?.[view.subject] : null
    if (subject) {
      const point = subject.position ?? subject
      return out.set(point.x ?? 0, (point.y ?? 0) + (view.lift ?? 0), point.z ?? 0)
    }

    return out.fromArray(view.target ?? [0, 1, 0])
  }

  // Begin a move whenever the requested focus changes.
  useEffect(() => {
    if (!focus || !controls) return

    const view = FOCUS_VIEWS[focus]
    if (!view) return

    resolveSubject(focus, scratch.subject)
    scratch.offset.fromArray(view.offset)

    transition.current = {
      mode: focus,
      elapsed: 0,
      fromTarget: controls.target.clone(),
      fromPosition: camera.position.clone(),
    }
    tracking.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, controls])

  // Any manual interaction ends the scripted move and returns control.
  useEffect(() => {
    if (!controls) return

    const release = () => {
      if (transition.current) {
        transition.current = null
        onFocusInterrupted?.()
      }
    }

    controls.addEventListener('start', release)
    return () => controls.removeEventListener('start', release)
  }, [controls, onFocusInterrupted])

  useFrame((_, delta) => {
    if (!controls) return
    const dt = Math.min(delta, 0.05)

    const move = transition.current

    if (move) {
      move.elapsed += dt
      const t = Math.min(1, move.elapsed / FOCUS_TRANSITION)
      // Smoothstep: leaves and arrives gently, no easing library needed.
      const eased = t * t * (3 - 2 * t)

      resolveSubject(move.mode, scratch.subject)
      scratch.desiredPos.copy(scratch.subject).add(scratch.offset)

      controls.target.lerpVectors(move.fromTarget, scratch.subject, eased)
      camera.position.lerpVectors(move.fromPosition, scratch.desiredPos, eased)
      controls.update()

      if (t >= 1) {
        tracking.current = Boolean(FOCUS_VIEWS[move.mode]?.tracking)
        tracking.subject = move.mode
        transition.current = null
      }
      return
    }

    // Sustained tracking: move only the target, never the camera. The user
    // keeps full orbit and zoom control while the subject moves under them.
    if (tracking.current && tracking.subject) {
      resolveSubject(tracking.subject, scratch.subject)
      const lambda = 1 - Math.exp(-4.5 * dt)
      controls.target.lerp(scratch.subject, lambda)
      controls.update()
    }
  })

  return null
}

import { useEffect } from 'react'

import { MODE_LABELS } from '../systems/flightModel'

/**
 * FlightControls
 * The pilot's panel: launch and recovery, plus manual steering while airborne.
 *
 * Directional input is held, not toggled — press and hold to move, release to
 * stop, which is how every real controller behaves. Pointer capture matters
 * here: without it, dragging off a button leaves the input stuck on and the
 * aircraft flies away on its own.
 */

/** Status colour per flight mode. Labels come from the flight model itself. */
const MODE_TONE = {
  idle: 'idle',
  takeoff: 'busy',
  hover: 'live',
  landing: 'busy',
}

export function FlightControls({ mode, scanning, onTakeOff, onLand, onInput, onClearInput }) {
  // Manual steering only while holding station — not mid-climb or mid-descent,
  // where pilot input would fight the automatic sequence.
  // While BUDDHI is flying the survey the autopilot owns the aircraft, so the
  // sticks are locked out rather than left to fight it.
  const airborne = mode === 'hover' && !scanning
  const canTakeOff = mode === 'idle' && !scanning
  const canLand = (mode === 'takeoff' || mode === 'hover') && !scanning
  const label = MODE_LABELS[mode] ?? MODE_LABELS.idle
  const tone = MODE_TONE[mode] ?? 'idle'

  // Keyboard flying, for anyone who would rather not chase buttons with a
  // mouse. Ignored while typing in a field.
  useEffect(() => {
    if (!airborne) return

    const keys = {
      KeyW: ['forward', -1],
      ArrowUp: ['forward', -1],
      KeyS: ['forward', 1],
      ArrowDown: ['forward', 1],
      KeyA: ['strafe', -1],
      ArrowLeft: ['strafe', -1],
      KeyD: ['strafe', 1],
      ArrowRight: ['strafe', 1],
      KeyQ: ['yaw', 1],
      KeyE: ['yaw', -1],
    }

    const isTyping = (event) =>
      event.target instanceof HTMLElement &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)

    const down = (event) => {
      const binding = keys[event.code]
      if (!binding || isTyping(event)) return
      event.preventDefault()
      onInput(binding[0], binding[1])
    }

    const up = (event) => {
      const binding = keys[event.code]
      if (!binding) return
      onInput(binding[0], 0)
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    // Releasing on blur prevents a held key surviving a tab switch.
    window.addEventListener('blur', onClearInput)

    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', onClearInput)
      onClearInput()
    }
  }, [airborne, onInput, onClearInput])

  const hold = (axis, value) => ({
    onPointerDown: (event) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      onInput(axis, value)
    },
    onPointerUp: () => onInput(axis, 0),
    onPointerCancel: () => onInput(axis, 0),
    onLostPointerCapture: () => onInput(axis, 0),
  })

  return (
    <section className="plate flight-panel" aria-label="Flight controls">
      <div className="flight-panel__head">
        <span className="flight-panel__title">Pegasus</span>
        <span className={`flight-panel__status flight-panel__status--${tone}`}>{label}</span>
      </div>

      <div className="flight-panel__commands">
        <button
          type="button"
          className="flight-btn flight-btn--launch"
          onClick={onTakeOff}
          disabled={!canTakeOff}
        >
          Take off
        </button>
        <button
          type="button"
          className="flight-btn flight-btn--recover"
          onClick={onLand}
          disabled={!canLand}
        >
          Land
        </button>
      </div>

      <div className={`flight-pad${airborne ? '' : ' flight-pad--locked'}`}>
        <button type="button" className="pad-btn pad-btn--fwd" disabled={!airborne} {...hold('forward', -1)} aria-label="Fly forward">
          ↑
        </button>
        <button type="button" className="pad-btn pad-btn--left" disabled={!airborne} {...hold('strafe', -1)} aria-label="Fly left">
          ←
        </button>
        <button type="button" className="pad-btn pad-btn--right" disabled={!airborne} {...hold('strafe', 1)} aria-label="Fly right">
          →
        </button>
        <button type="button" className="pad-btn pad-btn--back" disabled={!airborne} {...hold('forward', 1)} aria-label="Fly backward">
          ↓
        </button>

        <button type="button" className="pad-btn pad-btn--yawl" disabled={!airborne} {...hold('yaw', 1)} aria-label="Rotate left">
          ⟲
        </button>
        <button type="button" className="pad-btn pad-btn--yawr" disabled={!airborne} {...hold('yaw', -1)} aria-label="Rotate right">
          ⟳
        </button>
      </div>

      <p className="flight-panel__hint">
        {scanning
          ? 'BUDDHI is flying the survey.'
          : airborne
            ? 'Hold a control, or fly with W A S D and Q E.'
            : 'Controls unlock once airborne.'}
      </p>
    </section>
  )
}

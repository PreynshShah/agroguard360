/**
 * inspection.js
 * What TALOS does once it has stopped on a zone.
 *
 * A sequence, not a single event: settle and sample, report the readings,
 * decide, act, report what it used. Each stage has a real duration, because a
 * rover that arrives and instantly announces a completed treatment gives the
 * operator nothing to read and no sense that anything was measured.
 *
 * ---------------------------------------------------------------------------
 * These readings are SIMULATED
 * ---------------------------------------------------------------------------
 * Nothing here touches hardware. Values are derived from the same synthetic
 * field state BUDDHI surveyed, plus a small measurement error to represent
 * sensor tolerance. The interface labels them as simulated, and so does this
 * file, because a moisture figure that looks like an instrument reading is
 * exactly the kind of number someone later mistakes for a real one.
 *
 * To connect real sensors, replace `sampleSensors` with a call to the
 * hardware. Everything downstream — the threshold, the decision, the pump
 * cycle — works unchanged on whatever it returns.
 */

/** Below this soil moisture, the zone needs water. */
export const MOISTURE_THRESHOLD = 40

/** Moisture the pump is trying to reach. */
export const TARGET_MOISTURE = 46

export const INSPECTION = {
  /** Seconds spent settling and letting the probe stabilise before reporting. */
  samplingSeconds: 2.6,
  /** Pause between showing the readings and announcing the decision. */
  decidingSeconds: 1.2,

  /** Pump output. */
  pumpMlPerSecond: 11,
  /**
   * How fast moisture responds to watering, per second.
   *
   * The rise is exponential toward the target rather than linear, because that
   * is how wetting a soil column actually behaves: dry soil takes water
   * quickly, and the closer it gets to field capacity the more of each further
   * millilitre runs off or drains past the root zone.
   */
  wettingRate: 0.35,
  /** Stop once within this much of the target. */
  moistureTolerance: 0.5,
  /** Hard cap, so a pathological reading cannot run the pump forever. */
  maxPumpSeconds: 25,

  /** Seconds the completion summary stays before the rover is free again. */
  reportSeconds: 3,
}

/** Stage labels for the interface. */
export const INSPECTION_STAGES = {
  idle: 'Standby',
  sampling: 'Sampling',
  reading: 'Readings captured',
  deciding: 'Analysing',
  irrigating: 'Irrigating',
  complete: 'Treatment complete',
  none: 'No action required',
}

/* ------------------------------------------------------------------ *
 * Sensors
 * ------------------------------------------------------------------ */

/** Deterministic per-zone jitter, so repeat inspections agree with each other. */
function zoneNoise(zoneId, salt) {
  let hash = salt
  for (let i = 0; i < zoneId.length; i++) hash = (hash * 31 + zoneId.charCodeAt(i)) >>> 0
  return ((hash % 1000) / 1000 - 0.5) * 2 // -1 … 1
}

/**
 * Takes a contact reading of a zone.
 *
 * TALOS samples the ground directly, where BUDDHI inferred the same quantities
 * from the air, so the two agree closely but not exactly. That gap is the
 * point: identical numbers would mean the ground sensors were not measuring
 * anything, only echoing the aerial estimate back.
 *
 * @param {object} reading a record from zoneAgronomy
 * @returns {{soilMoisture:number, temperature:number, humidity:number, simulated:true}}
 */
export function sampleSensors(reading) {
  if (!reading) return null

  const id = reading.zoneId

  return {
    zoneId: id,
    cropType: reading.cropType,
    // Probe tolerance: ±1.5% moisture, ±0.4 °C, ±2% RH.
    soilMoisture: round1(reading.soilMoisture + zoneNoise(id, 7) * 1.5),
    temperature: round1(reading.temperature + zoneNoise(id, 13) * 0.4),
    humidity: Math.round(reading.humidity + zoneNoise(id, 29) * 2),
    /** Never omitted, and never false. Downstream code renders the label from it. */
    simulated: true,
  }
}

/**
 * The action rule.
 *
 * Only water stress is actionable by this rover — it carries a tank and a
 * nozzle, not a sprayer or a mechanical weeder. Disease and pest damage are
 * reported for a person to deal with rather than quietly ignored, because
 * "no action" and "not something I can treat" are different statements.
 */
export function decideAction(sensors, diagnosis) {
  if (!sensors) return { action: 'none', reason: 'No readings available.' }

  if (sensors.soilMoisture < MOISTURE_THRESHOLD) {
    return {
      action: 'irrigate',
      label: 'Targeted irrigation',
      reason: `Soil moisture ${sensors.soilMoisture}% is below the ${MOISTURE_THRESHOLD}% threshold.`,
    }
  }

  if (diagnosis && diagnosis.problem !== 'healthy' && diagnosis.problem !== 'water_stress') {
    return {
      action: 'refer',
      label: 'Refer to agronomist',
      reason: 'Condition is not treatable with water — flag for manual inspection.',
    }
  }

  return {
    action: 'none',
    label: 'No action required',
    reason: `Soil moisture ${sensors.soilMoisture}% is within range.`,
  }
}

/* ------------------------------------------------------------------ *
 * State machine
 * ------------------------------------------------------------------ */

export function createInspection() {
  return {
    stage: 'idle',
    zoneId: null,
    elapsed: 0,
    sensors: null,
    decision: null,
    /** Live moisture, which climbs while the pump runs. */
    moisture: null,
    startMoisture: null,
    waterUsedMl: 0,
    /** Seconds the pump actually ran. */
    treatmentSeconds: 0,
    /** Seconds spent parked on the zone, sampling included. */
    inspectionSeconds: 0,
    pumpOn: false,
    completedAt: null,
  }
}

/** Begins an inspection of a zone. */
export function beginInspection(zoneId, reading, diagnosis) {
  const sensors = sampleSensors(reading)

  return {
    stage: 'sampling',
    zoneId,
    elapsed: 0,
    // Held back until sampling finishes — showing readings the instant it
    // arrives would imply an instrument that needs no settling time.
    sensors,
    pendingDiagnosis: diagnosis ?? null,
    decision: null,
    moisture: sensors ? sensors.soilMoisture : null,
    startMoisture: sensors ? sensors.soilMoisture : null,
    waterUsedMl: 0,
    treatmentSeconds: 0,
    inspectionSeconds: 0,
    pumpOn: false,
    completedAt: null,
  }
}

/**
 * Advances the inspection by one frame.
 * @returns {object} next state
 */
export function stepInspection(state, rawDt) {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 0.1) : 0
  if (state.stage === 'idle' || state.stage === 'complete' || state.stage === 'none') {
    return state
  }

  const next = {
    ...state,
    elapsed: state.elapsed + dt,
    inspectionSeconds: (state.inspectionSeconds ?? 0) + dt,
  }

  if (next.stage === 'sampling') {
    if (next.elapsed >= INSPECTION.samplingSeconds) {
      next.stage = 'reading'
      next.elapsed = 0
    }
    return next
  }

  if (next.stage === 'reading') {
    // Readings are on screen; give them a beat before deciding.
    if (next.elapsed >= INSPECTION.decidingSeconds) {
      next.decision = decideAction(next.sensors, next.pendingDiagnosis)
      next.stage = next.decision.action === 'irrigate' ? 'irrigating' : 'none'
      next.pumpOn = next.decision.action === 'irrigate'
      next.elapsed = 0
      next.completedAt = next.stage === 'none' ? Date.now() : null
    }
    return next
  }

  if (next.stage === 'irrigating') {
    // Exponential approach to the target — quick at first, easing off as the
    // soil nears field capacity.
    const gap = TARGET_MOISTURE - next.moisture
    const rise = gap * INSPECTION.wettingRate * dt

    // Accumulated at full precision, and rounded only for display.
    //
    // Rounding here instead is a trap worth naming: the per-frame rise falls
    // as the gap closes, and once it drops below half a display unit, rounding
    // the running total snaps it straight back and the value stops moving
    // entirely — the moisture stalls short of target and the pump runs to its
    // timeout. The same mistake zeroes the water counter, since 11 ml/s over a
    // 60th of a second rounds to nothing on every single frame.
    next.moisture = next.moisture + rise
    next.waterUsedMl = next.waterUsedMl + INSPECTION.pumpMlPerSecond * dt
    next.treatmentSeconds = (next.treatmentSeconds ?? 0) + dt

    const reached = TARGET_MOISTURE - next.moisture <= INSPECTION.moistureTolerance
    const timedOut = next.elapsed >= INSPECTION.maxPumpSeconds

    if (reached || timedOut) {
      // Settle on a clean value once, at the end, where it cannot affect the
      // integration.
      next.moisture = round1(Math.min(next.moisture, TARGET_MOISTURE))
      next.waterUsedMl = Math.round(next.waterUsedMl)
      next.pumpOn = false
      next.stage = 'complete'
      next.completedAt = Date.now()
      next.elapsed = 0
    }

    return next
  }

  return next
}

/** True while water should be visibly leaving the nozzle. */
export function isPumping(state) {
  return state?.stage === 'irrigating' && state.pumpOn
}

/** Moisture gained over the treatment. */
export function moistureGain(state) {
  if (state?.startMoisture == null || state?.moisture == null) return 0
  return round1(state.moisture - state.startMoisture)
}

const round1 = (v) => Math.round(v * 10) / 10

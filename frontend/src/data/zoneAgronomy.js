import { ZONES } from '../systems/farmLayout'
import { makeRandom } from '../systems/farmLayout'

/**
 * zoneAgronomy.js
 * The measurements BUDDHI reads from each of the sixteen zones.
 *
 * The important architectural point: a zone record holds *observations*, not
 * conclusions. Soil moisture, air temperature, humidity, canopy temperature,
 * vegetation index, lesion index and canopy loss are all things a sensor or a
 * camera could actually produce. `problem` and `severity` start empty and are
 * filled in only by a scan.
 *
 * That matters because the alternative — storing the answer on the record and
 * having the classifier read it back — would make BUDDHI a lookup dressed up
 * as an inference. Nothing would break when a real model was connected, but
 * nothing would be tested either. Here the classifier genuinely has to derive
 * the diagnosis from the numbers, so a trained model can replace it and be
 * judged on the same inputs.
 *
 * `_condition` is the underlying field state used to synthesise plausible
 * readings. It is the ground truth, deliberately prefixed and never read by
 * BUDDHI — it exists so the simulation is coherent, and so the classifier can
 * be scored against it in testing.
 */

/**
 * The field's actual state, zone by zone.
 *
 * Written out explicitly rather than randomised: the scene should tell the
 * same story on every load, all four classes need to be represented, and a
 * random draw can easily produce sixteen healthy zones and nothing to look at.
 */
const FIELD_CONDITIONS = {
  A1: { crop: 'Cotton', condition: 'healthy', severity: 'none' },
  A2: { crop: 'Cotton', condition: 'healthy', severity: 'none' },
  A3: { crop: 'Cotton', condition: 'pest_damage', severity: 'low' },
  A4: { crop: 'Groundnut', condition: 'healthy', severity: 'none' },

  B1: { crop: 'Tomato', condition: 'healthy', severity: 'none' },
  B2: { crop: 'Tomato', condition: 'water_stress', severity: 'high' },
  B3: { crop: 'Tomato', condition: 'healthy', severity: 'none' },
  B4: { crop: 'Groundnut', condition: 'water_stress', severity: 'medium' },

  C1: { crop: 'Wheat', condition: 'healthy', severity: 'none' },
  C2: { crop: 'Wheat', condition: 'pest_damage', severity: 'medium' },
  C3: { crop: 'Tomato', condition: 'disease', severity: 'medium' },
  C4: { crop: 'Tomato', condition: 'disease', severity: 'low' },

  D1: { crop: 'Groundnut', condition: 'healthy', severity: 'none' },
  D2: { crop: 'Wheat', condition: 'healthy', severity: 'none' },
  D3: { crop: 'Cotton', condition: 'water_stress', severity: 'low' },
  D4: { crop: 'Groundnut', condition: 'pest_damage', severity: 'high' },
}

/** How strongly a condition expresses itself, by severity. */
const INTENSITY = { none: 0, low: 0.34, medium: 0.64, high: 0.92 }

/** Ambient conditions for the site — an Indian summer growing season. */
const AMBIENT = { temperature: 31.5, humidity: 58 }

/**
 * Builds one zone's readings from its underlying condition.
 *
 * Each condition pushes a different combination of measurements, which is
 * exactly what makes the four classes separable. If water stress and disease
 * both only moved soil moisture, no classifier — simulated or trained — could
 * tell them apart.
 */
function synthesiseReadings(zoneId, spec, random) {
  const t = INTENSITY[spec.severity]
  const jitter = (spread) => (random() - 0.5) * spread

  // Baselines for a well-watered, unstressed crop.
  let soilMoisture = 44 + jitter(7)
  let temperature = AMBIENT.temperature + jitter(1.8)
  let humidity = AMBIENT.humidity + jitter(7)
  let canopyDelta = -0.6 + jitter(1.1) // healthy canopies transpire and run cool
  let ndvi = 0.79 + jitter(0.07)
  let lesionIndex = 0.05 + Math.abs(jitter(0.08))
  let canopyLoss = 0.03 + Math.abs(jitter(0.05))

  if (spec.condition === 'water_stress') {
    // Dry soil, and a canopy that has stopped cooling itself.
    soilMoisture = 40 - t * 22 + jitter(3)
    canopyDelta = 0.4 + t * 5.4 + jitter(0.8)
    ndvi = 0.78 - t * 0.24 + jitter(0.04)
    humidity = AMBIENT.humidity - t * 12 + jitter(5)
  } else if (spec.condition === 'disease') {
    // Lesions spreading under humid air; soil moisture is unremarkable.
    lesionIndex = 0.12 + t * 0.68 + jitter(0.06)
    humidity = AMBIENT.humidity + t * 26 + jitter(4)
    ndvi = 0.78 - t * 0.2 + jitter(0.04)
    canopyDelta = -0.2 + t * 1.1 + jitter(0.7)
  } else if (spec.condition === 'pest_damage') {
    // Canopy eaten away, with moisture and humidity both normal — the absence
    // of the other signals is itself the signal.
    canopyLoss = 0.08 + t * 0.52 + jitter(0.05)
    ndvi = 0.77 - t * 0.26 + jitter(0.04)
    lesionIndex = 0.04 + t * 0.1 + jitter(0.04)
  }

  const canopyTemperature = temperature + canopyDelta

  // A single headline figure for the interface, penalised by each stressor.
  const health = Math.round(
    clamp(
      100 -
        Math.max(0, 38 - soilMoisture) * 1.5 -
        Math.max(0, canopyDelta) * 4.2 -
        lesionIndex * 52 -
        canopyLoss * 62,
      8,
      99,
    ),
  )

  return {
    zoneId,
    cropType: spec.crop,
    health,
    soilMoisture: round1(clamp(soilMoisture, 8, 68)),
    temperature: round1(temperature),
    humidity: Math.round(clamp(humidity, 18, 96)),
    canopyTemperature: round1(canopyTemperature),
    /** Canopy minus air temperature — the standard water-stress indicator. */
    canopyDelta: round1(canopyDelta),
    ndvi: round2(clamp(ndvi, 0.16, 0.95)),
    lesionIndex: round2(clamp(lesionIndex, 0, 1)),
    canopyLoss: round2(clamp(canopyLoss, 0, 1)),

    /** Filled in by a BUDDHI scan; null until one has run. */
    problem: null,
    severity: null,
    confidence: null,
    scannedAt: null,

    /** Ground truth. Never read by the classifier — see the file header. */
    _condition: spec.condition,
    _trueSeverity: spec.severity,
  }
}

/**
 * Builds the full dataset, one record per zone, in the field's own order.
 * Seeded, so the readings are identical on every reload.
 */
export function createZoneData(seed = 20260815) {
  const random = makeRandom(seed)
  const records = {}

  for (const zone of ZONES) {
    const spec = FIELD_CONDITIONS[zone.id] ?? {
      crop: 'Cotton',
      condition: 'healthy',
      severity: 'none',
    }
    records[zone.id] = synthesiseReadings(zone.id, spec, random)
  }

  return records
}

/** The zone ids in survey order — west to east along each row, north to south. */
export const SCAN_ORDER = ZONES.map((zone) => zone.id)

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const round1 = (v) => Math.round(v * 10) / 10
const round2 = (v) => Math.round(v * 100) / 100

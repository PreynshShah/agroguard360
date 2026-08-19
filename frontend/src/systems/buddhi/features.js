/**
 * features.js
 * Turns a zone's raw readings into a normalised feature vector.
 *
 * This is the seam a real model plugs into. A trained network cannot take a
 * record with fields called `soilMoisture` and `humidity` in mixed units — it
 * takes an ordered array of numbers, scaled to a consistent range. Doing that
 * conversion here, rather than inside the classifier, means the simulated model
 * and a future trained one consume byte-identical input.
 *
 * FEATURE_NAMES is the contract. If a trained model is built against this
 * project, it must be trained on features in exactly this order.
 */

export const FEATURE_NAMES = [
  'soilMoistureNorm', // 0 dry … 1 saturated
  'canopyDeltaNorm', // canopy minus air temperature, 0 cool … 1 very hot
  'humidityNorm', // 0 arid … 1 saturated air
  'ndviNorm', // 0 bare … 1 dense healthy canopy
  'lesionNorm', // 0 clean … 1 heavily lesioned
  'canopyLossNorm', // 0 intact … 1 stripped
]

/** Ranges used for scaling. Chosen from field plausibility, not from the data. */
const RANGES = {
  soilMoisture: [10, 60],
  canopyDelta: [-2, 7],
  humidity: [20, 95],
  ndvi: [0.15, 0.9],
  lesionIndex: [0, 1],
  canopyLoss: [0, 1],
}

const norm = (value, [lo, hi]) => clamp((value - lo) / (hi - lo), 0, 1)

/**
 * @param {object} reading a record from zoneAgronomy
 * @returns {number[]} values in 0..1, ordered to match FEATURE_NAMES
 */
export function extractFeatures(reading) {
  return [
    norm(reading.soilMoisture, RANGES.soilMoisture),
    norm(reading.canopyDelta, RANGES.canopyDelta),
    norm(reading.humidity, RANGES.humidity),
    norm(reading.ndvi, RANGES.ndvi),
    norm(reading.lesionIndex, RANGES.lesionIndex),
    norm(reading.canopyLoss, RANGES.canopyLoss),
  ]
}

/** Named form, for display and debugging. */
export function describeFeatures(vector) {
  return Object.fromEntries(FEATURE_NAMES.map((name, i) => [name, round3(vector[i])]))
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const round3 = (v) => Math.round(v * 1000) / 1000

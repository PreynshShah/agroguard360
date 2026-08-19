import { CLASS_ORDER } from './classes'

/**
 * simulatedModel.js
 * The stand-in classifier.
 *
 * It scores each class from the feature vector, then converts those scores to
 * probabilities with a softmax — the same output shape a trained classifier
 * produces. That shape is the whole point: the confidence figures shown in the
 * interface are real probabilities over four classes that sum to one, not a
 * decorative number attached to a hard-coded answer.
 *
 * The scoring itself is agronomy written as arithmetic. Each class responds to
 * the signals that actually distinguish it in the field:
 *
 *   water stress  dry soil AND a canopy running hot — either alone is weak
 *                 evidence, together they are strong
 *   disease       lesions, amplified by humid air, which is what spreads them
 *   pest damage   canopy missing WITHOUT lesions or dryness to explain it
 *   healthy       the absence of all of the above
 *
 * The `AND` relationships are why this is multiplicative rather than a sum of
 * independent weights. A linear model cannot express "dry soil only matters if
 * the canopy is also hot", and that interaction is what separates water stress
 * from a zone that is simply on lighter soil.
 */

/** Sharpness of the softmax. Higher makes the model more decisive. */
const TEMPERATURE = 4.5

/**
 * Uncertainty floor — a little probability mass spread evenly across all four
 * classes before the result is reported.
 *
 * Without it this model returns 100% confidence, because the synthetic
 * readings are cleanly separable in a way real field data never is. A system
 * that claims total certainty about a living crop is one an agronomist should
 * distrust, and the number stops carrying information once it is pinned at the
 * ceiling. This is standard label smoothing: it caps confidence near 95%,
 * leaves the ranking of classes untouched, and keeps the figure meaningful.
 */
const UNCERTAINTY_FLOOR = 0.06

export function scoreClasses(features) {
  const [moisture, canopyDelta, humidity, ndvi, lesion, canopyLoss] = features

  // Re-expressed as "how much of this stressor is present", 0..1.
  const dryness = 1 - moisture
  const canopyHeat = canopyDelta
  const vigourLoss = 1 - ndvi

  // Dry soil and a hot canopy reinforce each other.
  const waterScore = dryness * 0.55 + canopyHeat * 0.5 + dryness * canopyHeat * 1.15 + vigourLoss * 0.2

  // Lesions are the primary signal; humidity is the multiplier.
  const diseaseScore = lesion * 1.35 + lesion * humidity * 0.85 + vigourLoss * 0.18

  // Canopy loss counts only where the other explanations are absent — that
  // subtraction is the model's way of ruling out the alternatives.
  const pestScore =
    canopyLoss * 1.9 + vigourLoss * 0.3 - lesion * 0.75 - dryness * canopyHeat * 0.5

  // Healthy scores on the absence of everything else. Its tolerance for canopy
  // loss is deliberately tight: early pest damage is mild by definition, and a
  // forgiving healthy score swallows exactly the cases worth catching early.
  const healthyScore =
    0.35 +
    moisture * 0.35 +
    ndvi * 0.5 -
    lesion * 0.8 -
    canopyLoss * 1.15 -
    canopyHeat * 0.55 -
    dryness * 0.3

  return {
    healthy: healthyScore,
    water_stress: waterScore,
    disease: diseaseScore,
    pest_damage: pestScore,
  }
}

/**
 * Softmax over the class scores.
 * The maximum is subtracted before exponentiating — standard practice, and it
 * prevents an overflow to Infinity that would turn every probability into NaN.
 */
export function softmax(scores) {
  const values = CLASS_ORDER.map((id) => scores[id] * TEMPERATURE)
  const max = Math.max(...values)
  const exps = values.map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)

  const floor = UNCERTAINTY_FLOOR / CLASS_ORDER.length
  return Object.fromEntries(
    CLASS_ORDER.map((id, i) => [id, (1 - UNCERTAINTY_FLOOR) * (exps[i] / sum) + floor]),
  )
}

/**
 * Classifies one feature vector.
 * @returns {{label:string, confidence:number, probabilities:Record<string,number>}}
 */
export function classify(features) {
  const probabilities = softmax(scoreClasses(features))

  let label = CLASS_ORDER[0]
  for (const id of CLASS_ORDER) {
    if (probabilities[id] > probabilities[label]) label = id
  }

  return { label, confidence: probabilities[label], probabilities }
}

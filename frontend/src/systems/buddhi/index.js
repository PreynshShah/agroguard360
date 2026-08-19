import { CLASS_ORDER, SEVERITY, isProblem } from './classes'
import { extractFeatures, describeFeatures, FEATURE_NAMES } from './features'
import { classify } from './simulatedModel'

/**
 * BUDDHI — the crop-health analysis engine.
 *
 * This file is the only thing the rest of the application talks to. It takes a
 * zone reading and returns a diagnosis; how that diagnosis is reached is
 * entirely behind the facade.
 *
 * ---------------------------------------------------------------------------
 * Connecting a real model
 * ---------------------------------------------------------------------------
 * `analyze` is async and returns a promise, even though the simulated backend
 * answers instantly. That is deliberate. A real model — ONNX Runtime Web,
 * TensorFlow.js, or an inference endpoint over HTTP — is unavoidably
 * asynchronous, and every call site here already awaits. Making the interface
 * synchronous now would mean rewriting the scan orchestration, the interface
 * and the progress reporting later, purely to add an `await`.
 *
 * A replacement backend needs to satisfy one contract:
 *
 *   async predict(features: number[]) => { [classId]: probability }
 *
 * where `features` is ordered per FEATURE_NAMES and the returned probabilities
 * cover CLASS_ORDER and sum to 1. For example:
 *
 *   import * as ort from 'onnxruntime-web'
 *
 *   const session = await ort.InferenceSession.create('/models/buddhi.onnx')
 *
 *   async function predict(features) {
 *     const input = new ort.Tensor('float32', Float32Array.from(features), [1, 6])
 *     const { output } = await session.run({ input })
 *     return Object.fromEntries(CLASS_ORDER.map((id, i) => [id, output.data[i]]))
 *   }
 *
 *   export const buddhi = createBuddhiEngine({ backend: { name: 'onnx', predict } })
 *
 * Severity derivation, result shaping and everything downstream stay as they
 * are — a trained model only has to produce the probabilities.
 */

/** The default backend: the rule-based stand-in. */
const simulatedBackend = {
  name: 'simulated',
  version: '1.0.0',
  trained: false,
  async predict(features) {
    return classify(features).probabilities
  },
}

/**
 * Severity from the evidence, not from a stored label.
 *
 * Two things drive it: how confident the model is, and how far the driving
 * measurement actually sits from normal. Confidence alone is not enough — a
 * model can be certain about a mild problem, and reporting that as High would
 * send someone across the farm for nothing.
 */
export function deriveSeverity(classId, confidence, reading) {
  if (!isProblem(classId)) return SEVERITY.none.id

  let magnitude = 0

  if (classId === 'water_stress') {
    // Deficit below the comfortable floor, plus canopy heating.
    const deficit = Math.max(0, 36 - reading.soilMoisture) / 24
    const heat = Math.max(0, reading.canopyDelta) / 6
    magnitude = deficit * 0.6 + heat * 0.4
  } else if (classId === 'disease') {
    magnitude = reading.lesionIndex
  } else if (classId === 'pest_damage') {
    magnitude = reading.canopyLoss / 0.6
  }

  // Weight the observation over the model's self-assessment.
  const score = magnitude * 0.72 + confidence * 0.28

  if (score >= 0.72) return SEVERITY.high.id
  if (score >= 0.5) return SEVERITY.medium.id
  return SEVERITY.low.id
}

/**
 * Creates an engine instance.
 * @param {{backend?: {name:string, predict:Function}}} options
 */
export function createBuddhiEngine({ backend = simulatedBackend } = {}) {
  return {
    /** Describes the active backend, for the interface to be honest about it. */
    describe() {
      return {
        name: backend.name,
        version: backend.version ?? 'n/a',
        trained: backend.trained ?? false,
        features: FEATURE_NAMES,
        classes: CLASS_ORDER,
      }
    },

    /**
     * Analyses one zone reading.
     * @returns {Promise<object>} diagnosis, ready to merge onto the record
     */
    async analyze(reading) {
      const features = extractFeatures(reading)
      const probabilities = await backend.predict(features)

      let label = CLASS_ORDER[0]
      for (const id of CLASS_ORDER) {
        if (probabilities[id] > probabilities[label]) label = id
      }

      const confidence = probabilities[label]
      const severity = deriveSeverity(label, confidence, reading)

      return {
        zoneId: reading.zoneId,
        problem: label,
        severity,
        confidence,
        probabilities,
        features: describeFeatures(features),
        scannedAt: Date.now(),
      }
    },
  }
}

/** The shared instance the application uses. */
export const buddhi = createBuddhiEngine()

export { CLASS_ORDER, FEATURE_NAMES }

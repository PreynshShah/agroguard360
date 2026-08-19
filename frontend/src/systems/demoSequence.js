/**
 * demoSequence.js
 * The ten steps of the full demonstration, as data.
 *
 * Declared once and read by both the runner and the interface. If the step
 * list lived inside the async function that executes it, the progress tracker
 * would need its own copy, and the two would drift the first time a step was
 * renamed or reordered.
 */

export const DEMO_STEPS = [
  { id: 'monitor', number: 1, label: 'Monitor', detail: 'PEGASUS surveys the field' },
  { id: 'detect', number: 2, label: 'Detect', detail: 'BUDDHI classifies each zone' },
  { id: 'prioritize', number: 3, label: 'Prioritize', detail: 'Rank problems by severity' },
  { id: 'optimize', number: 4, label: 'Optimize', detail: 'PROMETHIA plans the route' },
  { id: 'navigate', number: 5, label: 'Navigate', detail: 'TALOS drives to the zone' },
  { id: 'inspect', number: 6, label: 'Inspect', detail: 'Ground sensors sample the soil' },
  { id: 'act', number: 7, label: 'Act', detail: 'Targeted irrigation if required' },
  { id: 'repeat', number: 8, label: 'Repeat', detail: 'Next zone, then return to depot' },
  { id: 'measure', number: 9, label: 'Measure', detail: 'MERCATUS reports the session' },
  { id: 'complete', number: 10, label: 'Complete', detail: 'Mission summary' },
]

/** The headline chain, shown on the completion card. */
export const PIPELINE = [
  'Monitor',
  'Detect',
  'Prioritize',
  'Optimize',
  'Navigate',
  'Inspect',
  'Act',
  'Measure',
]

export const DEMO_CONFIG = {
  /**
   * How many problem zones the full demo visits.
   *
   * Not all of them, deliberately. A survey plus eight treatments runs past
   * eleven minutes at the vehicles' real speeds — far longer than anyone
   * watches a demonstration, and the extra zones repeat cases already shown.
   *
   * Two is the smallest number that still demonstrates both outcomes: the
   * highest-priority zones are one water-stress zone, which gets irrigated,
   * and one pest-damage zone, which is referred rather than watered. That
   * contrast is the point of the ACT step, so cutting to one would hide it.
   *
   * Raise this to work more of the field; each additional zone adds roughly
   * ninety seconds.
   */
  zoneLimit: 2,

  /** Beats between steps, so each stage is readable rather than a flicker. */
  beatShort: 900,
  beatMedium: 1600,
  beatLong: 2400,
}

export function getStep(id) {
  return DEMO_STEPS.find((step) => step.id === id) ?? null
}

export function stepIndex(id) {
  return DEMO_STEPS.findIndex((step) => step.id === id)
}

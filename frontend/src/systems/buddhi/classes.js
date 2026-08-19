/**
 * classes.js
 * The conditions BUDDHI can report, and how each one presents itself.
 *
 * Kept apart from both the model and the renderer so that swapping the
 * simulated classifier for a real one changes nothing about how results are
 * labelled or drawn — a trained model only has to emit these same four keys.
 */

export const CLASSES = {
  healthy: {
    id: 'healthy',
    label: 'Healthy',
    /** Muted sage. Healthy zones get no marker, so this is only used in lists. */
    color: '#5f7d4e',
    marker: null,
    blurb: 'No stress indicators above threshold.',
  },
  water_stress: {
    id: 'water_stress',
    label: 'Water Stress',
    /** Dry ochre — the colour of the problem itself. */
    color: '#b8863f',
    marker: 'droplet',
    blurb: 'Low soil moisture with canopy temperature above ambient.',
  },
  disease: {
    id: 'disease',
    label: 'Disease',
    /** Dull violet. Deliberately not red: red reads as an alarm, and disease
        pressure is a diagnosis, not an emergency. */
    color: '#7a6191',
    marker: 'lesion',
    blurb: 'Leaf lesion index elevated under humid conditions.',
  },
  pest_damage: {
    id: 'pest_damage',
    label: 'Pest Damage',
    /** Brick, suggesting chewed and browning foliage. */
    color: '#a24f3f',
    marker: 'chew',
    blurb: 'Canopy loss inconsistent with moisture or disease indicators.',
  },
}

/** Stable order for anything that iterates the classes — model outputs included. */
export const CLASS_ORDER = ['healthy', 'water_stress', 'disease', 'pest_damage']

export const SEVERITY = {
  none: { id: 'none', label: 'None', rank: 0 },
  low: { id: 'low', label: 'Low', rank: 1 },
  medium: { id: 'medium', label: 'Medium', rank: 2 },
  high: { id: 'high', label: 'High', rank: 3 },
}

export const SEVERITY_ORDER = ['none', 'low', 'medium', 'high']

/** True for every class except healthy. */
export function isProblem(classId) {
  return classId !== 'healthy'
}

export function getClass(classId) {
  return CLASSES[classId] ?? CLASSES.healthy
}

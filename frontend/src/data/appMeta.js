/**
 * appMeta.js
 * Copy and identifiers shown in the interface. Kept out of the components so
 * wording can change without touching layout.
 */

export const APP_META = {
  name: 'AGROGUARD',
  figure: '360',
  tagline: 'AI-Powered Smart Agriculture & Autonomous Crop-Care System',
  station: 'Field Station 01',
  phase: 'Phase 1 — Foundation',
}

/**
 * View controls, described by what the person does rather than by the
 * OrbitControls API that implements them.
 */
export const VIEW_CONTROLS = [
  { input: 'Drag', result: 'Orbit around the field' },
  { input: 'Scroll', result: 'Zoom in and out' },
  { input: 'Right-drag', result: 'Pan across the ground' },
  { input: 'Two fingers', result: 'Zoom and pan on touch' },
]

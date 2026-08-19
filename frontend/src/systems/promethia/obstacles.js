import { BLOCK_WIDTH, BLOCK_DEPTH, FIELD } from '../farmLayout'

/**
 * obstacles.js
 * Things standing in the robot's way.
 *
 * Two kinds. Fixed obstacles are the scene's own permanent structures — the
 * water tank stands where it stands, and no route may pass through it.
 * Situational obstacles are the ones an operator toggles: a trailer left
 * across a track, a flooded corner, a section closed for irrigation repair.
 *
 * Both are rectangles in world metres rather than lists of cells. That is how
 * they actually arrive — an object has a position and an extent, and which
 * cells it covers is a consequence of the grid, not a property of the object.
 * Change the cell size and these stay correct.
 */

const trackX = (index) => (index - (FIELD.cols.length - 1) / 2 + 0.5) * (FIELD.zoneWidth + FIELD.pathWidth)
const trackZ = (index) => (index - (FIELD.rows.length - 1) / 2 + 0.5) * (FIELD.zoneDepth + FIELD.pathWidth)

/**
 * Permanent structures. These match objects actually standing in the scene,
 * so a route never appears to drive through the water tank.
 */
export const FIXED_OBSTACLES = [
  {
    id: 'water-tank',
    label: 'Water tank',
    kind: 'structure',
    x: BLOCK_WIDTH / 2 + FIELD.borderWidth - 1,
    z: -BLOCK_DEPTH / 2 - FIELD.borderWidth + 1,
    width: 6,
    depth: 6,
  },
]

/**
 * Toggleable blockages. Each sits across a specific track, so switching one on
 * forces a genuinely different route rather than nudging the same one.
 */
export const SITUATIONAL_OBSTACLES = [
  {
    id: 'irrigation-repair',
    label: 'Irrigation repair',
    kind: 'works',
    detail: 'Centre track closed north–south',
    x: trackX(1),
    z: -8,
    width: 4,
    depth: 44,
  },
  {
    id: 'parked-trailer',
    label: 'Parked trailer',
    kind: 'vehicle',
    detail: 'Trailer across the west track',
    x: trackX(0),
    z: 12,
    width: 4,
    depth: 20,
  },
  {
    id: 'flooded-section',
    label: 'Flooded section',
    kind: 'hazard',
    detail: 'Standing water on the A–B track',
    x: -6,
    z: trackZ(0),
    width: 52,
    depth: 4,
  },
  {
    id: 'headland-delivery',
    label: 'Delivery on headland',
    kind: 'vehicle',
    detail: 'Pallets stacked on the south headland',
    x: 14,
    z: BLOCK_DEPTH / 2 + FIELD.borderWidth / 2,
    width: 26,
    depth: 4,
  },
]

/** Resolves the active obstacle set from a list of enabled situational ids. */
export function resolveObstacles(enabledIds = []) {
  const enabled = new Set(enabledIds)
  return [
    ...FIXED_OBSTACLES,
    ...SITUATIONAL_OBSTACLES.filter((obstacle) => enabled.has(obstacle.id)),
  ]
}

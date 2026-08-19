import {
  CELL_SIZE,
  buildBlockedSet,
  cellToWorld,
  worldToCell,
  zoneTargetCell,
  gridSummary,
} from './navGrid'
import { findPath, findPathDijkstra, MOVES } from './astar'
import { resolveObstacles } from './obstacles'
import { BLOCK_DEPTH, FIELD } from '../farmLayout'

/**
 * PROMETHIA — route planning.
 *
 * The single entry point the rest of the application uses. It takes a start
 * position, a target zone and a set of obstacles, runs A*, and returns the
 * route together with the figures an operator needs: how far, how many steps,
 * how long.
 *
 * Nothing here is precomputed or cached against a known field. Change the
 * obstacles, move the depot, or resize the grid, and the route is searched
 * again from scratch.
 */

/**
 * Where the ground vehicle starts from. TALOS itself is Phase 6 — this is the
 * depot it will operate out of, marked in the scene so a route has somewhere
 * to begin.
 */
const DEPOT_ANCHOR = { x: 36, z: BLOCK_DEPTH / 2 + FIELD.borderWidth / 2 }

/**
 * Snapped to the centre of whichever cell contains it, rather than left at the
 * headland's exact midpoint.
 *
 * A route begins at a cell centre, so a depot sitting anywhere else means the
 * rover starts its drive up to two metres from the pad it is parked on — the
 * marker says one thing and the vehicle does another. Snapping here keeps the
 * two in agreement automatically, including if the grid resolution or the
 * field dimensions ever change.
 */
export const DEPOT = {
  ...cellToWorld(
    worldToCell(DEPOT_ANCHOR.x, DEPOT_ANCHOR.z).col,
    worldToCell(DEPOT_ANCHOR.x, DEPOT_ANCHOR.z).row,
  ),
  label: 'TALOS depot',
}

/** Ground vehicle performance, used to turn a cell count into a time. */
export const VEHICLE = {
  // Doubled. A brisk 2.8 m/s is a jog for a walking machine, which is what the
  // longer stride in talosSpec.js accounts for. PROMETHIA's travel estimates
  // read the same constants, so the ETA it publishes stays correct.
  /** Metres per second on a prepared track. */
  trackSpeed: 2.8,
  /** Slower across a planted bed. */
  cropSpeed: 1.4,
  /** Seconds lost to each change of heading — it turns in place. */
  turnPenalty: 1.6,
}

/**
 * Plans a route.
 *
 * @param {object} options
 * @param {{x:number,z:number}} [options.start]   defaults to the depot
 * @param {string} options.targetZone             zone id, e.g. 'B2'
 * @param {string[]} [options.obstacleIds]        enabled situational obstacles
 * @returns {object} route result, always with an `ok` flag
 */
export function planRoute({ start = DEPOT, targetZone, targetPosition, obstacleIds = [] } = {}) {
  // A route can aim at a zone or at a bare point. The point form is what lets
  // the machine be routed home to the depot, which is not a zone and has no
  // zone ID — without it, returning could only be done by teleporting.
  const goal = targetPosition
    ? worldToCell(targetPosition.x, targetPosition.z)
    : zoneTargetCell(targetZone)

  if (!goal) {
    return { ok: false, reason: 'unknown-zone', targetZone }
  }

  const obstacles = resolveObstacles(obstacleIds)
  const blocked = buildBlockedSet(obstacles)
  const startCell = worldToCell(start.x, start.z)

  const began = performance.now()
  const result = findPath(startCell, goal, blocked)
  const searchMs = performance.now() - began

  if (!result.path) {
    return {
      ok: false,
      reason: result.reason ?? 'unreachable',
      targetZone,
      obstacles,
      expanded: result.expanded ?? 0,
      searchMs,
    }
  }

  const legs = describeLegs(result.path)
  const metrics = measure(result.path)

  return {
    ok: true,
    algorithm: 'A*',
    targetZone,
    start,
    startCell,
    goalCell: goal,

    /** Cells from start to goal, in order. */
    path: result.path,
    /** World-space centres, for drawing. */
    points: result.path.map((cell) => cellToWorld(cell.col, cell.row)),

    /** Moves between cells — one fewer than the number of cells. */
    steps: result.path.length - 1,
    cells: result.path.length,
    distanceMeters: metrics.distance,
    etaSeconds: metrics.eta,
    turns: metrics.turns,
    crossesCrop: metrics.cropCells > 0,
    cropCells: metrics.cropCells,

    /** Compressed heading list, e.g. [{heading:'N', count:6}, …] */
    legs,

    /** Search diagnostics — how much of the grid A* actually had to look at. */
    expanded: result.expanded,
    searchMs,
    pathCost: result.cost,

    obstacles,
    grid: gridSummary(),
  }
}

/**
 * Distance, travel time and turn count.
 *
 * Time is not distance divided by one speed: crossing a planted bed is slower
 * than running along a track, and a vehicle that turns in place loses real
 * seconds at every corner. A route with the same length but more corners
 * genuinely takes longer, and the estimate should say so.
 */
function measure(path) {
  let distance = 0
  let eta = 0
  let cropCells = 0
  let turns = 0
  let lastHeading = null

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]
    const to = path[i]

    distance += CELL_SIZE
    const speed = to.terrain === 'crop' ? VEHICLE.cropSpeed : VEHICLE.trackSpeed
    eta += CELL_SIZE / speed

    if (to.terrain === 'crop') cropCells++

    const heading = headingBetween(from, to)
    if (lastHeading && heading !== lastHeading) {
      turns++
      eta += VEHICLE.turnPenalty
    }
    lastHeading = heading
  }

  return {
    distance: Math.round(distance),
    eta: Math.round(eta),
    cropCells,
    turns,
  }
}

function headingBetween(from, to) {
  const move = MOVES.find((m) => m.dc === to.col - from.col && m.dr === to.row - from.row)
  return move ? move.heading : null
}

/**
 * Collapses the step-by-step path into runs of the same heading, so the route
 * can be read as "north 6, east 3" rather than twenty separate arrows.
 */
function describeLegs(path) {
  const legs = []

  for (let i = 1; i < path.length; i++) {
    const heading = headingBetween(path[i - 1], path[i])
    if (!heading) continue

    const last = legs[legs.length - 1]
    if (last && last.heading === heading) {
      last.count++
    } else {
      legs.push({ heading, count: 1 })
    }
  }

  return legs
}

export { DEPOT as PROMETHIA_START }

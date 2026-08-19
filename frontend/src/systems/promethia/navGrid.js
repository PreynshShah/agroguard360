import {
  ZONES,
  FIELD,
  BLOCK_WIDTH,
  BLOCK_DEPTH,
} from '../farmLayout'

/**
 * navGrid.js
 * The farm, expressed as a grid PROMETHIA can search.
 *
 * Cell size is 4 m, and that number is not arbitrary. A zone is 20 m and a
 * track is 4 m, so a 4 m cell divides both exactly: every cell falls wholly
 * inside a crop bed or wholly inside a track, and no cell ever straddles the
 * boundary between them. At 3 m or 5 m the grid would cut across zone edges,
 * and a cell that is 60% crop and 40% track has no honest cost to assign.
 *
 * The grid is extended to an 8 m headland rather than the field's real 6 m,
 * for the same reason — 6 m is not a whole number of cells, and rounding the
 * border is far less harmful than misaligning every zone in the field.
 *
 * Terrain, not obstacles, is what shapes most routes here. Tracks are cheap;
 * crop beds are passable but expensive, because a ground vehicle *can* cross a
 * planted bed — it just flattens the crop doing it. Making beds impassable
 * would be simpler and wrong: the robot could then never reach a zone at all.
 */

export const CELL_SIZE = 4

/** Headland padding, rounded up from the field's 6 m to a whole cell count. */
const HEADLAND = 8

/** Grid extent in metres, and the world coordinate of its lower corner. */
export const GRID_EXTENT = BLOCK_WIDTH + HEADLAND * 2
export const GRID_ORIGIN = -GRID_EXTENT / 2
export const GRID_SIZE = Math.round(GRID_EXTENT / CELL_SIZE)

/** Movement cost by terrain. Crossing a planted bed costs four times a track. */
export const TERRAIN_COST = {
  track: 1,
  crop: 4,
}

/* ------------------------------------------------------------------ *
 * Coordinate conversion
 * ------------------------------------------------------------------ */

/** Centre of a cell, in world metres. */
export function cellToWorld(col, row) {
  return {
    x: GRID_ORIGIN + (col + 0.5) * CELL_SIZE,
    z: GRID_ORIGIN + (row + 0.5) * CELL_SIZE,
  }
}

/** The cell containing a world position, clamped to the grid. */
export function worldToCell(x, z) {
  return {
    col: clampIndex(Math.floor((x - GRID_ORIGIN) / CELL_SIZE)),
    row: clampIndex(Math.floor((z - GRID_ORIGIN) / CELL_SIZE)),
  }
}

const clampIndex = (i) => (i < 0 ? 0 : i > GRID_SIZE - 1 ? GRID_SIZE - 1 : i)

export const inBounds = (col, row) =>
  col >= 0 && row >= 0 && col < GRID_SIZE && row < GRID_SIZE

/** Stable key for a cell, used by the search's open and closed sets. */
export const cellKey = (col, row) => row * GRID_SIZE + col

/* ------------------------------------------------------------------ *
 * Grid construction
 * ------------------------------------------------------------------ */

/**
 * Classifies every cell once, at module load.
 * @returns {{terrain:string, zoneId:string|null, cost:number}[]}
 */
function classifyCells() {
  const cells = new Array(GRID_SIZE * GRID_SIZE)

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const { x, z } = cellToWorld(col, row)

      // Which zone, if any, contains this cell's centre.
      const zone = ZONES.find(
        (candidate) =>
          Math.abs(x - candidate.centerX) < candidate.width / 2 &&
          Math.abs(z - candidate.centerZ) < candidate.depth / 2,
      )

      const terrain = zone ? 'crop' : 'track'

      cells[cellKey(col, row)] = {
        col,
        row,
        terrain,
        zoneId: zone ? zone.id : null,
        cost: TERRAIN_COST[terrain],
      }
    }
  }

  return cells
}

export const CELLS = classifyCells()

export function getCell(col, row) {
  return inBounds(col, row) ? CELLS[cellKey(col, row)] : null
}

/** Every cell belonging to a given zone. */
export function cellsInZone(zoneId) {
  return CELLS.filter((cell) => cell.zoneId === zoneId)
}

/**
 * The cell a route should aim for when targeting a zone: its centre.
 * Zones are an odd 5 cells across, so the centre is a real cell rather than a
 * point between four of them.
 */
export function zoneTargetCell(zoneId) {
  const zone = ZONES.find((candidate) => candidate.id === zoneId)
  if (!zone) return null
  return worldToCell(zone.centerX, zone.centerZ)
}

/* ------------------------------------------------------------------ *
 * Obstacles
 * ------------------------------------------------------------------ */

/**
 * Obstacles are rectangles in world space rather than cell lists, because
 * that is how they arrive — a parked trailer or a flooded section has a real
 * extent, and which cells it covers is a consequence of where it sits.
 *
 * @param {Array<{id:string, x:number, z:number, width:number, depth:number}>} obstacles
 * @returns {Set<number>} keys of blocked cells
 */
export function buildBlockedSet(obstacles = []) {
  const blocked = new Set()

  for (const obstacle of obstacles) {
    const halfW = obstacle.width / 2
    const halfD = obstacle.depth / 2

    const min = worldToCell(obstacle.x - halfW, obstacle.z - halfD)
    const max = worldToCell(obstacle.x + halfW, obstacle.z + halfD)

    for (let row = min.row; row <= max.row; row++) {
      for (let col = min.col; col <= max.col; col++) {
        if (inBounds(col, row)) blocked.add(cellKey(col, row))
      }
    }
  }

  return blocked
}

/** Grid statistics, for the interface to report honestly. */
export function gridSummary() {
  const crop = CELLS.filter((cell) => cell.terrain === 'crop').length
  return {
    size: GRID_SIZE,
    cellSize: CELL_SIZE,
    total: CELLS.length,
    crop,
    track: CELLS.length - crop,
  }
}

import {
  GRID_SIZE,
  CELLS,
  cellKey,
  inBounds,
  getCell,
  TERRAIN_COST,
} from './navGrid'

/**
 * astar.js
 * A* over the navigation grid.
 *
 * Movement is four-way. Diagonals would produce shorter, prettier lines, but a
 * tracked vehicle between crop rows turns in place and drives along the tracks
 * — it does not cut corners diagonally across a bed. Four-way also makes
 * "distance in cells" mean something exact, and lets the route be described as
 * a sequence of headings.
 *
 * The heuristic is Manhattan distance multiplied by the cheapest possible
 * step cost. That factor matters: with terrain costs above 1, a plain
 * Manhattan heuristic still never overestimates, but scaling it by the minimum
 * edge cost keeps it as tight as it can be while staying admissible — and
 * admissibility is what guarantees the path A* returns is genuinely optimal
 * rather than merely good. The optimality test asserts this against Dijkstra.
 */

const MOVES = [
  { dc: 0, dr: -1, heading: 'N' },
  { dc: 1, dr: 0, heading: 'E' },
  { dc: 0, dr: 1, heading: 'S' },
  { dc: -1, dr: 0, heading: 'W' },
]

/** Cheapest step available anywhere on the grid — keeps the heuristic tight. */
const MIN_STEP_COST = Math.min(...Object.values(TERRAIN_COST))

function manhattan(a, b) {
  return (Math.abs(a.col - b.col) + Math.abs(a.row - b.row)) * MIN_STEP_COST
}

/**
 * Finds the cheapest route between two cells.
 *
 * @param {{col:number,row:number}} start
 * @param {{col:number,row:number}} goal
 * @param {Set<number>} blocked  cell keys that cannot be entered
 * @returns {{path:Array, cost:number, expanded:number, reason?:string}|null}
 */
export function findPath(start, goal, blocked = new Set()) {
  if (!inBounds(start.col, start.row) || !inBounds(goal.col, goal.row)) {
    return { path: null, reason: 'off-grid' }
  }

  const startKey = cellKey(start.col, start.row)
  const goalKey = cellKey(goal.col, goal.row)

  if (blocked.has(startKey)) return { path: null, reason: 'start-blocked' }
  if (blocked.has(goalKey)) return { path: null, reason: 'goal-blocked' }

  // Flat typed arrays rather than Maps: the grid is small and fixed, and this
  // avoids allocating an object per visited cell.
  const gScore = new Float64Array(GRID_SIZE * GRID_SIZE).fill(Infinity)
  const cameFrom = new Int32Array(GRID_SIZE * GRID_SIZE).fill(-1)
  const closed = new Uint8Array(GRID_SIZE * GRID_SIZE)

  gScore[startKey] = 0

  const open = new MinHeap()
  open.push(startKey, manhattan(start, goal))

  let expanded = 0

  while (open.size > 0) {
    const currentKey = open.pop()

    if (closed[currentKey]) continue
    closed[currentKey] = 1
    expanded++

    if (currentKey === goalKey) {
      return {
        path: reconstruct(cameFrom, currentKey),
        cost: gScore[currentKey],
        expanded,
      }
    }

    const current = CELLS[currentKey]

    for (const move of MOVES) {
      const col = current.col + move.dc
      const row = current.row + move.dr
      if (!inBounds(col, row)) continue

      const neighbourKey = cellKey(col, row)
      if (closed[neighbourKey] || blocked.has(neighbourKey)) continue

      const neighbour = CELLS[neighbourKey]
      const tentative = gScore[currentKey] + neighbour.cost

      if (tentative < gScore[neighbourKey]) {
        gScore[neighbourKey] = tentative
        cameFrom[neighbourKey] = currentKey
        open.push(neighbourKey, tentative + manhattan(neighbour, goal))
      }
    }
  }

  return { path: null, reason: 'unreachable', expanded }
}

function reconstruct(cameFrom, endKey) {
  const path = []
  let key = endKey

  while (key !== -1) {
    path.push(CELLS[key])
    key = cameFrom[key]
  }

  return path.reverse()
}

/**
 * Dijkstra over the same grid — no heuristic.
 *
 * Kept beside A* on purpose: it is the reference the optimality test measures
 * against. If A* ever returns a costlier path than this does, the heuristic
 * has stopped being admissible and the "optimal route" claim is false.
 */
export function findPathDijkstra(start, goal, blocked = new Set()) {
  const startKey = cellKey(start.col, start.row)
  const goalKey = cellKey(goal.col, goal.row)

  if (blocked.has(startKey) || blocked.has(goalKey)) return { path: null }

  const gScore = new Float64Array(GRID_SIZE * GRID_SIZE).fill(Infinity)
  const cameFrom = new Int32Array(GRID_SIZE * GRID_SIZE).fill(-1)
  const closed = new Uint8Array(GRID_SIZE * GRID_SIZE)

  gScore[startKey] = 0
  const open = new MinHeap()
  open.push(startKey, 0)

  let expanded = 0

  while (open.size > 0) {
    const currentKey = open.pop()
    if (closed[currentKey]) continue
    closed[currentKey] = 1
    expanded++

    if (currentKey === goalKey) {
      return { path: reconstruct(cameFrom, currentKey), cost: gScore[currentKey], expanded }
    }

    const current = CELLS[currentKey]

    for (const move of MOVES) {
      const col = current.col + move.dc
      const row = current.row + move.dr
      if (!inBounds(col, row)) continue

      const neighbourKey = cellKey(col, row)
      if (closed[neighbourKey] || blocked.has(neighbourKey)) continue

      const tentative = gScore[currentKey] + CELLS[neighbourKey].cost
      if (tentative < gScore[neighbourKey]) {
        gScore[neighbourKey] = tentative
        cameFrom[neighbourKey] = currentKey
        open.push(neighbourKey, tentative)
      }
    }
  }

  return { path: null, expanded }
}

/**
 * Binary min-heap keyed on f-score.
 *
 * A sorted array or a linear scan for the lowest f would also work at this
 * grid size, but both turn the open set into the dominant cost as the grid
 * grows. This keeps push and pop logarithmic, so the same code still holds up
 * if the farm is subdivided further.
 */
class MinHeap {
  constructor() {
    this.keys = []
    this.priorities = []
  }

  get size() {
    return this.keys.length
  }

  push(key, priority) {
    this.keys.push(key)
    this.priorities.push(priority)

    let i = this.keys.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.priorities[parent] <= this.priorities[i]) break
      this.swap(parent, i)
      i = parent
    }
  }

  pop() {
    const top = this.keys[0]
    const lastKey = this.keys.pop()
    const lastPriority = this.priorities.pop()

    if (this.keys.length > 0) {
      this.keys[0] = lastKey
      this.priorities[0] = lastPriority

      let i = 0
      for (;;) {
        const left = 2 * i + 1
        const right = left + 1
        let smallest = i

        if (left < this.keys.length && this.priorities[left] < this.priorities[smallest]) {
          smallest = left
        }
        if (right < this.keys.length && this.priorities[right] < this.priorities[smallest]) {
          smallest = right
        }
        if (smallest === i) break

        this.swap(i, smallest)
        i = smallest
      }
    }

    return top
  }

  swap(a, b) {
    ;[this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]
    ;[this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]]
  }
}

export { MOVES }

/**
 * farmLayout.js
 * The field's survey data. Every component that needs to know where something
 * sits reads it from here, so the soil, the crops, the paths, the pipes and
 * the hover targets can never drift out of alignment.
 *
 * Coordinate convention: X runs east, Z runs south, Y is up. The field is
 * centred on the origin. Rows are labelled A–D from north to south, columns
 * 1–4 from west to east, giving A1…D4.
 */

export const FIELD = {
  rows: ['A', 'B', 'C', 'D'],
  cols: [1, 2, 3, 4],
  /** Planted area of a single zone, in metres. */
  zoneWidth: 20,
  zoneDepth: 20,
  /** Track between adjacent zones. */
  pathWidth: 4,
  /** Perimeter track around the whole block. */
  borderWidth: 6,
}

/** Total planted block, excluding the perimeter track. */
export const BLOCK_WIDTH =
  FIELD.cols.length * FIELD.zoneWidth + (FIELD.cols.length - 1) * FIELD.pathWidth
export const BLOCK_DEPTH =
  FIELD.rows.length * FIELD.zoneDepth + (FIELD.rows.length - 1) * FIELD.pathWidth

/** Outer edge of the farmyard, including the perimeter track. */
export const FARM_WIDTH = BLOCK_WIDTH + FIELD.borderWidth * 2
export const FARM_DEPTH = BLOCK_DEPTH + FIELD.borderWidth * 2

/*
 * Declared before ZONES on purpose: ZONES is built at module load and reads
 * CROP_CYCLE, so moving these below it puts them in the temporal dead zone and
 * the module throws on import.
 */
/**
 * Growth stages, not species. Real fields are planted in staggered batches, so
 * neighbouring zones sit at different heights and slightly different greens.
 */
export const CROP_CYCLE = ['seedling', 'young', 'established', 'mature']

export const CROP_PROFILES = {
  seedling: { height: 0.22, spread: 0.16, tint: '#7d8f56', rowSpacing: 0.9, plantSpacing: 0.42 },
  young: { height: 0.38, spread: 0.24, tint: '#6d8449', rowSpacing: 0.9, plantSpacing: 0.5 },
  established: { height: 0.55, spread: 0.32, tint: '#5c7840', rowSpacing: 1.0, plantSpacing: 0.58 },
  mature: { height: 0.72, spread: 0.4, tint: '#556e3b', rowSpacing: 1.0, plantSpacing: 0.66 },
}

/**
 * Every zone, precomputed once at module load.
 * @type {Array<{id:string,row:string,col:number,rowIndex:number,colIndex:number,
 *               centerX:number,centerZ:number,width:number,depth:number,crop:string}>}
 */
export const ZONES = FIELD.rows.flatMap((row, rowIndex) =>
  FIELD.cols.map((col, colIndex) => {
    const stepX = FIELD.zoneWidth + FIELD.pathWidth
    const stepZ = FIELD.zoneDepth + FIELD.pathWidth

    // Offset each index from the block centre.
    const centerX = (colIndex - (FIELD.cols.length - 1) / 2) * stepX
    const centerZ = (rowIndex - (FIELD.rows.length - 1) / 2) * stepZ

    return {
      id: `${row}${col}`,
      row,
      col,
      rowIndex,
      colIndex,
      centerX,
      centerZ,
      width: FIELD.zoneWidth,
      depth: FIELD.zoneDepth,
      /**
       * Crop assignment drives nothing but appearance in Phase 2 — it varies
       * plant height and tint so the block doesn't read as one flat carpet.
       */
      crop: CROP_CYCLE[(rowIndex * FIELD.cols.length + colIndex) % CROP_CYCLE.length],
    }
  }),
)

/** Looks up a zone by its label, e.g. "B3". */
export function getZone(id) {
  return ZONES.find((zone) => zone.id === id) ?? null
}

/**
 * Path centrelines, returned as flat rectangles ready to be laid on the
 * ground. Includes the three tracks between zone rows, the three between zone
 * columns, and the perimeter ring.
 */
export function getPathSegments() {
  const segments = []
  const stepX = FIELD.zoneWidth + FIELD.pathWidth
  const stepZ = FIELD.zoneDepth + FIELD.pathWidth
  const halfBorder = FIELD.borderWidth / 2

  // North–south tracks, between columns.
  for (let i = 0; i < FIELD.cols.length - 1; i++) {
    const x = (i - (FIELD.cols.length - 1) / 2 + 0.5) * stepX
    segments.push({
      key: `ns-${i}`,
      x,
      z: 0,
      width: FIELD.pathWidth,
      depth: BLOCK_DEPTH + FIELD.borderWidth * 2,
      rotation: 0,
    })
  }

  // East–west tracks, between rows.
  for (let i = 0; i < FIELD.rows.length - 1; i++) {
    const z = (i - (FIELD.rows.length - 1) / 2 + 0.5) * stepZ
    segments.push({
      key: `ew-${i}`,
      x: 0,
      z,
      width: BLOCK_WIDTH + FIELD.borderWidth * 2,
      depth: FIELD.pathWidth,
      rotation: 0,
    })
  }

  // Perimeter ring, as four strips.
  const outerX = BLOCK_WIDTH / 2 + halfBorder
  const outerZ = BLOCK_DEPTH / 2 + halfBorder
  segments.push(
    { key: 'edge-n', x: 0, z: -outerZ, width: FARM_WIDTH, depth: FIELD.borderWidth, rotation: 0 },
    { key: 'edge-s', x: 0, z: outerZ, width: FARM_WIDTH, depth: FIELD.borderWidth, rotation: 0 },
    { key: 'edge-w', x: -outerX, z: 0, width: FIELD.borderWidth, depth: FARM_DEPTH, rotation: 0 },
    { key: 'edge-e', x: outerX, z: 0, width: FIELD.borderWidth, depth: FARM_DEPTH, rotation: 0 },
  )

  return segments
}

/**
 * Generates crop plant positions for one zone.
 *
 * Rows run north–south. Each plant gets a small random jitter and a random
 * lean, because perfectly gridded plants are the single clearest giveaway of
 * a synthetic scene.
 *
 * @returns {Array<{x:number,z:number,scale:number,rotation:number,lean:number,shade:number}>}
 */
export function generateZonePlants(zone, random) {
  const profile = CROP_PROFILES[zone.crop]
  const plants = []

  // Leave a headland at each end of the row so crops don't touch the path.
  const headland = 1.2
  const usableWidth = zone.width - headland * 2
  const usableDepth = zone.depth - headland * 2

  const rowCount = Math.floor(usableWidth / profile.rowSpacing)
  const perRow = Math.floor(usableDepth / profile.plantSpacing)

  const rowStart = -usableWidth / 2
  const colStart = -usableDepth / 2

  for (let r = 0; r < rowCount; r++) {
    // Rows themselves wander slightly — a tractor doesn't drive a perfect line.
    const rowDrift = (random() - 0.5) * 0.08

    for (let p = 0; p < perRow; p++) {
      // A few gaps, as though some seed failed to take.
      if (random() < 0.035) continue

      plants.push({
        x: zone.centerX + rowStart + r * profile.rowSpacing + rowDrift + (random() - 0.5) * 0.09,
        z: zone.centerZ + colStart + p * profile.plantSpacing + (random() - 0.5) * 0.14,
        scale: 0.78 + random() * 0.44,
        rotation: random() * Math.PI * 2,
        lean: (random() - 0.5) * 0.22,
        shade: 0.86 + random() * 0.28,
      })
    }
  }

  return plants
}

/**
 * Seeded pseudo-random generator.
 *
 * The scene must look the same on every reload — otherwise the field
 * rearranges itself each time the page refreshes, which makes visual
 * regressions impossible to spot.
 */
export function makeRandom(seed = 1337) {
  let state = seed >>> 0
  return function random() {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

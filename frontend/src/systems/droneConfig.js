import { BLOCK_DEPTH, FIELD } from './farmLayout'

/**
 * droneConfig.js
 * The fixed points PEGASUS operates from, and how the camera frames them.
 *
 * Flight physics deliberately lives elsewhere, in `flightModel.js` — that file
 * is pure and testable, and duplicating its constants here would guarantee the
 * two drift apart.
 */

/** South headland, clear of the parked equipment. */
export const HOME_PAD = {
  x: -6,
  z: BLOCK_DEPTH / 2 + FIELD.borderWidth / 2,
  radius: 1.1,
}

/** Where the operator stands, and which way they look. */
export const OPERATOR_STATION = {
  x: HOME_PAD.x + 3.6,
  z: HOME_PAD.z + 0.7,
  /** Facing roughly north, into the field. */
  heading: Math.PI,
}

/**
 * Camera framing for each focus mode.
 *
 * `offset` is where the camera sits relative to the subject; `distance` caps
 * how far the orbit can be pushed while that subject is being tracked. FARM
 * restores the wide establishing view from Phase 2.
 */
export const FOCUS_VIEWS = {
  farm: {
    label: 'Farm',
    target: [0, 1, 0],
    offset: [62, 38, 74],
  },
  pegasus: {
    label: 'Pegasus',
    /** Resolved live from the subjects map rather than a fixed point. */
    subject: 'pegasus',
    // Behind and slightly above, so the aircraft is seen against the field.
    offset: [4.5, 2.6, 7.5],
    /** Keeps following the aircraft after the move completes. */
    tracking: true,
  },
  talos: {
    label: 'Talos',
    subject: 'talos',
    // Low and close — a ground vehicle is best read near its own eye level.
    offset: [3.4, 2.1, 4.8],
    /** Frame the chassis, not the ground it stands on. */
    lift: 0.6,
    tracking: true,
  },
  /**
   * High, wide and slightly north — the establishing shot. Further back than
   * FARM so the treeline and farmstead frame the block rather than sitting at
   * the edge of frame.
   */
  overview: {
    label: 'Overview',
    target: [0, 1, 0],
    offset: [0, 96, 132],
  },

  /**
   * The zone BUDDHI ranked worst. Resolved live from the subjects map, because
   * which zone that is only becomes known after a scan.
   */
  problem: {
    label: 'Problem zone',
    subject: 'problem',
    offset: [16, 15, 22],
    lift: 0.5,
  },

  operator: {
    label: 'Operator',
    target: [OPERATOR_STATION.x, 1.0, OPERATOR_STATION.z],
    offset: [4.2, 2.2, 6.0],
  },
}

/** Seconds a focus transition takes. */
export const FOCUS_TRANSITION = 1.15

/**
 * assumptions.js
 * Every number MERCATUS uses that did not come from the simulation.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE QUOTING ANY FIGURE FROM THIS SYSTEM
 * ---------------------------------------------------------------------------
 * These are ILLUSTRATIVE PLACEHOLDERS. They are not researched market rates,
 * not quotes, and not benchmarked against any real farm. They exist so the
 * arithmetic has inputs and so the shape of the calculation can be inspected.
 *
 * Every one of them varies enormously by region, season, tariff band, scale
 * and ownership model. A borewell farmer on a subsidised connection and a
 * grower on metered supply do not pay remotely similar amounts for the same
 * litre of water.
 *
 * Collected here in one file, each with its own note, so that anyone using
 * this seriously can replace them with local figures in one place and see
 * exactly what they are replacing. Nothing downstream hard-codes a rate.
 */

export const CURRENCY = {
  code: 'INR',
  symbol: '₹',
}

export const RATES = {
  /**
   * Cost of delivered irrigation water, per litre.
   * Placeholder. Real cost depends on the source (canal, borewell, tanker),
   * pumping energy, and whether water is metered or effectively free at point
   * of use — which in much of India it is.
   */
  waterPerLitre: 0.02,

  /**
   * Electricity, per kWh.
   * Placeholder. Agricultural tariffs are frequently subsidised or flat-rate,
   * so a per-unit figure may not reflect what is actually paid at all.
   */
  energyPerKwh: 8.0,

  /**
   * Machine operating cost per hour: depreciation, servicing, consumables.
   * Placeholder. Depends entirely on capital cost, expected service life and
   * utilisation — the three things a prototype has no data for.
   */
  machineHour: 120,

  /**
   * Skilled labour, per hour. Used only for the scouting comparison.
   * Placeholder.
   */
  labourHour: 250,
}

/**
 * Power draw of each subsystem, in watts.
 * Estimated from the class of hardware, not measured from a real machine.
 */
export const POWER = {
  /** Traction motors while driving. */
  roverDrive: 45,
  /** Compute, sensors and radio while powered up. */
  roverElectronics: 12,
  /** Irrigation pump while running. */
  pump: 25,
  /** Quadcopter in flight — by far the largest draw in the system. */
  droneFlight: 180,
}

/**
 * The counterfactual: what MERCATUS compares against when it estimates
 * savings.
 *
 * This is the single most important assumption in the file, because "savings"
 * is meaningless without stating what is being saved *relative to*. The
 * comparison here is deliberately narrow and internally consistent: a
 * scheduled blanket treatment applies the same dose to every zone in the
 * block, whereas a scan-and-treat cycle applies it only to zones that
 * measured below threshold.
 *
 * That comparison uses the simulation's own dose figures, so it does not
 * depend on any outside agronomic claim.
 */
export const BASELINE = {
  /**
   * Under scheduled irrigation, every zone is treated regardless of need.
   * Savings therefore accrue on the untreated zones only.
   */
  treatsEveryZone: true,

  /**
   * Minutes to walk and manually inspect one zone — soil probe, visual check,
   * notes. Placeholder, and highly variable with zone size and terrain.
   */
  manualScoutingMinutesPerZone: 6,
}

/**
 * Deliberately NOT modelled, and why.
 *
 * Surfaced in the interface rather than left as a silent omission: an economic
 * panel that quietly excludes the largest term is more misleading than one
 * that shows nothing at all.
 */
export const EXCLUSIONS = [
  {
    item: 'Yield protection',
    reason:
      'Requires a validated crop response model and real trial data. Any figure here would be invented, and it would dominate every other term.',
  },
  {
    item: 'Capital cost and payback',
    reason:
      'No hardware exists to price. ROI below is return on operating spend for the session, not return on equipment investment.',
  },
  {
    item: 'Input savings (fertiliser, pesticide)',
    reason: 'This rover applies water only. Nothing else is dispensed, so nothing else is saved.',
  },
]

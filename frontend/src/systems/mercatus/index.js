import { RATES, POWER, BASELINE, EXCLUSIONS, CURRENCY } from './assumptions'

/**
 * MERCATUS — resource and economic analysis.
 *
 * Takes a ledger of what the machines actually did during a session and turns
 * it into resource totals, costs, and a savings comparison.
 *
 * Two rules shape this file:
 *
 * 1. Everything measurable comes from the simulation. Water volumes, distances
 *    and durations are recorded by the rover and the drone as they run, not
 *    estimated afterwards.
 *
 * 2. Everything not measurable is an explicit assumption living in
 *    `assumptions.js`, and no rate is ever written inline here. That way the
 *    boundary between "this is what happened" and "this is what we guessed it
 *    might be worth" stays visible in the code, not just in the interface.
 *
 * Every figure produced is a SIMULATION ESTIMATE.
 */

/** One completed mission — what the rover did at a single zone. */
export function createMissionRecord({
  zoneId,
  action,
  problem,
  waterMl = 0,
  distanceMeters = 0,
  operatingSeconds = 0,
  treatmentSeconds = 0,
  inspectionSeconds = 0,
}) {
  return {
    zoneId,
    action,
    problem,
    waterMl,
    distanceMeters,
    operatingSeconds,
    treatmentSeconds,
    inspectionSeconds,
    at: Date.now(),
  }
}

/**
 * Analyses a session.
 *
 * @param {object} input
 * @param {Array} input.missions      completed mission records
 * @param {number} input.surveySeconds drone flight time
 * @param {number} input.zonesScanned  zones BUDDHI covered
 * @param {number} input.zonesTotal    zones in the block
 * @returns {object} resource totals, costs, savings and ROI
 */
export function analyseSession({
  missions = [],
  surveySeconds = 0,
  zonesScanned = 0,
  zonesTotal = 16,
} = {}) {
  /* ---- Resources actually consumed ------------------------------- */

  const treated = missions.filter((m) => m.action === 'irrigate')

  const waterMl = sum(missions, 'waterMl')
  const distanceMeters = sum(missions, 'distanceMeters')
  const driveSeconds = sum(missions, 'operatingSeconds')
  const treatmentSeconds = sum(missions, 'treatmentSeconds')
  const inspectionSeconds = sum(missions, 'inspectionSeconds')

  // Total time the rover was powered up, whether moving or parked.
  const roverPoweredSeconds = driveSeconds + inspectionSeconds

  /* ---- Energy ---------------------------------------------------- */

  // Each subsystem draws only while it is doing its job. Summing them
  // separately rather than applying one average draw is what makes the
  // breakdown meaningful — the drone dominates, and an averaged figure would
  // hide that.
  const energy = {
    roverDrive: wattSecondsToWh(POWER.roverDrive * driveSeconds),
    roverElectronics: wattSecondsToWh(POWER.roverElectronics * roverPoweredSeconds),
    pump: wattSecondsToWh(POWER.pump * treatmentSeconds),
    droneFlight: wattSecondsToWh(POWER.droneFlight * surveySeconds),
  }
  energy.totalWh = energy.roverDrive + energy.roverElectronics + energy.pump + energy.droneFlight

  /* ---- Costs ----------------------------------------------------- */

  const waterLitres = waterMl / 1000
  const machineHours = (roverPoweredSeconds + surveySeconds) / 3600

  const costs = {
    water: waterLitres * RATES.waterPerLitre,
    energy: (energy.totalWh / 1000) * RATES.energyPerKwh,
    machine: machineHours * RATES.machineHour,
  }
  costs.total = costs.water + costs.energy + costs.machine

  /* ---- Savings, against a stated counterfactual ------------------- */

  // Water: under scheduled blanket irrigation every zone gets a dose. Only the
  // zones that measured below threshold got one here. The per-zone dose comes
  // from this session's own treatments, so the comparison never leans on an
  // outside agronomic figure.
  const averageDoseMl = treated.length > 0 ? waterMl / treated.length : 0
  const zonesSpared = Math.max(0, zonesTotal - treated.length)
  const waterSavedMl = BASELINE.treatsEveryZone ? averageDoseMl * zonesSpared : 0
  const waterSavedCost = (waterSavedMl / 1000) * RATES.waterPerLitre

  // Labour: the zones BUDDHI covered are zones nobody had to walk.
  const scoutingHoursSaved = (zonesScanned * BASELINE.manualScoutingMinutesPerZone) / 60
  const labourSavedCost = scoutingHoursSaved * RATES.labourHour

  const savingsTotal = waterSavedCost + labourSavedCost

  // Which single assumption is carrying the result.
  //
  // This matters more than it might look. On a short session the machine-hour
  // cost is tiny while the labour comparison is not, and ROI comes out in the
  // thousands of percent — a headline that says far more about one placeholder
  // rate than about the technology. Rather than hide that behind a rounded
  // number, the dominant term is computed and surfaced, so the figure is read
  // with the caveat attached instead of quoted without it.
  const parts = [
    { key: 'labour', label: 'manual scouting labour', value: labourSavedCost },
    { key: 'water', label: 'water not applied', value: waterSavedCost },
  ].sort((a, b) => b.value - a.value)

  const dominant =
    savingsTotal > 0
      ? { ...parts[0], share: parts[0].value / savingsTotal }
      : { key: null, label: null, share: 0 }

  const savings = {
    water: waterSavedCost,
    labour: labourSavedCost,
    total: savingsTotal,
    waterSavedMl,
    zonesSpared,
    scoutingHoursSaved,
    dominant,
  }

  /* ---- Return ---------------------------------------------------- */

  const net = savings.total - costs.total

  // Return on the operating spend for this session — NOT return on equipment
  // investment, which would need a capital cost that does not exist. Named
  // precisely for that reason, and undefined rather than infinite when nothing
  // has been spent.
  const roi = costs.total > 0 ? (net / costs.total) * 100 : null

  return {
    /** Never omitted. Anything rendering these figures must show it. */
    simulated: true,
    currency: CURRENCY,

    resources: {
      waterMl,
      waterLitres,
      distanceMeters,
      driveSeconds,
      treatmentSeconds,
      inspectionSeconds,
      roverPoweredSeconds,
      surveySeconds,
      energyWh: energy.totalWh,
      treatedZones: treated.length,
      missionCount: missions.length,
      zonesScanned,
      zonesTotal,
    },

    energy,
    costs,
    savings,
    net,
    roi,
    roiBasis: 'Return on this session’s operating cost. Excludes equipment capital.',

    /**
     * Set when one assumption drives most of the savings. Rendered beside the
     * ROI figure so the number is never shown on its own.
     */
    caveat:
      savings.dominant.share > 0.6
        ? `${Math.round(savings.dominant.share * 100)}% of estimated savings come from the ${savings.dominant.label} assumption.`
        : null,
    exclusions: EXCLUSIONS,

    /** Per-mission rows, for the charts. */
    missions,
  }
}

/** Cost breakdown as chart-ready slices, largest first. */
export function costBreakdown(analysis) {
  return [
    { key: 'machine', label: 'Machine time', value: analysis.costs.machine, color: '#4a8f96' },
    { key: 'energy', label: 'Energy', value: analysis.costs.energy, color: '#b8863f' },
    { key: 'water', label: 'Water', value: analysis.costs.water, color: '#5f7d4e' },
  ].sort((a, b) => b.value - a.value)
}

/** Energy by subsystem, largest first. */
export function energyBreakdown(analysis) {
  return [
    { key: 'drone', label: 'Drone flight', value: analysis.energy.droneFlight, color: '#7a6191' },
    { key: 'drive', label: 'Rover drive', value: analysis.energy.roverDrive, color: '#4a8f96' },
    {
      key: 'electronics',
      label: 'Electronics',
      value: analysis.energy.roverElectronics,
      color: '#8a8375',
    },
    { key: 'pump', label: 'Pump', value: analysis.energy.pump, color: '#5f7d4e' },
  ].sort((a, b) => b.value - a.value)
}

/** Formats a money value with the configured symbol. */
export function formatMoney(value, currency = CURRENCY) {
  if (value == null || !Number.isFinite(value)) return '—'
  const decimals = Math.abs(value) < 10 ? 2 : 0
  return `${currency.symbol}${value.toFixed(decimals)}`
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0)
const wattSecondsToWh = (ws) => ws / 3600

export { RATES, EXCLUSIONS, CURRENCY }

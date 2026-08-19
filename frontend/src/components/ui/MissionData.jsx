import { formatMoney } from '../../systems/mercatus'
import { ROVER_STATUS } from '../../systems/roverMotion'

/**
 * MissionData
 * The six live figures from the running mission.
 *
 * Every row keeps its place whether or not it has a value — an em dash where a
 * reading has not been taken yet, rather than the row vanishing. Rows that
 * appear and disappear make the panel jump while someone is reading it, and
 * "not measured yet" is itself information worth showing.
 *
 * Soil moisture is the one live-updating figure, so it is marked while the
 * pump is running.
 */
export function MissionData({ zone, roverMode, inspection, analysis }) {
  const irrigating = inspection?.stage === 'irrigating'
  const moisture =
    inspection?.moisture != null && inspection.stage !== 'sampling'
      ? `${inspection.moisture.toFixed(0)}%`
      : null

  const rows = [
    { label: 'Current zone', value: zone ?? null, strong: true },
    { label: 'Robot status', value: ROVER_STATUS[roverMode] ?? 'Standby' },
    { label: 'Soil moisture', value: moisture, live: irrigating, simulated: Boolean(moisture) },
    { label: 'Water used', value: `${analysis.resources.waterMl.toFixed(0)} ml` },
    { label: 'Distance', value: `${analysis.resources.distanceMeters.toFixed(0)} m` },
    { label: 'Estimated cost', value: formatMoney(analysis.costs.total), estimate: true },
  ]

  return (
    <section className="rail-card" aria-label="Live mission data" aria-live="polite">
      <h2 className="rail-card__title">Live mission data</h2>

      <dl className="mission-data">
        {rows.map((row) => (
          <div key={row.label} className="mission-data__row">
            <dt>{row.label}</dt>
            <dd className={row.strong ? 'mission-data__strong' : ''}>
              {row.value ?? <span className="mission-data__none">—</span>}
              {row.live && <span className="mission-data__live" aria-label="updating" />}
            </dd>
          </div>
        ))}
      </dl>

      {/* Sits under the figures it qualifies, not in a corner of the screen. */}
      <p className="rail-card__note">Sensor and cost figures are simulation estimates.</p>
    </section>
  )
}

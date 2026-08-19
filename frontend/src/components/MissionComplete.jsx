import { PIPELINE } from '../systems/demoSequence'
import { formatMoney } from '../systems/mercatus'

/**
 * MissionComplete
 * The closing card.
 *
 * Rendered over the scene rather than replacing it — the field, the drone on
 * its pad and the rover parked on the treated zone are the result being
 * summarised, and hiding them behind a full-screen panel throws away the thing
 * the demonstration just built.
 *
 * Dismissible, and never blocks the controls beneath it.
 */
export function MissionComplete({ summary, onDismiss }) {
  if (!summary) return null

  const analysis = summary.analysis

  return (
    <div className="mission" role="status">
      <div className="mission__card plate">
        <button
          type="button"
          className="mission__close"
          onClick={onDismiss}
          aria-label="Dismiss summary"
        >
          ×
        </button>

        <span className="mission__eyebrow">
          {summary.docked ? 'Mission complete · docked at depot' : 'Mission complete'}
        </span>
        <h2 className="mission__title">
          AGROGUARD<span className="mission__figure">360</span>
        </h2>

        <ol className="mission__pipeline">
          {PIPELINE.map((stage, i) => (
            <li key={stage}>
              {stage}
              {i < PIPELINE.length - 1 && <span aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>

        {summary.healthy && (
          <p className="mission__note">
            Survey found no problems — every zone within tolerance. No treatment required.
          </p>
        )}

        {analysis && (
          <>
            <dl className="mission__figures">
              <div>
                <dt>Zones treated</dt>
                <dd>{analysis.resources.treatedZones}</dd>
              </div>
              <div>
                <dt>Water used</dt>
                <dd>{analysis.resources.waterMl.toFixed(0)} ml</dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>{analysis.resources.distanceMeters.toFixed(0)} m</dd>
              </div>
              <div>
                <dt>Energy</dt>
                <dd>{analysis.resources.energyWh.toFixed(1)} Wh</dd>
              </div>
              <div>
                <dt>Est. cost</dt>
                <dd>{formatMoney(analysis.costs.total)}</dd>
              </div>
              <div>
                <dt>Est. savings</dt>
                <dd>{formatMoney(analysis.savings.total)}</dd>
              </div>
              <div>
                <dt>Water saved</dt>
                <dd>{(analysis.savings.waterSavedMl / 1000).toFixed(1)} L</dd>
              </div>
            </dl>

            {/* The banner travels with the figures, as everywhere else. */}
            <p className="mission__sim">
              Financial figures are simulation estimates on illustrative rates.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

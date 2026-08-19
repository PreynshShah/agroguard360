import { ROVER_STATUS } from '../systems/roverMotion'
import { INSPECTION_STAGES, MOISTURE_THRESHOLD, moistureGain } from '../systems/inspection'

/**
 * TalosPanel
 * Deploy the rover and read its telemetry.
 *
 * The deploy button is disabled without a route rather than hidden, with the
 * reason stated. A control that vanishes leaves the operator guessing what
 * they did wrong; one that is visibly unavailable and says why does not.
 */

const TONE = {
  idle: 'idle',
  navigating: 'busy',
  inspecting: 'live',
  blocked: 'warn',
}

export function TalosPanel({ mode, telemetry, inspection, route, onDeploy, onRecall, onReturn }) {
  const hasRoute = Boolean(route?.ok)
  const moving = mode === 'navigating'
  const canDeploy = hasRoute && mode === 'idle'

  return (
    <section className="plate talos-panel" aria-label="TALOS rover">
      <div className="talos-panel__head">
        <span className="talos-panel__title">TALOS</span>
        <span className={`talos-panel__status talos-panel__status--${TONE[mode] ?? 'idle'}`}>
          {ROVER_STATUS[mode] ?? ROVER_STATUS.idle}
        </span>
      </div>

      <dl className="talos-metrics">
        <dt>Target</dt>
        <dd>{telemetry.targetZone ?? '—'}</dd>

        <dt>Battery</dt>
        <dd>{Math.round(telemetry.battery)}%</dd>

        <dt>Distance</dt>
        <dd>
          {moving || mode === 'inspecting'
            ? `${telemetry.remaining.toFixed(0)} m to go`
            : hasRoute
              ? `${route.distanceMeters} m planned`
              : '—'}
        </dd>

        <dt>Speed</dt>
        <dd>{telemetry.speed > 0.02 ? `${telemetry.speed.toFixed(1)} m/s` : 'Stopped'}</dd>
      </dl>

      {/* Progress along the route, so a long drive is visibly advancing. */}
      {(moving || mode === 'inspecting') && telemetry.travelled > 0 && (
        <div className="talos-progress">
          <span
            style={{
              width: `${Math.min(100, (telemetry.travelled / Math.max(1, telemetry.travelled + telemetry.remaining)) * 100)}%`,
            }}
          />
        </div>
      )}

      {mode === 'idle' && (
        <button type="button" className="talos-btn" onClick={onDeploy} disabled={!canDeploy}>
          Deploy TALOS
        </button>
      )}

      {mode !== 'idle' && (
        <button type="button" className="talos-btn talos-btn--recall" onClick={onReturn}>
          Return to depot
        </button>
      )}

      {!hasRoute && mode === 'idle' && (
        <p className="talos-hint">Plan a route with PROMETHIA first.</p>
      )}

      {mode === 'inspecting' && inspection && (
        <InspectionReport inspection={inspection} />
      )}
    </section>
  )
}

/**
 * The inspection sequence, revealed in the order it happens: stage first, then
 * readings once sampling has finished, then the decision, then the treatment.
 *
 * The simulation notice sits directly against the readings rather than in a
 * footnote. These are the numbers most likely to be screenshotted, quoted, or
 * mistaken for instrument output, and a caption two panels away does not
 * travel with them.
 */
function InspectionReport({ inspection }) {
  const { stage, sensors, decision } = inspection
  const showReadings = stage !== 'sampling' && sensors
  const irrigating = stage === 'irrigating'
  const finished = stage === 'complete'

  return (
    <div className="inspect">
      <div className="inspect__stage">
        <span className={`inspect__dot${irrigating ? ' inspect__dot--active' : ''}`} />
        {INSPECTION_STAGES[stage] ?? stage}
      </div>

      {stage === 'sampling' && (
        <p className="talos-hint">Probe settling on {inspection.zoneId}…</p>
      )}

      {showReadings && (
        <>
          <div className="inspect__sim">Simulated sensor data</div>

          <dl className="inspect__readings">
            <dt>Soil moisture</dt>
            <dd className={inspection.moisture < MOISTURE_THRESHOLD ? 'inspect__low' : ''}>
              {/* Live while the pump runs — this is the value that climbs. */}
              {inspection.moisture.toFixed(0)}%
            </dd>

            <dt>Temperature</dt>
            <dd>{sensors.temperature.toFixed(0)}°C</dd>

            <dt>Humidity</dt>
            <dd>{sensors.humidity}%</dd>
          </dl>
        </>
      )}

      {decision && (
        <div className={`inspect__action inspect__action--${decision.action}`}>
          <span className="inspect__action-label">
            {decision.action === 'irrigate' ? 'Action required' : 'Assessment'}
          </span>
          <strong>{decision.label}</strong>
          <span className="inspect__reason">{decision.reason}</span>
        </div>
      )}

      {irrigating && (
        <div className="inspect__pump">
          <span className="inspect__pump-state">Pump on</span>
          <span className="inspect__water">{Math.round(inspection.waterUsedMl)} ml</span>
        </div>
      )}

      {finished && (
        <div className="inspect__done">
          <strong>Treatment complete</strong>
          <span>Pump off</span>
          <dl className="inspect__readings">
            <dt>Water used</dt>
            <dd>{Math.round(inspection.waterUsedMl)} ml</dd>
            <dt>Moisture</dt>
            <dd>
              {inspection.startMoisture.toFixed(0)}% → {inspection.moisture.toFixed(0)}% (+
              {moistureGain(inspection).toFixed(0)})
            </dd>
          </dl>
        </div>
      )}
    </div>
  )
}

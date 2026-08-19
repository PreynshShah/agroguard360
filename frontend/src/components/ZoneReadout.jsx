import { getZone } from '../systems/farmLayout'
import { CLASSES, SEVERITY } from '../systems/buddhi/classes'

/**
 * ZoneReadout
 * Everything known about the selected zone: its measurements, and BUDDHI's
 * diagnosis once a scan has covered it.
 *
 * Absent entirely when nothing is selected. Before a scan, it shows readings
 * and says plainly that no analysis has run — it does not show a blank
 * diagnosis field, which would read as "nothing wrong" rather than
 * "not yet looked at". Those are very different claims to make about a crop.
 */
export function ZoneReadout({ zoneId, reading, diagnosis, onClear }) {
  const zone = getZone(zoneId)
  if (!zone) return null

  const condition = diagnosis ? CLASSES[diagnosis.problem] : null
  const severity = diagnosis ? SEVERITY[diagnosis.severity] : null
  const isProblem = diagnosis && diagnosis.problem !== 'healthy'

  return (
    <section className="plate zone-readout" aria-live="polite">
      <div className="zone-readout__head">
        <span className="zone-readout__id">{zone.id}</span>
        {reading && <span className="zone-readout__crop">{reading.cropType}</span>}
        <button type="button" className="zone-readout__clear" onClick={onClear}>
          Clear
        </button>
      </div>

      {diagnosis && (
        <div
          className={`zone-verdict${isProblem ? ' zone-verdict--problem' : ''}`}
          style={{ '--verdict': condition.color }}
        >
          <div className="zone-verdict__row">
            <span className="zone-verdict__label">{condition.label}</span>
            {isProblem && <span className="zone-verdict__severity">{severity.label}</span>}
          </div>
          <div className="zone-verdict__confidence">
            Confidence {(diagnosis.confidence * 100).toFixed(0)}%
          </div>
          <p className="zone-verdict__blurb">{condition.blurb}</p>
        </div>
      )}

      {reading && (
        <dl className="zone-readout__list">
          <dt>Health</dt>
          <dd>{reading.health}%</dd>

          <dt>Soil moisture</dt>
          <dd>{reading.soilMoisture}%</dd>

          <dt>Temperature</dt>
          <dd>{reading.temperature}°C</dd>

          <dt>Humidity</dt>
          <dd>{reading.humidity}%</dd>

          <dt>Canopy vs air</dt>
          <dd>
            {reading.canopyDelta > 0 ? '+' : ''}
            {reading.canopyDelta}°C
          </dd>

          <dt>Vegetation index</dt>
          <dd>{reading.ndvi}</dd>
        </dl>
      )}

      {!diagnosis && <p className="zone-readout__pending">Not yet analysed — run a BUDDHI scan.</p>}
    </section>
  )
}

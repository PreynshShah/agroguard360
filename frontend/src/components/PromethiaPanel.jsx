import { CLASSES } from '../systems/buddhi/classes'

/**
 * PromethiaPanel
 * Choose a target zone, run A*, and read the result.
 *
 * Targets come from BUDDHI's findings — routing to a healthy zone is possible
 * but pointless, and the panel is honest when there is nothing to route to
 * rather than offering all sixteen zones as though they were equal.
 */

const ARROWS = { N: '↑', E: '→', S: '↓', W: '←' }

export function PromethiaPanel({
  findings,
  targetZone,
  route,
  obstacleIds,
  available,
  depot,
  onOptimize,
  onClear,
  onToggleObstacle,
}) {
  const hasTargets = findings.length > 0

  return (
    <section className="plate promethia-panel" aria-label="PROMETHIA route planning">
      <div className="promethia-panel__head">
        <span className="promethia-panel__title">PROMETHIA</span>
        <span className="promethia-panel__algo">A*</span>
      </div>

      {!hasTargets && (
        <p className="promethia-panel__empty">
          Run a BUDDHI scan first — routes are planned to problem zones.
        </p>
      )}

      {hasTargets && (
        <>
          <div className="promethia-targets">
            {findings.map((finding) => (
              <button
                key={finding.zoneId}
                type="button"
                className={`promethia-target${targetZone === finding.zoneId ? ' promethia-target--active' : ''}`}
                style={{ '--condition': CLASSES[finding.problem].color }}
                onClick={() => onOptimize(finding.zoneId)}
              >
                {finding.zoneId}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="promethia-btn"
            onClick={() => onOptimize(targetZone ?? findings[0].zoneId)}
          >
            Optimize route
          </button>
        </>
      )}

      {route && !route.ok && (
        <p className="promethia-panel__empty promethia-panel__empty--warn">
          No route to {route.targetZone}. Every approach is blocked — clear an obstacle.
        </p>
      )}

      {route?.ok && (
        <div className="promethia-result">
          <div className="promethia-result__route">
            <span className="promethia-result__from">{depot.label}</span>
            <span className="promethia-result__legs">
              {route.legs.map((leg, i) => (
                <span key={i} className="promethia-leg">
                  {ARROWS[leg.heading]}
                  {leg.count > 1 && <em>{leg.count}</em>}
                </span>
              ))}
            </span>
            <span className="promethia-result__to">{route.targetZone}</span>
          </div>

          <dl className="promethia-metrics">
            <dt>Algorithm</dt>
            <dd>{route.algorithm}</dd>

            <dt>Distance</dt>
            <dd>
              {route.steps} cells · {route.distanceMeters} m
            </dd>

            <dt>Steps</dt>
            <dd>
              {route.steps} ({route.turns} turns)
            </dd>

            <dt>Est. time</dt>
            <dd>{formatDuration(route.etaSeconds)}</dd>

            <dt>Searched</dt>
            <dd>
              {route.expanded} of {route.grid.total} cells
            </dd>
          </dl>

          {route.crossesCrop && (
            <p className="promethia-note">
              Final {route.cropCells} {route.cropCells === 1 ? 'cell crosses' : 'cells cross'} planted
              bed to reach the zone.
            </p>
          )}

          <button type="button" className="promethia-clear" onClick={onClear}>
            Clear route
          </button>
        </div>
      )}

      <div className="promethia-obstacles">
        <span className="promethia-obstacles__heading">Obstacles</span>
        {available.map((obstacle) => {
          const active = obstacleIds.includes(obstacle.id)
          return (
            <label key={obstacle.id} className="obstacle-toggle">
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggleObstacle(obstacle.id)}
              />
              <span className="obstacle-toggle__label">{obstacle.label}</span>
              <span className="obstacle-toggle__detail">{obstacle.detail}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes} m ${rest} s` : `${minutes} m`
}

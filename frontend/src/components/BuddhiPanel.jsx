import { CLASSES, SEVERITY } from '../systems/buddhi/classes'

/**
 * BuddhiPanel
 * Starts a scan, shows it progressing, and lists what it found.
 *
 * Findings are ordered by severity rather than by zone label. An operator
 * opening this wants to know what to deal with first, and A1 through D4 is an
 * ordering that serves the map, not the decision.
 */
export function BuddhiPanel({
  status,
  isScanning,
  findings,
  activeZone,
  completedCount,
  total,
  engine,
  onRun,
  onCancel,
  onSelectZone,
  selectedZone,
}) {
  const progress = total ? Math.round((completedCount / total) * 100) : 0
  const healthyCount = completedCount - findings.length

  return (
    <section className="plate buddhi-panel" aria-label="BUDDHI crop analysis">
      <div className="buddhi-panel__head">
        <span className="buddhi-panel__title">BUDDHI</span>
        {/* Says plainly that this is a stand-in. An interface that presents a
            rule-based model as a trained one is misleading about what it knows. */}
        <span className="buddhi-panel__engine">
          {engine.trained ? engine.name : 'simulated model'}
        </span>
      </div>

      {isScanning ? (
        <button type="button" className="buddhi-btn buddhi-btn--cancel" onClick={onCancel}>
          Cancel scan
        </button>
      ) : (
        <button type="button" className="buddhi-btn" onClick={onRun}>
          Run BUDDHI scan
        </button>
      )}

      {isScanning && (
        <div className="buddhi-progress">
          <div className="buddhi-progress__bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="buddhi-progress__label">
            {activeZone ? `Scanning ${activeZone}` : 'Launching'} · {completedCount}/{total}
          </span>
        </div>
      )}

      {status === 'complete' && (
        <p className="buddhi-summary">
          {findings.length === 0
            ? `All ${total} zones healthy.`
            : `${findings.length} of ${total} zones need attention · ${healthyCount} healthy.`}
        </p>
      )}

      {findings.length > 0 && (
        <ul className="buddhi-findings">
          {findings.map((finding) => {
            const condition = CLASSES[finding.problem]
            return (
              <li key={finding.zoneId}>
                <button
                  type="button"
                  className={`finding${selectedZone === finding.zoneId ? ' finding--active' : ''}`}
                  style={{ '--condition': condition.color }}
                  onClick={() => onSelectZone(finding.zoneId)}
                >
                  <span className="finding__zone">{finding.zoneId}</span>
                  <span className="finding__label">{condition.label}</span>
                  <span className={`finding__severity finding__severity--${finding.severity}`}>
                    {SEVERITY[finding.severity].label}
                  </span>
                  <span className="finding__confidence">
                    {(finding.confidence * 100).toFixed(0)}%
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

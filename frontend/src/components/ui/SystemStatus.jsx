/**
 * SystemStatus
 * The five subsystems and what each is doing right now.
 *
 * States are derived from the live simulation rather than stored, so the rail
 * cannot fall out of step with what the machines are actually doing — a status
 * board that says READY while the rover is mid-irrigation is worse than no
 * board at all.
 *
 * Tone rather than colour carries most of the meaning: three muted states
 * (idle, working, done) instead of a traffic-light palette, because a panel of
 * green and amber pills reads as an alarm system, not an instrument.
 */
export function SystemStatus({ pegasus, buddhi, promethia, talos, mercatus }) {
  const rows = [
    { id: 'pegasus', name: 'Pegasus', role: 'Aerial survey', ...pegasus },
    { id: 'buddhi', name: 'Buddhi', role: 'Crop analysis', ...buddhi },
    { id: 'promethia', name: 'Promethia', role: 'Route planning', ...promethia },
    { id: 'talos', name: 'Talos', role: 'Ground rover', ...talos },
    { id: 'mercatus', name: 'Mercatus', role: 'Resource analysis', ...mercatus },
  ]

  return (
    <section className="rail-card" aria-label="System status">
      <h2 className="rail-card__title">System status</h2>

      <ul className="status-list">
        {rows.map((row) => (
          <li key={row.id} className={`status-row status-row--${row.tone}`}>
            <span className="status-row__dot" aria-hidden="true" />
            <span className="status-row__name">{row.name}</span>
            <span className="status-row__role">{row.role}</span>
            <span className="status-row__state">{row.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Derives every subsystem's state from live simulation values.
 * Kept beside the component so the labels and the logic that produces them
 * stay in one place.
 */
export function deriveSystemStatus({ droneMode, scan, promethiaRoute, talosMode, inspection, missions }) {
  const droneLabels = {
    idle: 'Online',
    takeoff: 'Launching',
    hover: scan?.isScanning ? 'Scanning' : 'Airborne',
    landing: 'Landing',
  }

  const talosLabels = {
    idle: 'Idle',
    navigating: 'Navigating',
    inspecting: inspection?.stage === 'irrigating' ? 'Irrigating' : 'Inspecting',
    blocked: 'No route',
  }

  return {
    pegasus: {
      label: droneLabels[droneMode] ?? 'Online',
      tone: droneMode === 'idle' ? 'idle' : 'working',
    },
    buddhi: {
      label: scan?.isScanning
        ? `Analysing ${scan.completedCount}/${scan.total}`
        : scan?.status === 'complete'
          ? `${scan.findings.length} flagged`
          : 'Ready',
      tone: scan?.isScanning ? 'working' : scan?.status === 'complete' ? 'done' : 'idle',
    },
    promethia: {
      label: promethiaRoute?.ok
        ? `${promethiaRoute.steps} cells → ${promethiaRoute.targetZone}`
        : 'Ready',
      tone: promethiaRoute?.ok ? 'done' : 'idle',
    },
    talos: {
      label: talosLabels[talosMode] ?? 'Idle',
      tone: talosMode === 'idle' ? 'idle' : 'working',
    },
    mercatus: {
      label: missions > 0 ? `${missions} logged` : 'Ready',
      tone: missions > 0 ? 'done' : 'idle',
    },
  }
}

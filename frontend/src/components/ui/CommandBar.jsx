import { FOCUS_VIEWS } from '../../systems/droneConfig'

/**
 * CommandBar
 * The bar along the bottom: run the demo, move the camera, open the module
 * controls.
 *
 * Everything here is an action. Readouts live in the side rails, which is what
 * keeps this strip shallow — the farm needs the vertical space more than the
 * interface does.
 */

const CAMERA_SHORTCUTS = ['farm', 'pegasus', 'talos', 'problem', 'overview']

export function CommandBar({
  demo,
  focus,
  onFocus,
  hasProblem,
  modulesOpen,
  onToggleModules,
  onHideUi,
  onStart,
  onReset,
}) {
  return (
    <div className="commandbar">
      <div className="commandbar__group commandbar__group--primary">
        {!demo.running ? (
          <button type="button" className="cmd cmd--start" onClick={onStart}>
            Start full demo
          </button>
        ) : demo.paused ? (
          <button type="button" className="cmd cmd--start" onClick={demo.resume}>
            Resume
          </button>
        ) : (
          <button type="button" className="cmd cmd--hold" onClick={demo.pause}>
            Pause
          </button>
        )}

        <button type="button" className="cmd" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="commandbar__group commandbar__group--camera">
        <span className="commandbar__legend">Camera</span>
        {CAMERA_SHORTCUTS.map((key) => {
          // The problem-zone shortcut is inert until a scan has found one.
          const disabled = key === 'problem' && !hasProblem
          return (
            <button
              key={key}
              type="button"
              className={`cmd cmd--ghost${focus === key ? ' cmd--active' : ''}`}
              onClick={() => onFocus(key)}
              disabled={disabled}
              title={disabled ? 'Run a scan to identify a problem zone' : undefined}
            >
              {FOCUS_VIEWS[key].label}
            </button>
          )
        })}
      </div>

      <div className="commandbar__group commandbar__group--end">
        <button
          type="button"
          className={`cmd cmd--ghost${modulesOpen ? ' cmd--active' : ''}`}
          onClick={onToggleModules}
          aria-expanded={modulesOpen}
        >
          {modulesOpen ? 'Hide modules' : 'Module controls'}
        </button>

        {/* Clears every panel for a full-screen view of the field. */}
        <button type="button" className="cmd cmd--ghost" onClick={onHideUi} title="Hide interface (H)">
          Hide UI
        </button>
      </div>
    </div>
  )
}

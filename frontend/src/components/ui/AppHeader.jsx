import { APP_META } from '../../data/appMeta'

/**
 * AppHeader
 * The title bar across the top of the screen.
 *
 * Kept to a single slim strip. The farm is the thing being demonstrated, and
 * every pixel of header is a pixel of field the viewer cannot see — so the
 * wordmark, the description and the live indicator share one line rather than
 * occupying a masthead.
 */
export function AppHeader({ demoRunning, demoPaused }) {
  const state = demoPaused ? 'paused' : demoRunning ? 'running' : 'standby'
  const label = demoPaused ? 'Paused' : demoRunning ? 'Mission active' : 'Standby'

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <h1 className="topbar__name">
          {APP_META.name}
          <span className="topbar__figure">{APP_META.figure}</span>
        </h1>
        <p className="topbar__tagline">{APP_META.tagline}</p>
      </div>

      <div className={`topbar__state topbar__state--${state}`}>
        <span className="topbar__dot" aria-hidden="true" />
        {label}
      </div>
    </header>
  )
}

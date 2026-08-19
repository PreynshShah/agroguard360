import { useState } from 'react'

/**
 * ModuleDrawer
 * Holds the per-module control panels behind tabs.
 *
 * Phase 9 required every module to stay independently operable, and the
 * previous layout achieved that by stacking ten panels down both sides of the
 * screen — which buried the farm and read as an admin dashboard rather than a
 * digital twin.
 *
 * The panels are unchanged and still fully functional. They are simply closed
 * by default and one at a time when open, so the demonstration shows a field
 * with an interface on it rather than an interface with a field behind it.
 */
export function ModuleDrawer({ open, onClose, tabs }) {
  const [active, setActive] = useState(tabs[0]?.id)

  if (!open) return null

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]

  return (
    <aside className="drawer" aria-label="Module controls">
      <div className="drawer__head">
        <div className="drawer__tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === current.id}
              className={`drawer__tab${tab.id === current.id ? ' drawer__tab--active' : ''}`}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button type="button" className="drawer__close" onClick={onClose} aria-label="Close module controls">
          ×
        </button>
      </div>

      <div className="drawer__body" role="tabpanel">
        {current.render()}
      </div>
    </aside>
  )
}

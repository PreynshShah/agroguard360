import { VIEW_CONTROLS } from '../data/appMeta'

/**
 * ViewControlsKey
 * A field-manual key for moving the camera. Phase 1 has no interface to learn
 * beyond the view itself, so this is the one thing worth spelling out.
 */
export function ViewControlsKey() {
  return (
    <aside className="plate controls-key" aria-label="View controls">
      <h2 className="controls-key__heading">View controls</h2>
      <dl className="controls-key__list">
        {VIEW_CONTROLS.map(({ input, result }) => (
          <div key={input} style={{ display: 'contents' }}>
            <dt>{input}</dt>
            <dd>{result}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}

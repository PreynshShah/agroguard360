/**
 * EventLog
 * A running record of what each subsystem is doing.
 *
 * Newest first. A chat-style log that appends downward has to be scrolled to
 * follow, and auto-scrolling fights the reader the moment they look back at an
 * earlier line. Newest-first means the interesting line is always in the same
 * place and nothing moves under the cursor.
 */

const KIND_LABEL = {
  step: 'Step',
  ok: 'OK',
  alert: 'Alert',
  warn: 'Warn',
  data: 'Data',
  info: '',
}

export function EventLog({ events }) {
  return (
    <section className="plate log-panel" aria-label="Event log">
      <div className="log__head">
        <span className="log__title">Event log</span>
        {events.length > 0 && <span className="log__count">{events.length}</span>}
      </div>

      {events.length === 0 ? (
        <p className="log__empty">No activity yet.</p>
      ) : (
        <ul className="log__list">
          {events.map((event) => (
            <li key={event.id} className={`log__entry log__entry--${event.kind}`}>
              <span className="log__time">{formatClock(event.at)}</span>
              <span className="log__text">{event.text}</span>
              {KIND_LABEL[event.kind] && (
                <span className="log__kind">{KIND_LABEL[event.kind]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatClock(at) {
  const d = new Date(at)
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

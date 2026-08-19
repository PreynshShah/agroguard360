import { DEMO_STEPS, stepIndex } from '../systems/demoSequence'

/**
 * DemoControls
 * The headline control: start, pause, resume, reset — and a tracker showing
 * where in the ten steps the sequence has reached.
 *
 * The tracker is the reason this panel is worth its space. A demonstration
 * that runs for four minutes with only a spinner leaves a viewer unsure
 * whether anything is happening; naming the current step turns waiting into
 * following along.
 */
export function DemoControls({ running, paused, currentStep, onStart, onPause, onResume, onReset }) {
  const activeIndex = currentStep ? stepIndex(currentStep) : -1

  return (
    <section className="plate demo-panel" aria-label="Full demonstration">
      <div className="demo__head">
        <span className="demo__title">Full demo</span>
        {running && (
          <span className={`demo__state${paused ? ' demo__state--paused' : ''}`}>
            {paused ? 'Paused' : 'Running'}
          </span>
        )}
      </div>

      {!running && (
        <button type="button" className="demo__start" onClick={onStart}>
          Start full demo
        </button>
      )}

      {running && (
        <div className="demo__transport">
          {paused ? (
            <button type="button" className="demo__btn demo__btn--primary" onClick={onResume}>
              Resume
            </button>
          ) : (
            <button type="button" className="demo__btn" onClick={onPause}>
              Pause
            </button>
          )}
          <button type="button" className="demo__btn" onClick={onReset}>
            Reset
          </button>
        </div>
      )}

      {!running && activeIndex >= 0 && (
        <button type="button" className="demo__btn demo__btn--wide" onClick={onReset}>
          Reset
        </button>
      )}

      <ol className="demo__steps">
        {DEMO_STEPS.map((step, index) => {
          const state =
            index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'
          return (
            <li key={step.id} className={`demo__step demo__step--${state}`}>
              <span className="demo__step-num">{step.number}</span>
              <span className="demo__step-label">{step.label}</span>
              {index === activeIndex && <span className="demo__step-detail">{step.detail}</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

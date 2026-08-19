import { useState } from 'react'

import {
  costBreakdown,
  energyBreakdown,
  formatMoney,
  formatDuration,
  RATES,
  CURRENCY,
} from '../systems/mercatus'

/**
 * MercatusPanel
 * Resource and economic analysis for the session.
 *
 * The design rule throughout: no financial figure appears without its status
 * attached. The banner is not decoration — it is the most important element in
 * the panel, and it sits above the numbers rather than below them.
 *
 * Charts are hand-drawn SVG. A charting library would add a large dependency
 * to render four bars, and these need to inherit the interface's own type and
 * colour rather than fight a library's defaults.
 */
export function MercatusPanel({ analysis, onReset }) {
  const [showAssumptions, setShowAssumptions] = useState(false)
  const { resources, costs, savings, roi } = analysis
  const hasData = resources.missionCount > 0

  return (
    <section className="plate mercatus-panel" aria-label="MERCATUS economic analysis">
      <div className="mercatus__head">
        <span className="mercatus__title">MERCATUS</span>
        {hasData && (
          <button type="button" className="mercatus__reset" onClick={onReset}>
            Reset
          </button>
        )}
      </div>

      {/* Above the numbers, never beneath them. */}
      <div className="mercatus__banner">Simulation estimate</div>

      {!hasData && (
        <p className="mercatus__empty">
          No missions recorded yet. Run a BUDDHI scan, plan a route, and deploy TALOS.
        </p>
      )}

      {hasData && (
        <>
          <dl className="mercatus__figures">
            <div>
              <dt>Water used</dt>
              <dd>{resources.waterMl.toFixed(0)} ml</dd>
            </div>
            <div>
              <dt>Treatments</dt>
              <dd>
                {resources.treatedZones}
                <em>of {resources.missionCount} visits</em>
              </dd>
            </div>
            <div>
              <dt>Robot distance</dt>
              <dd>{resources.distanceMeters.toFixed(0)} m</dd>
            </div>
            <div>
              <dt>Operating time</dt>
              <dd>{formatDuration(resources.roverPoweredSeconds)}</dd>
            </div>
            <div>
              <dt>Treatment time</dt>
              <dd>{formatDuration(resources.treatmentSeconds)}</dd>
            </div>
            <div>
              <dt>Energy</dt>
              <dd>{resources.energyWh.toFixed(1)} Wh</dd>
            </div>
          </dl>

          <div className="mercatus__totals">
            <div className="mercatus__total">
              <span>Est. cost</span>
              <strong>{formatMoney(costs.total)}</strong>
            </div>
            <div className="mercatus__total">
              <span>Est. savings</span>
              <strong>{formatMoney(savings.total)}</strong>
            </div>
            <div className="mercatus__total">
              <span>Est. ROI</span>
              <strong className={roi != null && roi < 0 ? 'mercatus__negative' : ''}>
                {roi == null ? '—' : `${roi.toFixed(0)}%`}
              </strong>
            </div>
          </div>

          {/* The ROI figure is never shown alone when one assumption drives it. */}
          {analysis.caveat && <p className="mercatus__caveat">{analysis.caveat}</p>}
          <p className="mercatus__basis">{analysis.roiBasis}</p>

          <BarChart
            title="Estimated cost breakdown"
            rows={costBreakdown(analysis)}
            format={(v) => formatMoney(v)}
          />

          <BarChart
            title="Energy by subsystem"
            rows={energyBreakdown(analysis)}
            format={(v) => `${v.toFixed(1)} Wh`}
          />

          <CostVsSavings analysis={analysis} />
        </>
      )}

      <button
        type="button"
        className="mercatus__disclose"
        onClick={() => setShowAssumptions((v) => !v)}
        aria-expanded={showAssumptions}
      >
        {showAssumptions ? 'Hide assumptions' : 'Assumptions and exclusions'}
      </button>

      {showAssumptions && (
        <div className="mercatus__assumptions">
          <p>
            Rates below are illustrative placeholders, not researched market prices. Replace
            them with local figures before drawing any conclusion.
          </p>
          <dl>
            <dt>Water</dt>
            <dd>
              {CURRENCY.symbol}
              {RATES.waterPerLitre.toFixed(2)} / litre
            </dd>
            <dt>Energy</dt>
            <dd>
              {CURRENCY.symbol}
              {RATES.energyPerKwh.toFixed(2)} / kWh
            </dd>
            <dt>Machine</dt>
            <dd>
              {CURRENCY.symbol}
              {RATES.machineHour} / hour
            </dd>
            <dt>Labour</dt>
            <dd>
              {CURRENCY.symbol}
              {RATES.labourHour} / hour
            </dd>
          </dl>

          <p className="mercatus__excl-head">Deliberately not modelled</p>
          <ul>
            {analysis.exclusions.map((item) => (
              <li key={item.item}>
                <strong>{item.item}</strong>
                {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/**
 * Horizontal bars. Horizontal rather than vertical because the labels are
 * words, and vertical bars would force them sideways or into a legend.
 */
function BarChart({ title, rows, format }) {
  const max = Math.max(...rows.map((row) => row.value), 0.0001)

  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <div className="chart__rows">
        {rows.map((row) => (
          <div key={row.key} className="chart__row">
            <span className="chart__label">{row.label}</span>
            <span className="chart__track">
              <span
                className="chart__bar"
                style={{
                  width: `${Math.max(1.5, (row.value / max) * 100)}%`,
                  background: row.color,
                }}
              />
            </span>
            <span className="chart__value">{format(row.value)}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}

/**
 * Cost against savings on one shared scale.
 *
 * Two bars on a common axis, so the comparison is read from the geometry
 * rather than from the numbers. Separate scales would let a tiny cost and a
 * large saving draw identical bars, which is the most common way a chart
 * like this misleads.
 */
function CostVsSavings({ analysis }) {
  const cost = analysis.costs.total
  const saving = analysis.savings.total
  const max = Math.max(cost, saving, 0.0001)

  const width = 240
  const height = 74
  const barHeight = 20
  const labelWidth = 54

  const bar = (value, y, color) => (
    <>
      <rect
        x={labelWidth}
        y={y}
        width={Math.max(2, ((value / max) * (width - labelWidth - 54)))}
        height={barHeight}
        fill={color}
        rx="1.5"
      />
      <text
        x={labelWidth + Math.max(2, (value / max) * (width - labelWidth - 54)) + 6}
        y={y + barHeight / 2 + 3.5}
        className="chart__svg-value"
      >
        {formatMoney(value)}
      </text>
    </>
  )

  return (
    <figure className="chart">
      <figcaption>Estimated cost vs savings</figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart__svg"
        role="img"
        aria-label={`Estimated cost ${formatMoney(cost)}, estimated savings ${formatMoney(saving)}`}
      >
        <text x="0" y="18" className="chart__svg-label">
          Cost
        </text>
        {bar(cost, 5, '#a24f3f')}

        <text x="0" y="52" className="chart__svg-label">
          Savings
        </text>
        {bar(saving, 39, '#5f7d4e')}

        {/* Shared baseline, so both bars are visibly on one scale. */}
        <line x1={labelWidth} y1="0" x2={labelWidth} y2={height - 8} className="chart__axis" />
      </svg>
    </figure>
  )
}

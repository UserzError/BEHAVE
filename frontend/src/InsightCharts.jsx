// InsightCharts — the results page's deeper look at the telemetry:
//   CloseCalls          do closer votes take longer? (how split each vote was vs. average decision time)
//   CharacterHesitation which characters make people take longer or change their minds
//   DesignChecks        left/right bias and position-in-the-poll effects (from /insights)
// Every chart also has a "Show as a table" view for screen readers and anyone who prefers numbers.
import { Chart as ChartJS, LineElement, PointElement } from 'chart.js'
import { Bar, Line, Scatter } from 'react-chartjs-2'
import { CHARACTER_BY_ID } from './characters.jsx'
import { characterHesitation, correlation, describeCorrelation, describeSideBias, splitScore } from './insightMath.js'

ChartJS.register(PointElement, LineElement)

const pct = (x) => `${Math.round(x * 100)}%`
const sec = (ms) => `${(ms / 1000).toFixed(1)} s`

function axesFor(colors, { xLabel, yLabel, xTick, yTick, indexAxis }) {
  const axis = (label, tick) => ({
    beginAtZero: true,
    grid: { color: colors.grid },
    ticks: { color: colors.text, ...(tick && { callback: tick }) }, // no callback = Chart.js's default labels
    title: label ? { display: true, text: label, color: colors.text } : undefined,
  })
  const scales = { x: axis(xLabel, xTick), y: axis(yLabel, yTick) }
  if (indexAxis === 'y') scales.y = { grid: { display: false }, ticks: { color: colors.text } }
  return scales
}

function TableView({ caption, head, rows }) {
  return (
    <details className="table-view">
      <summary>Show as a table</summary>
      <div className="table-wrap">
        <table>
          <caption className="visually-hidden">{caption}</caption>
          <thead><tr>{head.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i ? 'num' : ''}>{c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function CloseCalls({ rows, colors, dark }) {
  const points = rows
    .map((r) => ({ r, split: splitScore(r.votes) }))
    .filter((p) => p.split !== null)
  const r = correlation(points.map((p) => p.split), points.map((p) => p.r.avg_decision_ms))
  const data = {
    datasets: [{
      label: 'Scenarios',
      data: points.map((p) => ({ x: Math.round(p.split * 100), y: p.r.avgSeconds })),
      backgroundColor: colors.time,
      pointRadius: 6,
      pointHoverRadius: 8,
    }],
  }
  const options = {
    maintainAspectRatio: false,
    color: colors.text,
    scales: axesFor(colors, {
      xLabel: 'How split the vote was (0% = everyone agreed, 100% = even split)',
      yLabel: 'Average decision time',
      xTick: (v) => `${v}%`,
      yTick: (v) => `${v} s`,
    }),
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const row = points[ctx.dataIndex].r
            return ` ${row.name} (${row.title}): ${ctx.raw.x}% split, ${ctx.raw.y} s`
          },
        },
      },
    },
  }
  return (
    <div className="card">
      <h2>Do close calls take longer?</h2>
      <p className="muted">
        Each dot is a scenario. {describeCorrelation(r)}
        {r !== null && <> (correlation r = {r.toFixed(2)} across {points.length} scenarios)</>}
      </p>
      <div style={{ height: 320 }}>
        <Scatter key={`split-${dark}`} data={data} options={options} role="img"
          aria-label="Scatter chart of how split each scenario's vote was against its average decision time" />
      </div>
      <TableView
        caption="How split each vote was and the average decision time"
        head={['Scenario', 'How split', 'Avg. decision']}
        rows={points.map((p) => [`${p.r.name} · ${p.r.title}`, pct(p.split), `${p.r.avgSeconds} s`])}
      />
    </div>
  )
}

export function CharacterHesitation({ rows, colors, dark }) {
  const { overallMs, overallChanged, items } = characterHesitation(rows)
  if (!items.length) return null
  const label = (t) => `${CHARACTER_BY_ID[t.type]?.label ?? t.type} (${t.scenarios})`
  // Bars show the difference from the overall average: every scenario takes several seconds, so
  // plain totals would all look alike. Right of zero = slower than average, left = faster.
  const diff = (t) => Math.round((t.avgMs - overallMs) / 100) / 10
  const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} s`
  const data = {
    labels: items.map(label),
    datasets: [{
      label: 'Difference from the average decision time',
      data: items.map(diff),
      backgroundColor: items.map((t) => (diff(t) >= 0 ? colors.time : colors.faster)),
      borderRadius: 4,
      borderSkipped: false,
      barPercentage: 0.7,
    }],
  }
  const options = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    color: colors.text,
    scales: axesFor(colors, { xTick: signed, indexAxis: 'y' }),
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const t = items[ctx.dataIndex]
            return ` ${signed(diff(t))} vs. average: ${sec(t.avgMs)}, ${pct(t.changedRate)} changed their mind (${t.scenarios} scenarios, ${t.answers} answers)`
          },
        },
      },
    },
  }
  return (
    <div className="card">
      <h2>Who makes people hesitate?</h2>
      <p className="muted">
        How much longer (or shorter) people took in scenarios that include each character, compared with the
        average of {sec(overallMs)} across all scenarios ({pct(overallChanged)} changed their mind overall).
        The number of scenarios is in brackets; characters in only one or two are a small sample.
      </p>
      <div style={{ height: items.length * 30 + 60 }}>
        <Bar key={`chars-${dark}`} data={data} options={options} role="img"
          aria-label="Average decision time in scenarios that include each character" />
      </div>
      <TableView
        caption="Hesitation by character"
        head={['Character', 'Scenarios', 'Avg. decision', 'Vs. average', 'Changed mind']}
        rows={items.map((t) => [CHARACTER_BY_ID[t.type]?.label ?? t.type, t.scenarios, sec(t.avgMs), signed(diff(t)), pct(t.changedRate)])}
      />
    </div>
  )
}

export function DesignChecks({ insights, colors, dark }) {
  if (!insights) return null
  const { side, by_position: positions } = insights
  const data = {
    labels: positions.map((p) => p.position),
    datasets: [{
      label: 'Average decision time',
      data: positions.map((p) => Math.round(p.avg_decision_ms / 100) / 10),
      borderColor: colors.time,
      backgroundColor: colors.time,
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.2,
    }],
  }
  const options = {
    maintainAspectRatio: false,
    color: colors.text,
    scales: axesFor(colors, { xLabel: 'Scenario number in the poll (1 = first one shown)', yTick: (v) => `${v} s` }),
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} s on average (${positions[ctx.dataIndex].answers} answers)` } } },
  }
  return (
    <div className="card">
      <h2>Checking the poll itself</h2>
      <p className="muted">Sides are randomized and scenarios are shuffled for each person. These checks show whether that matters.</p>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{side.left_share === null ? '–' : pct(side.left_share)}</span>
          <span className="stat-label">chose the option shown on the <strong>left</strong> ({side.answers} answers)</span>
        </div>
        <p className="stat-note">{describeSideBias(side)}</p>
      </div>

      <h3 className="subheading">Over the course of the poll</h3>
      <p className="muted">Average decision time for the 1st, 2nd, 3rd… scenario each person saw. A falling line means people speed up as they go.</p>
      {positions.length > 0 ? (
        <>
          <div style={{ height: 240 }}>
            <Line key={`pos-${dark}`} data={data} options={options} role="img"
              aria-label="Average decision time by the scenario's position in the poll" />
          </div>
          <TableView
            caption="Decision time, changed-mind rate and indifferent rate by position in the poll"
            head={['Position', 'Answers', 'Avg. decision', 'Changed mind', 'Indifferent']}
            rows={positions.map((p) => [p.position, p.answers, sec(p.avg_decision_ms), pct(p.changed_rate), pct(p.indifferent_rate)])}
          />
        </>
      ) : <p className="muted">No answers with a recorded position yet.</p>}
      {side.seeded > 0 && (
        <p className="muted small">Includes simulated answers, which have no side or order effects built in.</p>
      )}
    </div>
  )
}

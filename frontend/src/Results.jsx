// Results page: what people chose, how long they hesitated, and a table with every number.
import { useEffect, useState } from 'react'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { loadResults } from './api.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)
ChartJS.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif'

// Read a color from index.css, so the charts follow light/dark mode.
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// Re-render when the system switches between light and dark mode.
function useColorScheme() {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const media = matchMedia(query)
    const onChange = (e) => setDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return dark
}

// Merge /results with /scenarios into one row per scenario, ordered s1, s2, … s10.
function buildRows(results, scenarios) {
  const byId = Object.fromEntries(scenarios.map((s) => [s.id, s]))
  return [...results]
    .sort((a, b) => a.scenario_id.localeCompare(b.scenario_id, undefined, { numeric: true }))
    .map((r, i) => {
      const s = byId[r.scenario_id]
      const total = r.votes.A + r.votes.B
      const pctA = total ? Math.round((r.votes.A / total) * 100) : 0
      return {
        ...r,
        name: `Scenario ${i + 1}`,
        title: s ? s.title : `${r.scenario_id} (deleted)`,
        labelA: s ? s.outcomes.stay.label : 'Option A (stay)',
        labelB: s ? s.outcomes.swerve.label : 'Option B (swerve)',
        killedA: s ? s.outcomes.stay.group.length : '?',
        killedB: s ? s.outcomes.swerve.group.length : '?',
        pctA,
        pctB: total ? 100 - pctA : 0,
        avgSeconds: Math.round(r.avg_decision_ms / 100) / 10, // one decimal place
      }
    })
}

export default function Results() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const dark = useColorScheme()

  useEffect(() => {
    loadResults().then(setData).catch((err) => {
      console.error(err)
      setError(true)
    })
  }, [])

  if (error) return <p className="muted">Couldn't load results.</p>
  if (!data) return <p className="muted">Loading…</p>

  const rows = buildRows(data.results, data.scenarios)
  const totalVotes = rows.reduce((sum, r) => sum + r.votes.A + r.votes.B, 0)

  // Chart colors: A and B match the poll's red and blue squares.
  const colors = {
    A: cssVar('--red'),
    B: cssVar('--blue'),
    time: dark ? '#9085e9' : '#4a3aa7', // violet, so it isn't mistaken for option B
    surface: cssVar('--surface'),
    text: cssVar('--text-muted'),
    grid: dark ? '#2c2c2a' : '#e1e0d9',
  }

  const labels = rows.map((r) => r.name)
  const chartHeight = rows.length * 48 + 70 // fixed height per scenario row
  const barStyle = { borderRadius: 4, borderSkipped: false, borderColor: colors.surface, borderWidth: 2, barPercentage: 0.7 }
  const axes = (stacked, { max, tickLabel }) => ({
    x: {
      stacked, max, beginAtZero: true,
      grid: { color: colors.grid }, border: { display: false },
      ticks: { color: colors.text, callback: tickLabel },
    },
    y: { stacked, grid: { display: false }, border: { color: colors.grid }, ticks: { color: colors.text } },
  })

  const votesData = {
    labels,
    datasets: ['A', 'B'].map((letter) => ({
      label: `Option ${letter}`,
      data: rows.map((r) => r[`pct${letter}`]),
      backgroundColor: colors[letter],
      ...barStyle,
    })),
  }
  const votesOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    color: colors.text, // legend and label text
    scales: axes(true, { max: 100, tickLabel: (v) => `${v}%` }),
    plugins: {
      legend: { position: 'top', align: 'start', labels: { boxWidth: 12, boxHeight: 12 } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const row = rows[ctx.dataIndex]
            const letter = ctx.datasetIndex === 0 ? 'A' : 'B'
            return ` ${row[`label${letter}`]}: ${ctx.raw}% (${row.votes[letter]} votes)`
          },
        },
      },
    },
  }

  const timeData = {
    labels,
    datasets: [{ label: 'Average decision time', data: rows.map((r) => r.avgSeconds), backgroundColor: colors.time, ...barStyle }],
  }
  const timeOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    color: colors.text, // legend and label text
    scales: axes(false, { tickLabel: (v) => `${v} s` }),
    plugins: {
      legend: { display: false }, // one series; the card title names it
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} s on average` } },
    },
  }

  return (
    <section className="results">
      <h1>Results</h1>
      <p className="disclaimer" role="note">
        <strong>For demonstration purposes only.</strong> This data will not be used for research.
      </p>
      {data.demo && <p className="notice">Demo mode: the backend isn't running, so this is sample data.</p>}

      {rows.length === 0 ? (
        <p className="muted">No answers yet.</p>
      ) : (
        <>
          <p className="muted">{totalVotes} answers across {rows.length} scenarios.</p>

          <div className="card">
            <h2>What people chose</h2>
            <p className="muted">Share of participants who picked each option.</p>
            <div style={{ height: chartHeight }}>
              {/* key forces a fresh chart when light/dark mode changes */}
              <Bar key={`votes-${dark}`} data={votesData} options={votesOptions}
                aria-label="Share of votes for option A and option B in each scenario" role="img" />
            </div>
          </div>

          <div className="card">
            <h2>How long they hesitated</h2>
            <p className="muted">Average time from seeing the scenario to confirming a choice, in seconds.</p>
            <div style={{ height: chartHeight }}>
              <Bar key={`time-${dark}`} data={timeData} options={timeOptions}
                aria-label="Average decision time in each scenario" role="img" />
            </div>
          </div>

          <div className="card">
            <h2>All numbers</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Option A</th>
                    <th>Option B</th>
                    <th className="num">Votes A</th>
                    <th className="num">Votes B</th>
                    <th className="num">Avg. decision</th>
                    <th className="num">Changed mind</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.scenario_id}>
                      <td><span className="nowrap">{r.name}</span><br /><span className="muted">{r.title}</span></td>
                      <td>{r.labelA} ({r.killedA} killed)</td>
                      <td>{r.labelB} ({r.killedB} killed)</td>
                      <td className="num">{r.votes.A} ({r.pctA}%)</td>
                      <td className="num">{r.votes.B} ({r.pctB}%)</td>
                      <td className="num">{r.avgSeconds} s</td>
                      <td className="num">{Math.round(r.changed_rate * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <a className="primary" href="#/">Take the poll</a>
    </section>
  )
}

// ScenarioList — every saved scenario, with Edit and Delete, plus a button for a new one.
import { useEffect, useState } from 'react'
import { Character } from './characters.jsx'
import { deleteScenario, loadScenarios } from './api.js'
import { DILEMMAS } from './scene.js'

export default function ScenarioList({ onEdit, onNew, message, onUnauthorized }) {
  const [scenarios, setScenarios] = useState(null)
  const [demo, setDemo] = useState(false)
  const [status, setStatus] = useState(message)

  useEffect(() => {
    loadScenarios().then(({ scenarios, demo }) => {
      setScenarios(scenarios)
      setDemo(demo)
    })
  }, [])

  async function remove(s) {
    if (!window.confirm(`Delete “${s.title}” (${s.id})? Answers already given to it stay in the results.`)) return
    try {
      await deleteScenario(s.id)
      setScenarios((list) => list.filter((x) => x.id !== s.id))
      setStatus(`Deleted “${s.title}”.`)
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      setStatus(err.message)
    }
  }

  if (!scenarios) return <p className="muted">Loading…</p>

  return (
    <div className="scenario-list">
      <div className="list-header">
        <div>
          <h1>Scenario designer</h1>
          <p className="muted">{scenarios.length} scenario{scenarios.length === 1 ? '' : 's'}. Participants see them in a random order.</p>
        </div>
        <button type="button" className="primary" onClick={onNew} disabled={demo}>+ New scenario</button>
      </div>
      {demo && <p className="notice">The backend isn't running, so these are the sample scenarios and nothing can be saved. Start it with <code>python app.py</code> in <code>backend/</code>.</p>}
      {status && <p className="notice" role="status">{status}</p>}

      <ul className="list-rows">
        {scenarios.map((s) => (
          <li key={s.id} className="card list-row">
            <div className="list-main">
              <strong>{s.title}</strong> <span className="muted">· {s.id}</span>
              <div className="muted">{DILEMMAS[s.dilemma]?.label}{s.description ? ` · ${s.description}` : ''}</div>
            </div>
            <div className="list-groups" aria-hidden="true">
              {['stay', 'swerve'].map((o) => (
                <span key={o} className="list-group">
                  {s.outcomes[o].group.map((p, i) => <Character key={i} type={p.type} />)}
                </span>
              ))}
            </div>
            <div className="list-actions">
              <button type="button" className="secondary" onClick={() => onEdit(s)} disabled={demo}>Edit</button>
              <button type="button" className="secondary danger" onClick={() => remove(s)} disabled={demo}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

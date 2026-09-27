// AdminApp (#/admin) — asks for the admin token once, then shows the scenario list or the editor.
import { useState } from 'react'
import ScenarioEditor from './ScenarioEditor.jsx'
import ScenarioList from './ScenarioList.jsx'
import { checkAdminToken, getAdminToken, loadScenarios, setAdminToken } from './api.js'

function TokenPrompt({ onAccepted }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setChecking(true)
    setError('')
    try {
      await checkAdminToken(token.trim())
      setAdminToken(token.trim())
      onAccepted()
    } catch (err) {
      // No backend: still let them look around (in demo mode nothing can be saved anyway).
      if (!err.status) {
        const { demo } = await loadScenarios()
        if (demo) return onAccepted()
      }
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <form className="card token-prompt" onSubmit={submit}>
      <h1>Scenario designer</h1>
      <p className="muted">Enter the admin token (the <code>ADMIN_TOKEN</code> value in <code>backend/.env</code>). It's kept only until you close this tab.</p>
      <label className="field">
        Admin token
        <input type="password" value={token} autoComplete="current-password" onChange={(e) => setToken(e.target.value)} />
      </label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={checking}>{checking ? 'Checking…' : 'Continue'}</button>
    </form>
  )
}

export default function AdminApp() {
  const [hasToken, setHasToken] = useState(() => getAdminToken() !== '')
  const [editing, setEditing] = useState(undefined) // undefined = list, null = new scenario, object = edit that one
  const [message, setMessage] = useState('')

  function unauthorized() {
    setAdminToken('')
    setHasToken(false)
  }

  if (!hasToken) return <TokenPrompt onAccepted={() => setHasToken(true)} />

  if (editing !== undefined) {
    return (
      <ScenarioEditor
        key={editing?.id ?? 'new'}
        initial={editing}
        onUnauthorized={unauthorized}
        onDone={(msg) => { setMessage(msg); setEditing(undefined) }}
      />
    )
  }

  return (
    <ScenarioList
      message={message}
      onNew={() => setEditing(null)}
      onEdit={(s) => setEditing(s)}
      onUnauthorized={unauthorized}
    />
  )
}

// Scenario designer (admin panel), opened at /#/admin.
// Edits a list of scenarios in the browser and exports it as scenarios.json.
// Nothing is saved to the server: put the exported file in backend/scenarios.json.
import { useEffect, useState } from 'react'
import OptionEditor from './OptionEditor.jsx'
import { loadScenarios } from './api.js'
import {
  TEMPLATES, clearDraft, findProblems, loadDraft, newFromTemplate, nextId, normalize, saveDraft,
} from './designerData.js'

export default function Designer() {
  // Start from your saved draft if there is one, otherwise the backend's (or sample) scenarios.
  const [draft] = useState(loadDraft)                 // read once, when the page opens
  const [scenarios, setScenarios] = useState(draft)   // null while loading
  const [current, setCurrent] = useState(0)           // index of the scenario being edited
  const [edited, setEdited] = useState(draft !== null) // true once you change something (then it's saved as a draft)
  const [status, setStatus] = useState(draft ? 'Restored your unsaved draft from this browser.' : '')

  useEffect(() => {
    if (draft) return
    loadScenarios().then(({ scenarios }) => setScenarios(scenarios.map(normalize)))
  }, [draft])

  // Keep the draft in this browser after every edit.
  useEffect(() => {
    if (edited && scenarios) saveDraft(scenarios)
  }, [scenarios, edited])

  if (!scenarios) return <p className="muted">Loading…</p>

  const scenario = scenarios[current]
  const problems = findProblems(scenarios)

  // Every edit goes through here: change a copy of the list, then clean it up (e.g. drop signals with no pedestrians).
  function edit(change) {
    setScenarios((list) => {
      const copy = structuredClone(list)
      change(copy)
      return copy.map(normalize)
    })
    setEdited(true)
  }
  const editCurrent = (change) => edit((list) => change(list[current]))

  function addFromTemplate(template) {
    edit((list) => { list.push(newFromTemplate(template, nextId(list))) })
    setCurrent(scenarios.length)
  }

  function duplicate() {
    edit((list) => {
      const copy = structuredClone(list[current])
      copy.id = nextId(list)
      list.splice(current + 1, 0, copy)
    })
    setCurrent(current + 1)
  }

  function remove() {
    edit((list) => { list.splice(current, 1) })
    setCurrent(Math.max(0, Math.min(current, scenarios.length - 2)))
  }

  // Returns the JSON text, or null if there are problems to fix first.
  function exportText() {
    if (problems.length > 0) {
      setStatus('Not exported: fix the problems listed at the bottom first.')
      return null
    }
    return JSON.stringify(scenarios, null, 2) + '\n'
  }

  function download() {
    const json = exportText()
    if (!json) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    link.download = 'scenarios.json'
    link.click()
    URL.revokeObjectURL(link.href)
    setStatus(`Exported ${scenarios.length} scenarios. Move scenarios.json into backend/ to use them.`)
  }

  async function copy() {
    const json = exportText()
    if (!json) return
    try {
      await navigator.clipboard.writeText(json)
      setStatus('Copied. Paste it into backend/scenarios.json.')
    } catch {
      setStatus("Couldn't copy to the clipboard. Use Export instead.")
    }
  }

  async function importFile(file) {
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data)) throw new Error('The file should contain a list of scenarios.')
      setScenarios(data.map(normalize))
      setEdited(true)
      setCurrent(0)
      setStatus(`Imported ${data.length} scenarios from ${file.name}.`)
    } catch (err) {
      setStatus(`Couldn't import ${file.name}: ${err.message}`)
    }
  }

  async function reset() {
    clearDraft()
    setEdited(false)
    const { scenarios } = await loadScenarios()
    setScenarios(scenarios.map(normalize))
    setCurrent(0)
    setStatus('Draft discarded. Reloaded the current scenarios.')
  }

  return (
    <div className="designer">
      <header className="designer-header">
        <div>
          <h1>Scenario designer</h1>
          <p className="muted">Build scenarios, then export <code>scenarios.json</code> and put it in <code>backend/</code>.</p>
        </div>
        <div className="toolbar">
          <label className="secondary">
            Import JSON…
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                if (e.target.files[0]) importFile(e.target.files[0])
                e.target.value = ''
              }}
            />
          </label>
          <button type="button" className="secondary" onClick={copy}>Copy JSON</button>
          <button type="button" className="primary" onClick={download}>Export scenarios.json</button>
        </div>
      </header>

      {status && <p className="notice" role="status">{status}</p>}

      <div className="designer-layout">
        {/* Left: the list of scenarios and templates for new ones */}
        <aside className="card scenario-list">
          <h2>Scenarios</h2>
          <ul>
            {scenarios.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="list-item"
                  aria-current={i === current ? 'true' : undefined}
                  onClick={() => setCurrent(i)}
                >
                  <span className="list-id">{s.id || '(no id)'}</span>
                  <span className="muted">{s.options.A.victims.length} vs {s.options.B.victims.length}</span>
                </button>
              </li>
            ))}
          </ul>
          <h3>Add a scenario</h3>
          <div className="template-buttons">
            {TEMPLATES.map((t) => (
              <button key={t.name} type="button" className="secondary" onClick={() => addFromTemplate(t)}>
                + {t.name}
              </button>
            ))}
          </div>
          <button type="button" className="link-button" onClick={reset}>Discard draft and reload</button>
        </aside>

        {/* Right: the selected scenario */}
        {scenario ? (
          <section className="card editor">
            <div className="editor-top">
              <label className="id-field">
                ID
                <input
                  value={scenario.id}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => editCurrent((s) => { s.id = e.target.value.replace(/\s/g, '') })}
                />
              </label>
              <label className="grow">
                Question
                <input value={scenario.text} autoComplete="off" onChange={(e) => editCurrent((s) => { s.text = e.target.value })} />
              </label>
              <div className="editor-actions">
                <button type="button" className="secondary" onClick={duplicate}>Duplicate</button>
                <button type="button" className="secondary danger" onClick={remove}>Delete</button>
              </div>
            </div>
            <div className="editor-options">
              {['A', 'B'].map((letter) => (
                <OptionEditor
                  key={letter}
                  letter={letter}
                  option={scenario.options[letter]}
                  change={(changeOption) => editCurrent((s) => changeOption(s.options[letter]))}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="card editor"><p className="muted">No scenarios. Add one from a template.</p></section>
        )}
      </div>

      {problems.length > 0 && (
        <section className="card problems">
          <h2>Fix before exporting</h2>
          <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
      )}
    </div>
  )
}

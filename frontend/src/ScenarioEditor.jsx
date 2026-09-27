// ScenarioEditor — the single control panel. Every setting is visible at once and the previews update live.
// The whole scenario is one object in the v2 format, so Save is one POST (new) or PUT (existing).
import { useEffect, useState } from 'react'
import DilemmaPicker from './DilemmaPicker.jsx'
import HoverLabels from './HoverLabels.jsx'
import OutcomePanel from './OutcomePanel.jsx'
import SignalControls from './SignalControls.jsx'
import { createScenario, updateScenario } from './api.js'
import { blankScenario, clearUnusedSignals, missingForSave, withDilemma } from './scene.js'

// initial: a saved scenario to edit (has an id), or null for a new one.
// onDone(message): go back to the list; onUnauthorized(): the token stopped working.
export default function ScenarioEditor({ initial, onDone, onUnauthorized }) {
  const [saved, setSaved] = useState(() => initial ?? blankScenario()) // last saved (or starting) version
  const [scenario, setScenario] = useState(saved)                      // what's on screen now
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const dirty = JSON.stringify(scenario) !== JSON.stringify(saved)
  const missing = missingForSave(scenario)

  // Warn before closing or reloading the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Every edit goes through here: change a copy, never the object React is showing.
  function edit(change) {
    setScenario((current) => {
      const copy = structuredClone(current)
      change(copy)
      return clearUnusedSignals(copy) // e.g. removing the last pedestrian turns that lane's light off
    })
    setError('')
  }

  function startOver() {
    if (!window.confirm('Start over? This clears the title, dilemma, road lights and both groups.')) return
    setScenario({ ...blankScenario(), id: scenario.id })
  }

  function backToList() {
    if (dirty && !window.confirm('Leave without saving? Your changes will be lost.')) return
    onDone('')
  }

  async function save() {
    if (missing.length > 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const result = scenario.id ? await updateScenario(scenario.id, scenario) : await createScenario(scenario)
      setSaved(result)
      setScenario(result)
      onDone(`Saved “${result.title}” (${result.id}).`)
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <HoverLabels className="editor">
      <div className="editor-bar">
        <button type="button" className="link-button" onClick={backToList}>← All scenarios</button>
        <div className="editor-fields">
          <label className="field">
            Title <span className="muted">(for you; participants don't see it)</span>
            <input value={scenario.title} maxLength={100} placeholder="e.g. Doctors vs. passengers"
              onChange={(e) => edit((s) => { s.title = e.target.value })} />
          </label>
          <label className="field">
            Short description <span className="muted">(optional)</span>
            <input value={scenario.description} maxLength={300} placeholder="What this scenario tests"
              onChange={(e) => edit((s) => { s.description = e.target.value })} />
          </label>
        </div>
        <div className="editor-actions">
          <button type="button" className="secondary" onClick={startOver}>Start over</button>
          <button type="button" className="primary" disabled={missing.length > 0 || saving || (!dirty && scenario.id)} onClick={save}>
            {saving ? 'Saving…' : scenario.id ? 'Save changes' : 'Save'}
          </button>
        </div>
        <p className="save-hint" role="status">
          {error
            ? <span className="error-text">{error}</span>
            : missing.length > 0
              ? `To save, add ${missing.join(', ')}.`
              : scenario.id
                ? (dirty ? `Editing ${scenario.id}: unsaved changes.` : `Editing ${scenario.id}: no changes.`)
                : 'Ready to save.'}
        </p>
      </div>

      <div className="settings-row">
        <DilemmaPicker value={scenario.dilemma} onChange={(dilemma) => setScenario((s) => withDilemma(s, dilemma))} />
        <SignalControls
          scenario={scenario}
          signals={scenario.signals}
          onChange={(signals) => edit((s) => { s.signals = signals })}
        />
      </div>

      <div className="outcome-panels">
        {['stay', 'swerve'].map((outcome) => (
          <OutcomePanel
            key={outcome}
            outcome={outcome}
            scenario={scenario}
            change={(changeOutcome) => edit((s) => changeOutcome(s.outcomes[outcome]))}
          />
        ))}
      </div>
    </HoverLabels>
  )
}

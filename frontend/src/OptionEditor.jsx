// Editor for one option (A or B) of a scenario, with a live preview underneath.
import OptionCard from './OptionCard.jsx'
import { MAX_VICTIMS, PALETTE, hasPedestrians } from './designerData.js'
import { VICTIMS } from './victims.js'

// `change` receives a function that edits this option (on a copy; the designer handles saving).
export default function OptionEditor({ letter, option, change }) {
  const full = option.victims.length >= MAX_VICTIMS
  const signalAllowed = hasPedestrians(option)

  return (
    <fieldset className="option-editor">
      <legend>Option {letter}</legend>

      <label>
        Button label
        <input value={option.label} autoComplete="off" onChange={(e) => change((o) => { o.label = e.target.value })} />
      </label>

      <label>
        What the car does
        <select value={option.action} onChange={(e) => change((o) => { o.action = e.target.value })}>
          <option value="stay">Stay in lane</option>
          <option value="swerve">Swerve</option>
        </select>
      </label>

      <fieldset className="signal-picker" disabled={!signalAllowed}>
        <legend>Crossing signal (only when pedestrians are hit)</legend>
        {[['none', 'None'], ['green', '🟢 Legal'], ['red', '🔴 Illegal']].map(([value, text]) => (
          <label key={value}>
            <input
              type="radio"
              name={`signal-${letter}`}
              value={value}
              checked={option.signal === value}
              onChange={() => change((o) => { o.signal = value })}
            />{' '}
            {text}
          </label>
        ))}
      </fieldset>

      <p className="field-title">Who dies? Click to add (up to {MAX_VICTIMS}). Passengers ride in the car and hit a barrier.</p>
      <div className="palette">
        {PALETTE.map((type) => (
          <button
            key={type}
            type="button"
            className="palette-item"
            disabled={full}
            onClick={() => change((o) => { if (o.victims.length < MAX_VICTIMS) o.victims.push(type) })}
          >
            <span className="palette-emoji" aria-hidden="true">{VICTIMS[type].emoji}</span>
            {VICTIMS[type].one}
          </button>
        ))}
      </div>

      <div className="victim-chips" aria-live="polite">
        {option.victims.length === 0 && <span className="muted">Nobody yet.</span>}
        {option.victims.map((v, i) => (
          <button
            key={i}
            type="button"
            className="chip"
            aria-label={`Remove ${VICTIMS[v].one}`}
            onClick={() => change((o) => { o.victims.splice(i, 1) })}
          >
            {VICTIMS[v].emoji} {VICTIMS[v].one} ✕
          </button>
        ))}
      </div>

      <p className="field-title">Preview (what participants see)</p>
      <OptionCard letter={letter} option={option} preview />
    </fieldset>
  )
}

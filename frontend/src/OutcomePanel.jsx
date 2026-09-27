// OutcomePanel — one outcome (Stay or Swerve): live preview, where the group is, button text,
// the character palette, and the placed characters (click one to remove it).
import CharacterPalette from './CharacterPalette.jsx'
import ScenePreview from './ScenePreview.jsx'
import { Character, CHARACTER_BY_ID } from './characters.jsx'
import { DILEMMAS, MAX_GROUP, PLACE_CAPTIONS } from './scene.js'

// change: receives a function that edits this outcome ({ label, group }) on a copy.
export default function OutcomePanel({ outcome, scenario, change }) {
  const data = scenario.outcomes[outcome]
  const place = DILEMMAS[scenario.dilemma][outcome]
  const full = data.group.length >= MAX_GROUP

  return (
    <section className="outcome-panel" aria-labelledby={`${outcome}-heading`}>
      <header>
        <h2 id={`${outcome}-heading`}>{outcome === 'stay' ? 'Stay' : 'Swerve'}</h2>
        <span className="place-caption">{PLACE_CAPTIONS[place]}</span>
      </header>

      <ScenePreview scenario={scenario} outcome={outcome} />

      <label className="field">
        Button text
        <input value={data.label} maxLength={80} onChange={(e) => change((o) => { o.label = e.target.value })} />
      </label>

      <div>
        <p className="field-title">
          Who dies if the car {outcome === 'stay' ? 'stays' : 'swerves'}? <span className="muted">({data.group.length} / {MAX_GROUP})</span>
        </p>
        <div className="placed" aria-live="polite">
          {data.group.length === 0 && (
            <span className="muted">
              Nobody. If the car {outcome === 'stay' ? 'stays' : 'swerves'}, no one is hurt.
              Add up to {MAX_GROUP} below, or leave it empty (the other side needs at least one).
            </span>
          )}
          {data.group.map((person, i) => (
            <button
              key={i}
              type="button"
              className="placed-item"
              aria-label={`Remove ${CHARACTER_BY_ID[person.type].label}`}
              onClick={() => change((o) => { o.group.splice(i, 1) })}
            >
              <Character type={person.type} fate="killed" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="field-title">{full ? `Full (${MAX_GROUP} max). Remove someone to add another.` : 'Click to add:'}</p>
        <CharacterPalette full={full} onAdd={(type) => change((o) => { o.group.push({ type, fate: 'killed' }) })} />
      </div>
    </section>
  )
}

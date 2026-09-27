// SignalControls — none / legal / illegal road light for each lane.
// A lane without pedestrians can't have a light, so its control is disabled.
import { pedestrianLanes } from './scene.js'

const LANES = [
  { id: 'ahead', label: 'Lane ahead' },
  { id: 'other', label: 'Other lane' },
]
const OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'green', label: '🟢 Legal' },
  { value: 'red', label: '🔴 Illegal' },
]

export default function SignalControls({ dilemma, signals, onChange }) {
  const lanesWithPeople = pedestrianLanes(dilemma)
  return (
    <fieldset className="signal-controls">
      <legend>Road lights</legend>
      {LANES.map((lane) => {
        const allowed = lanesWithPeople.includes(lane.id)
        return (
          <fieldset key={lane.id} className="signal-lane" disabled={!allowed}>
            <legend>{lane.label}{!allowed && <span className="muted"> (no pedestrians)</span>}</legend>
            {OPTIONS.map((o) => (
              <label key={o.value}>
                <input
                  type="radio"
                  name={`signal-${lane.id}`}
                  value={o.value}
                  checked={signals[lane.id] === o.value}
                  onChange={() => onChange({ ...signals, [lane.id]: o.value })}
                />{' '}
                {o.label}
              </label>
            ))}
          </fieldset>
        )
      })}
    </fieldset>
  )
}

// SignalControls — none / legal / illegal road light for each lane.
// A lane with nobody crossing (a barrier lane, or a lane left empty) can't have a light,
// so its control is disabled.
import { lanesWithPeople } from './scene.js'

const LANES = [
  { id: 'ahead', label: 'Lane ahead' },
  { id: 'other', label: 'Other lane' },
]
const OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'green', label: '🟢 Legal' },
  { value: 'red', label: '🔴 Illegal' },
]

export default function SignalControls({ scenario, signals, onChange }) {
  const lanesInUse = lanesWithPeople(scenario)
  return (
    <fieldset className="signal-controls">
      <legend>Road lights</legend>
      {LANES.map((lane) => {
        const allowed = lanesInUse.includes(lane.id)
        return (
          <fieldset key={lane.id} className="signal-lane" disabled={!allowed}>
            <legend>{lane.label}{!allowed && <span className="muted"> (nobody crossing)</span>}</legend>
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

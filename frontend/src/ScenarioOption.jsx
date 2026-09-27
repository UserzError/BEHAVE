// ScenarioOption — one answer in the poll: the scene for that outcome, its label, and who dies.
// Option A is always "stay", option B is always "swerve", so the /response format doesn't change.
import ScenePreview from './ScenePreview.jsx'
import { CHARACTER_BY_ID } from './characters.jsx'
import { describeGroup } from './scene.js'

const labelFor = (type) => CHARACTER_BY_ID[type]?.label ?? type

export default function ScenarioOption({ letter, outcome, scenario, selected, onSelect, onHoverStart, onHoverEnd, ref }) {
  const data = scenario.outcomes[outcome]
  const dies = describeGroup(data.group, labelFor)
  const diesText = data.group.length === 0 ? 'Nobody dies' : `Dies: ${dies}`
  return (
    <button
      type="button"
      ref={ref}
      className={`option option-${letter}`}
      aria-pressed={selected}
      aria-label={`Option ${letter}: ${data.label}. ${diesText}.`}
      onClick={() => onSelect(letter)}
      // Hover only means something with a mouse or pen; touch "hovers" would just be taps.
      onPointerEnter={(e) => e.pointerType !== 'touch' && onHoverStart(letter)}
      onPointerLeave={(e) => e.pointerType !== 'touch' && onHoverEnd(letter)}
    >
      <span className="option-head">
        <span className="option-letter-chip" aria-hidden="true">{letter}</span>
        <span className="option-label">{data.label}</span>
        {selected && <span className="selected-tag">Selected</span>}
      </span>
      <ScenePreview scenario={scenario} outcome={outcome} />
      <span className="option-summary">{diesText}</span>
    </button>
  )
}

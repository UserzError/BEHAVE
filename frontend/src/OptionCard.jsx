// One answer option: a colored square (placeholder for the scenario drawing) plus its label.
import { describeVictims } from './victims.js'

export default function OptionCard({ letter, option, selected, onSelect, onHoverStart, onHoverEnd, ref }) {
  return (
    <button
      type="button"
      ref={ref}
      className={`option option-${letter}`}
      aria-pressed={selected}
      onClick={() => onSelect(letter)}
      // Hover only means something with a mouse or pen; touch "hovers" would just be taps.
      onPointerEnter={(e) => e.pointerType !== 'touch' && onHoverStart(letter)}
      onPointerLeave={(e) => e.pointerType !== 'touch' && onHoverEnd(letter)}
    >
      <span className="square" aria-hidden="true">{letter}</span>
      <span className="option-label">
        {option.label}
        {selected && <span className="selected-tag"> · Selected</span>}
      </span>
      <span className="option-summary">Killed: {describeVictims(option.victims)}</span>
    </button>
  )
}

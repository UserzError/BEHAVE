// One answer option: a colored square (placeholder for the scenario drawing) plus its label.
// Used by the poll (clickable) and by the scenario designer's preview (preview = true, not clickable).
import { SIGNALS, describeVictims } from './victims.js'

export default function OptionCard({ letter, option, selected = false, onSelect, onHoverStart, onHoverEnd, ref, preview = false }) {
  const content = (
    <>
      <span className="square" aria-hidden="true">{letter}</span>
      <span className="option-label">
        {option.label}
        {selected && <span className="selected-tag"> · Selected</span>}
      </span>
      {SIGNALS[option.signal] && <span className="option-signal">{SIGNALS[option.signal]}</span>}
      <span className="option-summary">Killed: {describeVictims(option.victims)}</span>
    </>
  )

  if (preview) return <div className={`option option-${letter} preview`}>{content}</div>

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
      {content}
    </button>
  )
}

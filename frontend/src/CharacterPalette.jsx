// CharacterPalette — all 20 characters; click one to add it to a group.
// Rest the pointer on one for 2 seconds to see its label (HoverLabels wraps the editor).
import { CHARACTERS, Character } from './characters.jsx'

export default function CharacterPalette({ onAdd, full }) {
  return (
    <div className="palette" role="group" aria-label="Characters">
      {CHARACTERS.map((c) => (
        <button
          key={c.id}
          type="button"
          className="palette-item"
          disabled={full}
          aria-label={`Add ${c.label}`}
          onClick={() => onAdd(c.id)}
        >
          <Character type={c.id} />
        </button>
      ))}
    </div>
  )
}

// Gallery (#/gallery): every character in both poses, for checking the artwork. Not linked from the poll.
import { CHARACTERS, Character } from './characters.jsx'
import HoverLabels from './HoverLabels.jsx'

export default function Gallery() {
  return (
    <section className="results">
      <h1>Character gallery</h1>
      <p className="muted">All 20 characters from <code>characters.jsx</code>: standing (left) and walking right (right). Rest the pointer on one for 2 seconds to see its label.</p>

      <HoverLabels>
      <div className="card">
        <h2>All characters</h2>
        <div className="gallery-grid">
          {CHARACTERS.map((c) => (
            <div key={c.id} className="gallery-tile">
              <div className="gallery-poses">
                <Character type={c.id} />
                <Character type={c.id} pose="walk" />
              </div>
              <span>{c.label}<br /><code>{c.id}</code></span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Walking across</h2>
        <p className="muted">Everyone in the walking pose, as a group crossing the road would look.</p>
        <div className="gallery-strip big">
          {CHARACTERS.map((c) => <Character key={c.id} type={c.id} pose="walk" />)}
        </div>
      </div>

      <div className="card">
        <h2>Killed badge</h2>
        <p className="muted">People are either killed (skull) or fine (no badge).</p>
        <div className="gallery-strip big">
          <Character type="man" fate="killed" />
          <Character type="woman" fate="killed" pose="walk" />
          <Character type="girl" fate="killed" pose="walk" />
          <Character type="baby" fate="killed" pose="walk" />
          <Character type="elderly_woman" fate="killed" pose="walk" />
          <Character type="large_man" fate="killed" pose="walk" />
          <Character type="dog" fate="killed" pose="walk" />
          <Character type="cat" fate="killed" pose="walk" />
        </div>
      </div>
      </HoverLabels>
    </section>
  )
}

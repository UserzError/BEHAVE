// Landing — the front page: BEHAVE title, a start button, how it works, and the project README.
// The "About" text is copied from README.md in the repo root; if you edit one, edit the other.
import { Character } from './characters.jsx'

const ACRONYM = [
  ['B', 'ehavioral'],
  ['E', 'valuation of'],
  ['H', 'uman'],
  ['A', 'ttitudes towards'],
  ['V', 'ehicle'],
  ['E', 'thics'],
]

// Decorative strip: some of our characters walking across a crossing.
const WALKERS = ['man', 'doctor_f', 'elderly_woman', 'boy', 'dog', 'pregnant', 'executive_m', 'girl', 'athlete_f', 'cat']

function RoadStrip() {
  return (
    <svg className="road-strip" viewBox="0 0 640 110" aria-hidden="true">
      <rect width="640" height="110" style={{ fill: 'var(--road)' }} />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={6 + i * 21.5} y="14" width="12" height="82" rx="2" style={{ fill: 'var(--crossing-stripe)' }} />
      ))}
      {WALKERS.map((type, i) => {
        const animal = type === 'dog' || type === 'cat'
        const width = animal ? 40 : 34
        const height = animal ? 32 : 54
        const feet = i % 2 ? 100 : 88 // two staggered rows
        return <Character key={type} type={type} pose="walk" x={22 + i * 61} y={feet - height} width={width} height={height} />
      })}
    </svg>
  )
}

// ready: scenarios have loaded; error: they couldn't be loaded; onStart: begin the poll.
export default function Landing({ ready, error, onStart }) {
  return (
    <div className="landing">
      <header className="hero">
        <p className="hero-kicker">A project from hackUMBC '26</p>
        <h1 className="wordmark">BEHAVE</h1>
        <p className="acronym">
          {ACRONYM.map(([letter, rest], i) => (
            <span key={i}><strong>{letter}</strong>{rest}{i < ACRONYM.length - 1 ? ' ' : ''}</span>
          ))}
        </p>
        <p className="hero-lede">
          A self-driving car's brakes have failed. Who should it save? Tell us what you think the car should do,
          and see how you compare with everyone else.
        </p>
        <div className="hero-actions">
          <button type="button" className="primary" disabled={!ready} onClick={onStart}>
            {error ? "Couldn't load scenarios" : ready ? 'Start the poll' : 'Loading…'}
          </button>
          <a className="secondary" href="#/results">See the results</a>
        </div>
      </header>

      <RoadStrip />

      <section className="landing-section" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <ol className="steps">
          <li><strong>Look at both outcomes.</strong> Each scenario shows what happens if the car stays in its lane or swerves.</li>
          <li><strong>Pick one.</strong> You can change your mind as many times as you like.</li>
          <li><strong>Confirm.</strong> There are no right answers, and it only takes a few minutes.</li>
        </ol>
        <p className="muted small">
          Along with your choice, we record how long you take to decide, how long your pointer rests on each option,
          and whether you change your mind before confirming. We don't collect your name, email or any other personal information.
        </p>
      </section>

      <section className="landing-section" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Your privacy</h2>
        <ul className="privacy-list">
          <li><strong>Anonymous.</strong> No names, emails or accounts. Each visit gets a random ID, nothing more.</li>
          <li><strong>What's recorded:</strong> your choice for each scenario, how long you took, how long your pointer rested on each option, whether you changed your mind, and the path your mouse took while deciding (not on touch screens).</li>
          <li><strong>Your IP address is never stored.</strong> A one-way scrambled version is kept for a few minutes to stop spam, then deleted.</li>
          <li><strong>Demonstration only.</strong> The answers aren't used for research.</li>
        </ul>
      </section>

      <section className="landing-section about" aria-labelledby="about-heading">
        <h2 id="about-heading">About the project</h2>
        <div className="about-grid">
          <div className="card">
            <h3>What it is</h3>
            <p>This tool is intended to demonstrate the potential methods for polling for public consensus on autonomous vehicle ethics.</p>
          </div>
          <div className="card">
            <h3>Built with</h3>
            <p>For our stack, we are using React.js for the frontend, and we are using Flask and SQLite on the backend.</p>
          </div>
          <div className="card">
            <h3>How we used AI</h3>
            <p>
              We used AI in the process of building this website; for the majority of the frontend, and assisting with
              designing and orchestrating the backend. AI was not used in deciding the designs of the poll scenarios themselves.
            </p>
          </div>
        </div>
      </section>

      <footer className="landing-footer muted small">
        BEHAVE · hackUMBC '26 · <a href="#/results">Results</a>
      </footer>
    </div>
  )
}

// Scenes demo (#/scenes): hard-coded v2 scenarios of all three dilemma types, both outcomes each.
// For checking ScenePreview before the designer is built. Hover anything for 2 seconds to see its label.
import HoverLabels from './HoverLabels.jsx'
import ScenePreview from './ScenePreview.jsx'
import { DILEMMAS, PLACE_CAPTIONS } from './scene.js'

const DEMO_SCENARIOS = [
  {
    id: 'demo1',
    title: 'Jaywalkers vs. an older couple',
    text: "The car's brakes have failed. What should it do?",
    dilemma: 'peds_vs_peds',
    signals: { ahead: 'red', other: 'green' },
    outcomes: {
      stay: { label: 'Stay in lane', group: [
        { type: 'man', fate: 'killed' }, { type: 'woman', fate: 'killed' }, { type: 'boy', fate: 'killed' },
      ] },
      swerve: { label: 'Swerve', group: [
        { type: 'elderly_man', fate: 'killed' }, { type: 'elderly_woman', fate: 'killed' },
      ] },
    },
  },
  {
    id: 'demo2',
    title: 'Doctors vs. passengers',
    text: "The car's brakes have failed. What should it do?",
    dilemma: 'peds_ahead_vs_car',
    signals: { ahead: 'green', other: 'none' },
    outcomes: {
      stay: { label: 'Stay in lane', group: [
        { type: 'doctor_f', fate: 'killed' }, { type: 'pregnant', fate: 'killed' }, { type: 'dog', fate: 'killed' },
      ] },
      swerve: { label: 'Swerve into the barrier', group: [
        { type: 'executive_m', fate: 'killed' }, { type: 'girl', fate: 'killed' },
      ] },
    },
  },
  {
    id: 'demo3',
    title: 'Passengers vs. a full crossing',
    text: "The car's brakes have failed. What should it do?",
    dilemma: 'car_vs_peds_other',
    signals: { ahead: 'none', other: 'red' },
    outcomes: {
      stay: { label: 'Stay and hit the barrier', group: [
        { type: 'large_man', fate: 'killed' }, { type: 'athlete_f', fate: 'killed' }, { type: 'cat', fate: 'killed' },
        { type: 'man', fate: 'killed' }, { type: 'woman', fate: 'killed' },
      ] },
      swerve: { label: 'Swerve', group: [
        { type: 'criminal', fate: 'killed' }, { type: 'homeless', fate: 'killed' }, { type: 'baby', fate: 'killed' },
        { type: 'large_woman', fate: 'killed' }, { type: 'doctor_m', fate: 'killed' },
      ] },
    },
  },
]

export default function ScenesDemo() {
  return (
    <section className="results">
      <h1>Scene previews</h1>
      <p className="muted">One example of each dilemma type. Rest the pointer on anything for 2 seconds to see what it is.</p>
      <HoverLabels>
        {DEMO_SCENARIOS.map((s) => (
          <div key={s.id} className="card">
            <h2>{s.title}</h2>
            <p className="muted">{DILEMMAS[s.dilemma].label} · <code>{s.dilemma}</code></p>
            <div className="scene-pair">
              {['stay', 'swerve'].map((outcome) => (
                <figure key={outcome}>
                  <ScenePreview scenario={s} outcome={outcome} />
                  <figcaption>
                    <strong>{outcome === 'stay' ? 'Stay' : 'Swerve'}:</strong> {s.outcomes[outcome].label}
                    <br />
                    <span className="muted">{PLACE_CAPTIONS[DILEMMAS[s.dilemma][outcome]]}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </HoverLabels>
    </section>
  )
}

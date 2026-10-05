// The poll: one scenario at a time. Pick A, B or Indifferent (you can switch), then confirm.
//
// Study design: for each scenario, a coin flip decides whether "stay" (A) is shown on the left or the
// right, so a habit of clicking one side doesn't look like a preference. The letters always mean the
// same outcome (A = stay, B = swerve); only their position changes. The layout and the scenario's
// position in the poll are sent with each answer.
import { useEffect, useRef, useState } from 'react'
import HoverLabels from './HoverLabels.jsx'
import ScenarioOption from './ScenarioOption.jsx'
import { sendResponse } from './api.js'
import { rememberAnswer } from './myAnswers.js'
import { useTelemetry } from './useTelemetry.js'

const OUTCOME_FOR = { A: 'stay', B: 'swerve' } // A = stay, B = swerve

export default function Poll({ scenarios, demo, sessionId, onDone }) {
  const [index, setIndex] = useState(0)         // which scenario is on screen
  const [selected, setSelected] = useState(null) // "A", "B", "I" (indifferent), or null
  const [sending, setSending] = useState(false)
  // One coin flip per scenario, made once for this participant: is "stay" on the left?
  const [stayOnLeft] = useState(() => scenarios.map(() => Math.random() < 0.5))
  const { startTracking, hoverStart, hoverEnd, trackPointer, recordSelection, getTelemetry } = useTelemetry()
  const optionRefs = useRef({ A: null, B: null, I: null })
  const optionsArea = useRef(null)
  const headingRef = useRef(null)

  const scenario = scenarios[index]
  const letters = stayOnLeft[index] ? ['A', 'B'] : ['B', 'A'] // left to right on screen

  // Each time a new scenario appears: restart the timer, hover totals and mouse path.
  useEffect(() => {
    startTracking()
    // If the pointer is already resting on an option, no pointerenter fires, so start that hover now.
    for (const letter of ['A', 'B', 'I']) {
      if (optionRefs.current[letter]?.matches(':hover')) hoverStart(letter)
    }
    if (index > 0) headingRef.current?.focus()
  }, [index, startTracking, hoverStart])

  // Mouse tracking: record pointer positions relative to the two options (0–1 across that area).
  useEffect(() => {
    function onMove(e) {
      if (e.pointerType === 'touch' || !optionsArea.current) return // a finger has no path to follow
      const box = optionsArea.current.getBoundingClientRect()
      if (!box.width || !box.height) return
      trackPointer((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [trackPointer])

  function select(letter) {
    setSelected(letter)
    recordSelection(letter)
  }

  async function confirm() {
    if (!selected || sending) return
    // JSON body for POST /response (read telemetry first so the request doesn't add to decision time)
    const response = {
      session_id: sessionId,             // random id for this participant
      scenario_id: scenario.id,
      choice: selected,                  // final confirmed choice: "A" (stay), "B" (swerve) or "I" (indifferent)
      stay_on_left: stayOnLeft[index],   // which side "stay" was shown on
      position: index + 1,               // 1 = the first scenario this person saw
      ...getTelemetry(),                 // first_choice, decision_ms, hover_ms, changed_answer, final_select_ms, mouse_path
    }
    setSending(true)
    const reply = await sendResponse(response, demo) // { saved_at, path } or null if not saved
    rememberAnswer(sessionId, response, reply) // for "How you compare" on the results page
    setSending(false)
    setSelected(null)
    if (index + 1 < scenarios.length) setIndex(index + 1)
    else onDone()
  }

  return (
    <section className="poll">
      <h1 ref={headingRef} tabIndex={-1}>
        What should the car do?
        {/* screen readers hear which scenario this is when focus moves here */}
        <span className="visually-hidden"> Scenario {index + 1} of {scenarios.length}.</span>
      </h1>
      <p className="muted">Scenario {index + 1} of {scenarios.length} · Pick one, then confirm. You can switch first.</p>

      {/* resting the pointer on anything in a scene for 2 seconds shows what it is */}
      <div ref={optionsArea}>
        <HoverLabels className="options">
          {letters.map((letter) => (
            <ScenarioOption
              key={letter}
              ref={(node) => { optionRefs.current[letter] = node }}
              letter={letter}
              outcome={OUTCOME_FOR[letter]}
              scenario={scenario}
              selected={selected === letter}
              onSelect={select}
              onHoverStart={hoverStart}
              onHoverEnd={hoverEnd}
            />
          ))}
        </HoverLabels>
      </div>

      {/* Indifferent: no preference between the two outcomes. Tracked like A and B (selection, hover, switching). */}
      <button
        type="button"
        ref={(node) => { optionRefs.current.I = node }}
        className="indifferent"
        aria-pressed={selected === 'I'}
        onClick={() => select('I')}
        onPointerEnter={(e) => e.pointerType !== 'touch' && hoverStart('I')}
        onPointerLeave={(e) => e.pointerType !== 'touch' && hoverEnd('I')}
      >
        <strong>Indifferent</strong>
        <span className="muted"> · I don't prefer either outcome</span>
      </button>

      <button type="button" className="primary" disabled={!selected || sending} onClick={confirm}>
        Confirm choice
      </button>
    </section>
  )
}

// The poll: one scenario at a time. Pick A or B (you can switch), then confirm.
import { useEffect, useRef, useState } from 'react'
import OptionCard from './OptionCard.jsx'
import { sendResponse } from './api.js'
import { useTelemetry } from './useTelemetry.js'

const LETTERS = ['A', 'B']

export default function Poll({ scenarios, demo, sessionId, onDone }) {
  const [index, setIndex] = useState(0)         // which scenario is on screen
  const [selected, setSelected] = useState(null) // "A", "B", or null
  const [sending, setSending] = useState(false)
  const { startTracking, hoverStart, hoverEnd, recordSelection, getTelemetry } = useTelemetry()
  const optionRefs = useRef({ A: null, B: null })
  const headingRef = useRef(null)

  const scenario = scenarios[index]

  // Each time a new scenario appears: restart the timer and hover totals.
  useEffect(() => {
    startTracking()
    // If the pointer is already resting on an option, no pointerenter fires, so start that hover now.
    for (const letter of LETTERS) {
      if (optionRefs.current[letter]?.matches(':hover')) hoverStart(letter)
    }
    if (index > 0) headingRef.current?.focus()
  }, [index, startTracking, hoverStart])

  function select(letter) {
    setSelected(letter)
    recordSelection(letter)
  }

  async function confirm() {
    if (!selected || sending) return
    // JSON body for POST /response (read telemetry first so the request doesn't add to decision time)
    const response = {
      session_id: sessionId,    // random id for this participant
      scenario_id: scenario.id,
      choice: selected,         // final confirmed choice, "A" or "B"
      ...getTelemetry(),        // adds first_choice, decision_ms, hover_ms, changed_answer
    }
    setSending(true)
    await sendResponse(response, demo)
    setSending(false)
    setSelected(null)
    if (index + 1 < scenarios.length) setIndex(index + 1)
    else onDone()
  }

  return (
    <section className="poll">
      <h1 ref={headingRef} tabIndex={-1}>What should the car do?</h1>
      <p className="muted">Scenario {index + 1} of {scenarios.length} · Pick one, then confirm. You can switch first.</p>

      <div className="options">
        {LETTERS.map((letter) => (
          <OptionCard
            key={letter}
            ref={(node) => { optionRefs.current[letter] = node }}
            letter={letter}
            option={scenario.options[letter]}
            selected={selected === letter}
            onSelect={select}
            onHoverStart={hoverStart}
            onHoverEnd={hoverEnd}
          />
        ))}
      </div>

      <button type="button" className="primary" disabled={!selected || sending} onClick={confirm}>
        Confirm choice
      </button>
    </section>
  )
}

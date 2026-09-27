// useTelemetry — measures HOW a participant decides on one scenario.
// React version of the old telemetry.js (on the pure-js branch). Same fields, same logic.
// Values live in refs (not state) because changing them shouldn't re-render anything.
import { useCallback, useRef } from 'react'

export function useTelemetry() {
  const startTime = useRef(0)
  const hoverTotals = useRef({ A: 0, B: 0 })         // total ms the pointer spent over each option
  const hoverStartTimes = useRef({ A: null, B: null }) // when the current hover began (null = not hovering)
  const firstChoice = useRef(null)
  const lastChoice = useRef(null)
  const switched = useRef(false)                     // true if they ever picked one option, then the other

  // Call when a new scenario appears on screen.
  const startTracking = useCallback(() => {
    startTime.current = performance.now()
    hoverTotals.current = { A: 0, B: 0 }
    hoverStartTimes.current = { A: null, B: null }
    firstChoice.current = null
    lastChoice.current = null
    switched.current = false
  }, [])

  const hoverStart = useCallback((option) => {
    hoverStartTimes.current[option] = performance.now()
  }, [])

  const hoverEnd = useCallback((option) => {
    const started = hoverStartTimes.current[option]
    if (started === null) return
    hoverTotals.current[option] += performance.now() - started
    hoverStartTimes.current[option] = null
  }, [])

  // Call every time the participant clicks an option (before confirming).
  const recordSelection = useCallback((option) => {
    if (firstChoice.current === null) firstChoice.current = option
    else if (option !== lastChoice.current) switched.current = true
    lastChoice.current = option
  }, [])

  // Call on confirm. Returns the telemetry fields of the POST /response JSON.
  const getTelemetry = useCallback(() => {
    hoverEnd('A') // close out any hover still in progress so it counts
    hoverEnd('B')
    return {
      first_choice: firstChoice.current,                                  // first option clicked
      decision_ms: Math.round(performance.now() - startTime.current),     // ms from scenario shown to confirm
      hover_ms: {                                                         // total hover ms per option
        A: Math.round(hoverTotals.current.A),
        B: Math.round(hoverTotals.current.B),
      },
      changed_answer: switched.current,                                   // true if they switched options
    }
  }, [hoverEnd])

  return { startTracking, hoverStart, hoverEnd, recordSelection, getTelemetry }
}

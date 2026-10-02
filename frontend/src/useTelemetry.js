// useTelemetry — measures HOW a participant decides on one scenario.
// Values live in refs (not state) because changing them shouldn't re-render anything.
//
// Recorded per scenario:
//   decision_ms      time from the scenario appearing to confirming
//   hover_ms         time the pointer rested on each option (A = stay, B = swerve)
//   first_choice     the first option clicked; changed_answer: did they switch before confirming
//   mouse_path       pointer positions [[t_ms, x, y], ...] relative to the options area (0–1), for
//                    mouse-tracking measures (computed on the server, see backend/poll/trajectory.py)
//   final_select_ms  when they clicked their final choice
import { useCallback, useRef } from 'react'

export const SAMPLE_MS = 40     // record a pointer position at most every 40 ms (25 per second)
export const MAX_POINTS = 400   // if a path gets longer, keep every other point (the server allows up to 600)

const round3 = (v) => Math.round(v * 1000) / 1000

export function useTelemetry() {
  const startTime = useRef(0)
  const hoverTotals = useRef({ A: 0, B: 0 })         // total ms the pointer spent over each option
  const hoverStartTimes = useRef({ A: null, B: null }) // when the current hover began (null = not hovering)
  const firstChoice = useRef(null)
  const lastChoice = useRef(null)
  const switched = useRef(false)                     // true if they ever picked one option, then the other
  const finalSelectMs = useRef(null)
  const path = useRef([])
  const sampleEvery = useRef(SAMPLE_MS)

  const elapsed = () => Math.round(performance.now() - startTime.current)

  // Call when a new scenario appears on screen.
  const startTracking = useCallback(() => {
    startTime.current = performance.now()
    hoverTotals.current = { A: 0, B: 0 }
    hoverStartTimes.current = { A: null, B: null }
    firstChoice.current = null
    lastChoice.current = null
    switched.current = false
    finalSelectMs.current = null
    path.current = []
    sampleEvery.current = SAMPLE_MS
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

  // Call on every pointer move with the position relative to the options area (0–1 across it).
  const trackPointer = useCallback((x, y) => {
    const t = Math.round(performance.now() - startTime.current)
    const points = path.current
    if (points.length && t - points[points.length - 1][0] < sampleEvery.current) return
    points.push([t, round3(x), round3(y)])
    if (points.length > MAX_POINTS) {
      path.current = points.filter((_, i) => i % 2 === 0) // thin it out...
      sampleEvery.current *= 2                             // ...and sample half as often from now on
    }
  }, [])

  // Call every time the participant clicks an option (before confirming).
  const recordSelection = useCallback((option) => {
    if (firstChoice.current === null) firstChoice.current = option
    else if (option !== lastChoice.current) switched.current = true
    lastChoice.current = option
    finalSelectMs.current = Math.round(performance.now() - startTime.current)
  }, [])

  // Call on confirm. Returns the telemetry fields of the POST /response JSON.
  const getTelemetry = useCallback(() => {
    hoverEnd('A') // close out any hover still in progress so it counts
    hoverEnd('B')
    return {
      first_choice: firstChoice.current,                                  // first option clicked
      decision_ms: elapsed(),                                             // ms from scenario shown to confirm
      hover_ms: {                                                         // total hover ms per option
        A: Math.round(hoverTotals.current.A),
        B: Math.round(hoverTotals.current.B),
      },
      changed_answer: switched.current,                                   // true if they switched options
      final_select_ms: finalSelectMs.current,                             // when the final choice was clicked
      mouse_path: path.current.length ? path.current : null,              // null on touch screens
    }
  }, [hoverEnd])

  return { startTracking, hoverStart, hoverEnd, trackPointer, recordSelection, getTelemetry }
}

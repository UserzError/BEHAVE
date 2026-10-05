// compare.js — the math behind "How you compare" (used by YourComparison.jsx; tested in compare.test.js).

export const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`
export const percent = (x) => `${Math.round(x * 100)}%`

// Everyone else's numbers for one scenario (the totals minus your own answer, if it was counted).
export function othersFor(row, mine) {
  const total = row.answers ?? row.votes.A + row.votes.B + (row.votes.I ?? 0)
  // Your answer is in these totals if it was saved before this results snapshot was computed.
  // (Results are cached for a few seconds, so a just-saved answer may not be counted yet.)
  const inSnapshot = !row.computed_at || !mine.saved_at || Date.parse(mine.saved_at) <= Date.parse(row.computed_at)
  const counted = mine.saved && inSnapshot ? 1 : 0
  const n = Math.max(0, total - counted)
  // average without one value: (average × count − value) ÷ (count − 1)
  const without = (avg, value) => (n > 0 ? (avg * total - counted * value) / n : 0)
  const votes = { A: row.votes.A, B: row.votes.B, I: row.votes.I ?? 0 }
  if (counted) votes[mine.choice] = Math.max(0, votes[mine.choice] - 1)
  const hover = { A: 0, B: 0, I: 0, ...row.avg_hover_ms }
  // Mouse paths: average of everyone else's, from answers that have a path.
  const paths = row.paths ?? {}
  const pathCount = paths.answers ?? 0
  const myDev = mine.path?.max_deviation
  const pathCounted = counted && myDev != null ? 1 : 0
  const otherPaths = pathCount - pathCounted
  const deviation = paths.avg_max_deviation == null || otherPaths <= 0
    ? null
    : (paths.avg_max_deviation * pathCount - pathCounted * myDev) / otherPaths
  return {
    n,
    votes,
    pathDeviation: deviation,
    pathAnswers: Math.max(0, otherPaths),
    avgMs: without(row.avg_decision_ms, mine.decision_ms),
    changedRate: without(row.changed_rate, mine.changed_answer ? 1 : 0),
    hover: {
      A: without(hover.A, mine.hover_ms.A),
      B: without(hover.B, mine.hover_ms.B),
      I: without(hover.I, mine.hover_ms.I ?? 0),
    },
  }
}

// "faster", "slower" or "about the same as" (within 15%)
export function compareTime(mine, others) {
  if (!others) return null
  const ratio = mine / others
  if (ratio < 0.85) return 'faster than'
  if (ratio > 1.15) return 'slower than'
  return 'about the same as'
}

export function longerLook(hover) {
  if (hover.A + hover.B < 50) return null // no pointer (touch screen) or too little to say
  return hover.A >= hover.B ? 'A' : 'B'
}

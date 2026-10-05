// insightMath.js — the calculations behind the results page's insight charts (tested in insightMath.test.js).

// How split a vote was: 0 = everyone chose the same, 1 = an even split between stay and swerve.
// Indifferent answers count towards the total, so a lot of indifference also reads as "split".
export function splitScore(votes) {
  const total = votes.A + votes.B + (votes.I ?? 0)
  if (!total) return null
  return 1 - Math.abs(votes.A - votes.B) / total
}

// Pearson correlation between two lists of numbers (−1 to 1), or null if it can't be computed.
export function correlation(xs, ys) {
  const n = xs.length
  if (n < 3 || ys.length !== n) return null
  const mean = (v) => v.reduce((a, b) => a + b, 0) / n
  const mx = mean(xs)
  const my = mean(ys)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  if (!sxx || !syy) return null
  return sxy / Math.sqrt(sxx * syy)
}

// Plain-words reading of a correlation between split votes and decision time.
export function describeCorrelation(r) {
  if (r === null) return 'Not enough scenarios with answers to tell yet.'
  const strength = Math.abs(r) >= 0.5 ? 'clearly' : Math.abs(r) >= 0.3 ? 'somewhat' : null
  if (!strength) return 'No clear link: closer votes didn’t take noticeably longer.'
  return r > 0
    ? `Closer votes ${strength} took longer to decide.`
    : `Closer votes ${strength} took less time to decide (an unusual pattern).`
}

// Average decision time and changed-mind rate for scenarios that include each character, weighted by
// the number of answers. rows: the results page's rows, each with `types` (characters in the scenario).
export function characterHesitation(rows) {
  const byType = new Map()
  let answers = 0
  let ms = 0
  let changed = 0
  for (const r of rows) {
    const n = r.answers ?? 0
    if (!n) continue
    answers += n
    ms += r.avg_decision_ms * n
    changed += r.changed_rate * n
    for (const type of new Set(r.types ?? [])) {
      const t = byType.get(type) ?? { type, scenarios: 0, answers: 0, ms: 0, changed: 0 }
      t.scenarios += 1
      t.answers += n
      t.ms += r.avg_decision_ms * n
      t.changed += r.changed_rate * n
      byType.set(type, t)
    }
  }
  const items = [...byType.values()]
    .map((t) => ({ type: t.type, scenarios: t.scenarios, answers: t.answers, avgMs: t.ms / t.answers, changedRate: t.changed / t.answers }))
    .sort((a, b) => b.avgMs - a.avgMs)
  return {
    overallMs: answers ? ms / answers : null,
    overallChanged: answers ? changed / answers : null,
    items,
  }
}

// Plain-words reading of the left/right check. leftShare: 0–1 share of answers that picked the left option.
export function describeSideBias(side) {
  if (!side || !side.answers) return 'No answers with a recorded side yet.'
  if (side.answers < 100) return 'Too few answers to tell yet (needs about 100).'
  const lean = side.left_share - 0.5
  if (Math.abs(lean) < 0.05) return 'No sign of a side bias: people chose left and right about equally.'
  return `People leaned towards the ${lean > 0 ? 'left' : 'right'} option. Randomizing the sides keeps this from skewing the results.`
}

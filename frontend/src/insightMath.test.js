import { describe, expect, it } from 'vitest'
import { characterHesitation, correlation, describeCorrelation, describeSideBias, splitScore } from './insightMath.js'

describe('splitScore', () => {
  it('is 0 when everyone agrees and 1 for an even split', () => {
    expect(splitScore({ A: 10, B: 0, I: 0 })).toBe(0)
    expect(splitScore({ A: 5, B: 5, I: 0 })).toBe(1)
    expect(splitScore({ A: 6, B: 2, I: 2 })).toBeCloseTo(0.6)
    expect(splitScore({ A: 0, B: 0 })).toBe(null)
  })
})

describe('correlation', () => {
  it('finds perfect, opposite and missing links', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(correlation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1)
    expect(correlation([1, 2], [1, 2])).toBe(null) // too few points
    expect(correlation([1, 1, 1], [1, 2, 3])).toBe(null) // no variation
  })

  it('describes the strength in words', () => {
    expect(describeCorrelation(0.7)).toMatch(/clearly took longer/)
    expect(describeCorrelation(0.35)).toMatch(/somewhat took longer/)
    expect(describeCorrelation(0.1)).toMatch(/No clear link/)
    expect(describeCorrelation(null)).toMatch(/Not enough/)
  })
})

describe('characterHesitation', () => {
  it('weights each scenario by its number of answers', () => {
    const rows = [
      { types: ['man', 'dog', 'dog'], answers: 10, avg_decision_ms: 2000, changed_rate: 0.1 },
      { types: ['man', 'baby'], answers: 30, avg_decision_ms: 6000, changed_rate: 0.3 },
    ]
    const { overallMs, items } = characterHesitation(rows)
    expect(overallMs).toBe(5000) // (2000x10 + 6000x30) / 40
    const byType = Object.fromEntries(items.map((t) => [t.type, t]))
    expect(byType.baby).toMatchObject({ scenarios: 1, avgMs: 6000 })
    expect(byType.dog).toMatchObject({ scenarios: 1, avgMs: 2000 }) // counted once per scenario
    expect(byType.man.avgMs).toBe(5000)
    expect(items[0].type).toBe('baby') // slowest first
  })
})

describe('describeSideBias', () => {
  it('needs enough answers, then reports a lean', () => {
    expect(describeSideBias({ answers: 20, left_share: 0.9 })).toMatch(/Too few/)
    expect(describeSideBias({ answers: 400, left_share: 0.52 })).toMatch(/No sign/)
    expect(describeSideBias({ answers: 400, left_share: 0.6 })).toMatch(/towards the left/)
  })
})

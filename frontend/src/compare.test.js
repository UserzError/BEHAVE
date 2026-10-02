import { describe, expect, it } from 'vitest'
import { compareTime, longerLook, othersFor } from './compare.js'

const row = {
  answers: 4,
  votes: { A: 3, B: 1 },
  avg_decision_ms: 5000,
  changed_rate: 0.5,
  avg_hover_ms: { A: 1000, B: 400 },
}
const mine = { choice: 'A', decision_ms: 2000, changed_answer: true, hover_ms: { A: 1600, B: 400 }, saved: true }

describe('othersFor', () => {
  it('takes your own saved answer out of the totals', () => {
    const others = othersFor(row, mine)
    expect(others.n).toBe(3)
    expect(others.votes).toEqual({ A: 2, B: 1 })
    expect(others.avgMs).toBe(6000)               // (5000×4 − 2000) ÷ 3
    expect(others.changedRate).toBeCloseTo(1 / 3) // (0.5×4 − 1) ÷ 3
    expect(others.hover).toEqual({ A: 800, B: 400 })
  })

  it('leaves the totals alone if your answer was not saved (demo mode)', () => {
    const others = othersFor(row, { ...mine, saved: false })
    expect(others.n).toBe(4)
    expect(others.votes).toEqual(row.votes)
    expect(others.avgMs).toBe(5000)
  })

  it('handles being the only answer', () => {
    const only = { answers: 1, votes: { A: 1, B: 0 }, avg_decision_ms: 2000, changed_rate: 1, avg_hover_ms: { A: 1600, B: 400 } }
    expect(othersFor(only, mine).n).toBe(0)
  })
})

describe('labels', () => {
  it('compares decision times with a 15% margin', () => {
    expect(compareTime(1000, 2000)).toBe('faster than')
    expect(compareTime(3000, 2000)).toBe('slower than')
    expect(compareTime(2100, 2000)).toBe('about the same as')
  })

  it('says which option was looked at longer, or nothing for touch screens', () => {
    expect(longerLook({ A: 900, B: 100 })).toBe('A')
    expect(longerLook({ A: 0, B: 0 })).toBe(null)
  })
})

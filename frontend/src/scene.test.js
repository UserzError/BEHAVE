import { describe, expect, it } from 'vitest'
import { barrierLane, blankScenario, clearUnusedSignals, describeGroup, lanesWithPeople, missingForSave, withDilemma } from './scene.js'

const person = (type) => ({ type, fate: 'killed' })

function scenario(overrides = {}) {
  const s = blankScenario()
  s.title = 'Test'
  s.outcomes.stay.group = [person('man')]
  s.outcomes.swerve.group = [person('woman')]
  return { ...s, ...overrides }
}

describe('scenario rules', () => {
  it('finds the barrier lane for each dilemma type', () => {
    expect(barrierLane('peds_vs_peds')).toBe(null)
    expect(barrierLane('peds_ahead_vs_car')).toBe('other')
    expect(barrierLane('car_vs_peds_other')).toBe('ahead')
  })

  it('a complete scenario is ready to save', () => {
    expect(missingForSave(scenario())).toEqual([])
  })

  it('needs a title, and both sides cannot be empty', () => {
    const s = scenario({ title: ' ' })
    s.outcomes.stay.group = []
    s.outcomes.swerve.group = []
    const missing = missingForSave(s)
    expect(missing).toContain('a title')
    expect(missing.some((m) => m.includes('both can'))).toBe(true)
  })

  it('one empty side is allowed', () => {
    const s = scenario()
    s.outcomes.swerve.group = []
    expect(missingForSave(s)).toEqual([])
  })

  it('an emptied lane loses its road light', () => {
    const s = scenario({ signals: { ahead: 'red', other: 'green' } })
    s.outcomes.swerve.group = [] // nobody in the other lane now
    expect(lanesWithPeople(s)).toEqual(['ahead'])
    expect(clearUnusedSignals(s).signals).toEqual({ ahead: 'red', other: 'none' })
  })

  it('switching dilemma keeps the groups, resets lights and default labels', () => {
    const s = scenario({ signals: { ahead: 'red', other: 'green' } })
    const next = withDilemma(s, 'car_vs_peds_other') // stay now hits the barrier (passengers)
    expect(next.outcomes.stay.group).toEqual(s.outcomes.stay.group)
    expect(next.signals).toEqual({ ahead: 'none', other: 'green' })
    expect(next.outcomes.stay.label).toBe('Stay and hit the barrier')
    expect(s.dilemma).toBe('peds_vs_peds') // original untouched
  })

  it('describes a group in words', () => {
    const label = (t) => ({ man: 'Man', doctor_f: 'Doctor (woman)' })[t]
    expect(describeGroup([person('man'), person('man'), person('doctor_f')], label)).toBe('2 × Man, Doctor (woman)')
    expect(describeGroup([], label)).toBe('nobody')
  })
})

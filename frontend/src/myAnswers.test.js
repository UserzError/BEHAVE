import { beforeEach, describe, expect, it } from 'vitest'
import { loadMyAnswers, rememberAnswer } from './myAnswers.js'

beforeEach(() => sessionStorage.clear())

describe('myAnswers', () => {
  it('remembers answers for the current poll', () => {
    rememberAnswer('session-1', { scenario_id: 's1', choice: 'A' }, '2026-10-02T12:00:00+00:00')
    rememberAnswer('session-1', { scenario_id: 's2', choice: 'B' }, null)
    expect(loadMyAnswers()).toEqual({
      s1: { scenario_id: 's1', choice: 'A', saved: true, saved_at: '2026-10-02T12:00:00+00:00' },
      s2: { scenario_id: 's2', choice: 'B', saved: false, saved_at: null },
    })
  })

  it('a new poll starts over', () => {
    rememberAnswer('session-1', { scenario_id: 's1', choice: 'A' }, 't1')
    rememberAnswer('session-2', { scenario_id: 's2', choice: 'B' }, 't2')
    expect(Object.keys(loadMyAnswers())).toEqual(['s2'])
  })

  it('returns nothing when there are no answers', () => {
    expect(loadMyAnswers()).toEqual({})
  })
})

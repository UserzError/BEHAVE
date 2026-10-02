import { beforeEach, describe, expect, it } from 'vitest'
import { loadMyAnswers, rememberAnswer } from './myAnswers.js'

beforeEach(() => sessionStorage.clear())

describe('myAnswers', () => {
  it('remembers answers for the current poll', () => {
    rememberAnswer('session-1', { scenario_id: 's1', choice: 'A' }, true)
    rememberAnswer('session-1', { scenario_id: 's2', choice: 'B' }, false)
    expect(loadMyAnswers()).toEqual({
      s1: { scenario_id: 's1', choice: 'A', saved: true },
      s2: { scenario_id: 's2', choice: 'B', saved: false },
    })
  })

  it('a new poll starts over', () => {
    rememberAnswer('session-1', { scenario_id: 's1', choice: 'A' }, true)
    rememberAnswer('session-2', { scenario_id: 's2', choice: 'B' }, true)
    expect(Object.keys(loadMyAnswers())).toEqual(['s2'])
  })

  it('returns nothing when there are no answers', () => {
    expect(loadMyAnswers()).toEqual({})
  })
})

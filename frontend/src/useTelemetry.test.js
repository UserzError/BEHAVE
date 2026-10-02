import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_POINTS, SAMPLE_MS, useTelemetry } from './useTelemetry.js'

let now = 0
beforeEach(() => {
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(() => vi.restoreAllMocks())

function setup() {
  const { result } = renderHook(() => useTelemetry())
  act(() => result.current.startTracking())
  return result.current
}

describe('useTelemetry', () => {
  it('records hover time, the first choice and switching', () => {
    const t = setup()
    t.hoverStart('A'); now = 1000; t.hoverEnd('A')
    t.recordSelection('A')
    t.hoverStart('B'); now = 1500
    t.recordSelection('B')
    now = 2000
    const data = t.getTelemetry() // closes the open hover on B
    expect(data).toMatchObject({
      first_choice: 'A',
      decision_ms: 2000,
      hover_ms: { A: 1000, B: 1000 }, // B: hovered from 1000 ms until confirm at 2000 ms
      changed_answer: true,
      final_select_ms: 1500,
    })
  })

  it('picking the same option twice is not a change of mind', () => {
    const t = setup()
    t.recordSelection('A')
    t.recordSelection('A')
    expect(t.getTelemetry().changed_answer).toBe(false)
  })

  it('samples the mouse path at most every SAMPLE_MS', () => {
    const t = setup()
    t.trackPointer(0.1, 0.5)
    now = SAMPLE_MS / 2; t.trackPointer(0.2, 0.5) // too soon: skipped
    now = SAMPLE_MS; t.trackPointer(0.3, 0.5)
    expect(t.getTelemetry().mouse_path).toEqual([[0, 0.1, 0.5], [SAMPLE_MS, 0.3, 0.5]])
  })

  it('thins a long path instead of growing forever', () => {
    const t = setup()
    for (let i = 0; i <= MAX_POINTS + 10; i++) {
      now = i * SAMPLE_MS
      t.trackPointer(i / 1000, 0.5)
    }
    const path = t.getTelemetry().mouse_path
    expect(path.length).toBeLessThanOrEqual(MAX_POINTS)
    expect(path[0][0]).toBe(0)
  })

  it('has no path on touch screens (nothing tracked)', () => {
    expect(setup().getTelemetry().mouse_path).toBe(null)
  })
})

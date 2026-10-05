import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PathSketch from './PathSketch.jsx'

afterEach(cleanup)
const path = [[0, 0.5, 1.1], [100, 0.7, 0.5], [200, 0.2, 0.5], [300, 0.5, 1.3]]

describe('PathSketch', () => {
  it('puts the options where the participant saw them and splits the path at the final click', () => {
    const { container } = render(<PathSketch path={path} finalSelectMs={200} stayOnLeft={false} choice="A" />)
    const letters = [...container.querySelectorAll('.sketch-letter')].map((t) => t.textContent)
    expect(letters).toEqual(['B', 'A']) // swerve was on the left
    expect(container.querySelector('.sketch-A.is-chosen')).not.toBe(null)
    expect(container.querySelector('.sketch-path').getAttribute('points').split(' ')).toHaveLength(3)
    expect(container.querySelector('.sketch-path-after')).not.toBe(null)
  })

  it('draws nothing without a path', () => {
    const { container } = render(<PathSketch path={null} stayOnLeft choice="A" />)
    expect(container.firstChild).toBe(null)
  })
})

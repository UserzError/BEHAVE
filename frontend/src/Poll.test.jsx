import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Poll from './Poll.jsx'
import { sendResponse } from './api.js'

vi.mock('./api.js', () => ({ sendResponse: vi.fn(async () => ({ saved_at: '2026-10-02T12:00:00+00:00', path: null })) }))

const scenario = (id) => ({
  id,
  title: id,
  text: '',
  dilemma: 'peds_vs_peds',
  signals: { ahead: 'none', other: 'none' },
  outcomes: {
    stay: { label: `Stay ${id}`, group: [{ type: 'man', fate: 'killed' }] },
    swerve: { label: `Swerve ${id}`, group: [{ type: 'woman', fate: 'killed' }] },
  },
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  sendResponse.mockClear()
  sessionStorage.clear()
})

// Labels of the two scene options, left to right (the Indifferent button sits underneath them).
const order = () => [...document.querySelectorAll('.option')].map((b) => b.getAttribute('aria-label').split('.')[0])

describe('Poll', () => {
  it('puts stay on the left or right depending on the coin flip, and sends the layout and position', async () => {
    // first scenario: stay on the left (random < 0.5); second: stay on the right
    const flips = [0.1, 0.9]
    vi.spyOn(Math, 'random').mockImplementation(() => flips.shift() ?? 0.5)
    const onDone = vi.fn()
    render(<Poll scenarios={[scenario('s1'), scenario('s2')]} demo={false} sessionId="abc" onDone={onDone} />)

    expect(order()).toEqual(['Option A: Stay s1', 'Option B: Swerve s1'])
    fireEvent.click(screen.getByRole('button', { name: /Option A: Stay s1/ }))
    fireEvent.click(screen.getByRole('button', { name: /Option B: Swerve s1/ })) // change of mind
    fireEvent.click(screen.getByRole('button', { name: 'Confirm choice' }))

    await waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    expect(sendResponse.mock.calls[0][0]).toMatchObject({
      session_id: 'abc', scenario_id: 's1', choice: 'B', first_choice: 'A',
      changed_answer: true, stay_on_left: true, position: 1,
    })

    // second scenario: swerve (B) is shown on the left, but B still means swerve
    await waitFor(() => expect(order()).toEqual(['Option B: Swerve s2', 'Option A: Stay s2']))
    fireEvent.click(screen.getByRole('button', { name: /Option A: Stay s2/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm choice' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(sendResponse.mock.calls[1][0]).toMatchObject({ scenario_id: 's2', choice: 'A', stay_on_left: false, position: 2 })
  })

  it('Indifferent can be picked, switched to, and is sent as "I" with its hover time', async () => {
    render(<Poll scenarios={[scenario('s1')]} demo={false} sessionId="abc" onDone={() => {}} />)
    const indifferent = screen.getByRole('button', { name: /Indifferent/ })
    fireEvent.click(screen.getByRole('button', { name: /Option A: Stay s1/ }))
    fireEvent.click(indifferent)
    expect(indifferent.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm choice' }))
    await waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))
    const sent = sendResponse.mock.calls[0][0]
    expect(sent).toMatchObject({ choice: 'I', first_choice: 'A', changed_answer: true })
    expect(Object.keys(sent.hover_ms)).toEqual(['A', 'B', 'I'])
  })

  it('confirm is disabled until an option is picked', () => {
    render(<Poll scenarios={[scenario('s1')]} demo={false} sessionId="abc" onDone={() => {}} />)
    expect(screen.getByRole('button', { name: 'Confirm choice' }).disabled).toBe(true)
  })
})

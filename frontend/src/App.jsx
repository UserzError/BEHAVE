// App: intro screen -> poll -> thank-you screen.
import { useEffect, useState } from 'react'
import Poll from './Poll.jsx'
import { loadScenarios } from './api.js'

// Random id for this participant, made once per page load. No personal info is collected.
const sessionId = crypto.randomUUID()

export default function App() {
  const [data, setData] = useState(null)     // { scenarios, demo } once loaded
  const [error, setError] = useState(false)
  const [screen, setScreen] = useState('intro') // 'intro' | 'poll' | 'done'

  useEffect(() => {
    loadScenarios().then(setData).catch((err) => {
      console.error(err)
      setError(true)
    })
  }, [])

  return (
    <main className="page">
      {data?.demo && (
        <p className="notice">Demo mode: the backend isn't running, so these are sample scenarios and answers aren't saved.</p>
      )}

      {screen === 'intro' && (
        <section className="intro">
          <h1>Self-Driving Dilemmas</h1>
          <p>A self-driving car's brakes have failed. In each scenario, you decide what it should do. There are no right answers.</p>
          <p className="muted">
            Along with your choice, we record how long you take to decide, how long your pointer rests on each option,
            and whether you change your mind before confirming. We don't collect your name, email or any other personal information.
          </p>
          <button type="button" className="primary" disabled={!data} onClick={() => setScreen('poll')}>
            {error ? "Couldn't load scenarios" : data ? 'Start' : 'Loading…'}
          </button>
        </section>
      )}

      {screen === 'poll' && (
        <Poll scenarios={data.scenarios} demo={data.demo} sessionId={sessionId} onDone={() => setScreen('done')} />
      )}

      {screen === 'done' && (
        <section className="intro">
          <h1>Thank you!</h1>
          <p>{data.demo ? 'That was the demo. Nothing was saved.' : 'Your answers have been recorded.'}</p>
        </section>
      )}
    </main>
  )
}

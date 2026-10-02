// App: picks the page from the URL hash.
//   #/results -> results page
//   #/admin   -> scenario designer
//   #/gallery -> character gallery (for checking the artwork)
//   #/scenes  -> scene preview examples
//   anything else -> intro screen -> poll -> thank-you screen
// (A hash is used because /results is already the backend's API address.)
import { lazy, Suspense, useEffect, useState } from 'react'
import Landing from './Landing.jsx'
import Poll from './Poll.jsx'
import { loadScenarios } from './api.js'

// Pages other than the poll are only downloaded when someone opens them, so the poll loads fast.
// (The results page brings in Chart.js, the biggest library; the designer and art pages are for admins.)
const Results = lazy(() => import('./Results.jsx'))
const AdminApp = lazy(() => import('./AdminApp.jsx'))
const Gallery = lazy(() => import('./Gallery.jsx'))
const ScenesDemo = lazy(() => import('./ScenesDemo.jsx'))

// Random id for this participant, made once per page load. No personal info is collected.
const sessionId = crypto.randomUUID()

// Fisher–Yates shuffle (returns a new array).
function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

// Shown for a moment while a page's code downloads.
function Page({ className, children }) {
  return (
    <main className={className}>
      <Suspense fallback={<p className="muted">Loading…</p>}>{children}</Suspense>
    </main>
  )
}

export default function App() {
  const hash = useHash()
  if (hash === '#/results') return <Page className="page page-wide"><Results /></Page>
  if (hash === '#/scenes') return <Page className="page page-wide"><ScenesDemo /></Page>
  if (hash === '#/gallery') return <Page className="page page-wide"><Gallery /></Page>
  if (hash === '#/admin') return <Page className="page page-admin"><AdminApp /></Page>
  return <PollFlow />
}

function PollFlow() {
  const [data, setData] = useState(null)     // { scenarios, demo } once loaded
  const [error, setError] = useState(false)
  const [screen, setScreen] = useState('intro') // 'intro' | 'poll' | 'done'

  useEffect(() => {
    // Everyone sees the scenarios in a different random order.
    loadScenarios().then(({ scenarios, demo }) => setData({ scenarios: shuffle(scenarios), demo })).catch((err) => {
      console.error(err)
      setError(true)
    })
  }, [])

  return (
    <main className={screen === 'intro' ? 'page page-landing' : 'page'}>
      {data?.demo && (
        <p className="notice">Demo mode: the backend isn't running, so these are sample scenarios and answers aren't saved.</p>
      )}

      {screen === 'intro' && (
        <Landing ready={Boolean(data)} error={error} onStart={() => { setScreen('poll'); window.scrollTo(0, 0) }} />
      )}

      {screen === 'poll' && (
        <Poll scenarios={data.scenarios} demo={data.demo} sessionId={sessionId} onDone={() => setScreen('done')} />
      )}

      {screen === 'done' && (
        <section className="intro">
          <h1>Thank you!</h1>
          <p>{data.demo ? 'That was the demo. Nothing was saved.' : 'Your answers have been recorded.'}</p>
          <a className="primary" href="#/results">See how you compare</a>
        </section>
      )}
    </main>
  )
}

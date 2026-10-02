// YourComparison — "How you compare": for each scenario you answered, your choice and telemetry
// next to everyone else's. Your own answer is taken back out of the totals when it was saved,
// so you're compared with other people, not with yourself.

import { compareTime, longerLook, othersFor, percent, seconds } from './compare.js'

function ScenarioComparison({ row, mine }) {
  const others = othersFor(row, mine)
  const label = { A: row.labelA, B: row.labelB, I: 'Indifferent' }
  const sameShare = others.n ? others.votes[mine.choice] / others.n : 0
  const share = (x) => (others.n ? others.votes[x] / others.n : 0)
  const time = compareTime(mine.decision_ms, others.avgMs)
  const myLook = longerLook(mine.hover_ms)
  const othersLook = longerLook(others.hover)

  return (
    <article className="card compare-card">
      <h3>{row.name} <span className="muted">· {row.title}</span></h3>

      <p className="compare-choice">
        <span className={`choice-chip choice-${mine.choice}`}>{mine.choice}</span>
        <span>{mine.choice === 'I' ? <>You were <strong>indifferent</strong></> : <>You chose <strong>{label[mine.choice]}</strong></>}</span>
      </p>
      {others.n > 0 ? (
        <>
          <div className="split-bar" aria-hidden="true">
            {['A', 'I', 'B'].map((x) => share(x) > 0 && (
              <span key={x} className={`split-${x} ${mine.choice === x ? 'is-yours' : ''}`} style={{ flexGrow: share(x) }}>
                {share(x) >= 0.12 && `${x === 'I' ? 'Indiff.' : x} ${percent(share(x))}`}
              </span>
            ))}
          </div>
          <p className="compare-headline">
            <strong>{percent(sameShare)}</strong> of {others.n} other{others.n === 1 ? '' : 's'} {mine.choice === 'I' ? 'were also indifferent' : 'chose the same'}
            {sameShare > 0.5 ? ': you went with the majority.' : sameShare < 0.5 ? ': you went against the majority.' : '.'}
          </p>
        </>
      ) : (
        <p className="muted">Nobody else has answered this one yet.</p>
      )}

      <dl className="compare-stats">
        <div>
          <dt>Decision time</dt>
          <dd>
            You {seconds(mine.decision_ms)}
            {others.n > 0 && <> · others {seconds(others.avgMs)} on average <span className="muted">({time} average)</span></>}
          </dd>
        </div>
        <div>
          <dt>Changed your mind</dt>
          <dd>
            {mine.changed_answer ? `Yes (first picked ${mine.first_choice === 'I' ? 'Indifferent' : mine.first_choice})` : 'No'}
            {others.n > 0 && <> · {percent(others.changedRate)} of others did</>}
          </dd>
        </div>
        <div>
          <dt>Looked longer at</dt>
          <dd>
            {myLook
              ? <>You: {myLook} ({seconds(mine.hover_ms[myLook])} vs {seconds(mine.hover_ms[myLook === 'A' ? 'B' : 'A'])})</>
              : 'You: no pointer data (touch screen)'}
            {others.n > 0 && othersLook && (
              <> · others: {othersLook} on average ({seconds(others.hover[othersLook])} vs {seconds(others.hover[othersLook === 'A' ? 'B' : 'A'])})</>
            )}
            {(mine.hover_ms.I ?? 0) >= 50 && <> · you spent {seconds(mine.hover_ms.I)} on Indifferent</>}
          </dd>
        </div>
      </dl>
    </article>
  )
}

// rows: the results page's rows (one per scenario); mine: { scenario_id: your response }
export default function YourComparison({ rows, mine }) {
  const answered = rows.filter((r) => mine[r.scenario_id])
  if (answered.length === 0) {
    return (
      <div className="card compare-empty">
        <h2>How you compare</h2>
        <p className="muted">Take the poll to see how your choices, and how long you took to make them, compare with everyone else's.</p>
        <a className="primary" href="#/">Take the poll</a>
      </div>
    )
  }

  // Summary across all the scenarios you answered.
  let agreed = 0, faster = 0, changed = 0, othersChanged = 0, compared = 0
  for (const row of answered) {
    const m = mine[row.scenario_id]
    const o = othersFor(row, m)
    if (m.changed_answer) changed++
    if (o.n === 0) continue
    compared++
    if (o.votes[m.choice] / o.n > 0.5) agreed++
    if (m.decision_ms < o.avgMs) faster++
    othersChanged += o.changedRate
  }

  return (
    <section className="compare" aria-labelledby="compare-heading">
      <h2 id="compare-heading">How you compare</h2>
      <p className="compare-summary">
        You went with the majority in <strong>{agreed} of {compared}</strong> scenario{compared === 1 ? '' : 's'}, decided faster than
        average in <strong>{faster}</strong>, and changed your mind in <strong>{changed}</strong> of {answered.length}
        {compared > 0 && <> (others changed their minds {percent(othersChanged / compared)} of the time)</>}.
      </p>
      <div className="compare-grid">
        {answered.map((row) => <ScenarioComparison key={row.scenario_id} row={row} mine={mine[row.scenario_id]} />)}
      </div>
    </section>
  )
}

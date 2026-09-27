// myAnswers.js — remembers this visitor's own answers (in this browser tab only), so the results
// page can compare them with everyone else's. Nothing here is sent anywhere.
const KEY = 'behave-my-answers'

// saved: whether the answer reached the server (if so, the results page takes it back out of
// the totals, so you're compared with other people rather than with yourself).
export function rememberAnswer(sessionId, response, saved) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    const data = stored?.sessionId === sessionId ? stored : { sessionId, answers: {} } // new poll = start over
    data.answers[response.scenario_id] = { ...response, saved }
    sessionStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage blocked (e.g. private window): the comparison just won't be shown
  }
}

// { scenario_id: response } for the most recent poll in this tab, or {} if none.
export function loadMyAnswers() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null')?.answers ?? {}
  } catch {
    return {}
  }
}

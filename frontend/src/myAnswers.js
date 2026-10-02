// myAnswers.js — remembers this visitor's own answers (in this browser tab only), so the results
// page can compare them with everyone else's. Nothing here is sent anywhere.
const KEY = 'behave-my-answers'

// savedAt: the server's time when it saved the answer, or null if it wasn't saved. The results page
// takes saved answers back out of the totals (so you're compared with other people), but only from
// results computed after savedAt, since results are cached for a few seconds.
export function rememberAnswer(sessionId, response, savedAt) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    const data = stored?.sessionId === sessionId ? stored : { sessionId, answers: {} } // new poll = start over
    data.answers[response.scenario_id] = { ...response, saved: Boolean(savedAt), saved_at: savedAt ?? null }
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

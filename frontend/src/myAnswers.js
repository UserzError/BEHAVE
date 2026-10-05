// myAnswers.js — remembers this visitor's own answers (in this browser tab only), so the results
// page can compare them with everyone else's. Nothing here is sent anywhere.
const KEY = 'behave-my-answers'

// reply: the server's reply ({ saved_at, path }) or null if the answer wasn't saved. The results page
// takes saved answers back out of the totals (so you're compared with other people), but only from
// results computed after saved_at, since results are cached for a few seconds. `path` holds the
// server's mouse-path measures for this answer.
export function rememberAnswer(sessionId, response, reply) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    const data = stored?.sessionId === sessionId ? stored : { sessionId, answers: {} } // new poll = start over
    data.answers[response.scenario_id] = {
      ...response,
      saved: Boolean(reply),
      saved_at: reply?.saved_at ?? null,
      path: reply?.path ?? null,
    }
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

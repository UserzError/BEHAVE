// api.js — talking to the Flask backend.
// If the backend isn't running, the poll and results fall back to sample files in public/ ("demo mode").

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} returned ${res.status}`)
  return res.json()
}

// ---------- Poll ----------

export async function loadScenarios() {
  try {
    return { scenarios: await getJSON('/scenarios'), demo: false }
  } catch (err) {
    console.warn('Backend not reachable, using sample scenarios:', err)
    return { scenarios: await getJSON('/sample-scenarios.json'), demo: true }
  }
}

// Returns true if the answer was saved on the server.
export async function sendResponse(response, demo) {
  if (demo) {
    console.log('Demo mode — would POST /response:', response)
    return false
  }
  try {
    // Send the JSON to the backend
    const res = await fetch('/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response), // object -> JSON text
    })
    if (!res.ok) console.error('POST /response failed:', res.status, await res.text())
    return res.ok
  } catch (err) {
    // Keep the participant moving even if one save fails.
    console.error('POST /response failed:', err)
    return false
  }
}

// Results page data: vote counts per scenario (/results) plus titles and labels (/scenarios).
export async function loadResults() {
  try {
    const [results, scenarios] = await Promise.all([getJSON('/results'), getJSON('/scenarios')])
    return { results, scenarios, demo: false }
  } catch (err) {
    console.warn('Backend not reachable, using sample results:', err)
    const [results, scenarios] = await Promise.all([getJSON('/sample-results.json'), getJSON('/sample-scenarios.json')])
    return { results, scenarios, demo: true }
  }
}

// ---------- Admin (scenario designer) ----------
// The admin token is asked for once and kept in sessionStorage (cleared when the tab closes).

const TOKEN_KEY = 'behave-admin-token'

export function getAdminToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage blocked: the token just won't be remembered
  }
}

// fetch with the admin token header. Throws an Error with the server's message if it fails.
async function adminFetch(method, url, body, token = getAdminToken()) {
  let res
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error("Can't reach the backend. Is `python app.py` running?")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `${method} ${url} failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

export const checkAdminToken = (token) => adminFetch('GET', '/admin/check', undefined, token)
export const createScenario = (scenario) => adminFetch('POST', '/admin/scenarios', scenario)
export const updateScenario = (id, scenario) => adminFetch('PUT', `/admin/scenarios/${encodeURIComponent(id)}`, scenario)
export const deleteScenario = (id) => adminFetch('DELETE', `/admin/scenarios/${encodeURIComponent(id)}`)

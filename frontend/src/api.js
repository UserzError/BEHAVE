// api.js — talking to the Flask backend.
// If the backend isn't running, fall back to the sample file in public/ ("demo mode").

export async function loadScenarios() {
  try {
    const res = await fetch('/scenarios')
    if (!res.ok) throw new Error(`GET /scenarios returned ${res.status}`)
    return { scenarios: await res.json(), demo: false }
  } catch (err) {
    console.warn('Backend not reachable, using sample scenarios:', err)
    const res = await fetch('/sample-scenarios.json')
    return { scenarios: await res.json(), demo: true }
  }
}

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} returned ${res.status}`)
  return res.json()
}

// Results page data: vote counts per scenario (/results) plus option labels (/scenarios).
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

export async function sendResponse(response, demo) {
  if (demo) {
    console.log('Demo mode — would POST /response:', response)
    return
  }
  try {
    // Send the JSON to the backend
    const res = await fetch('/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response), // object -> JSON text
    })
    if (!res.ok) console.error('POST /response failed:', res.status, await res.text())
  } catch (err) {
    // Keep the participant moving even if one save fails.
    console.error('POST /response failed:', err)
  }
}

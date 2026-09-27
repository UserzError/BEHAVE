// designerData.js — the non-visual parts of the scenario designer:
// templates, cleaning up imported data, checking for problems, and the browser draft.
import { VICTIMS } from './victims.js'

export const MAX_VICTIMS = 5
export const PALETTE = ['man', 'woman', 'child', 'elderly', 'dog', 'passenger']
const DRAFT_KEY = 'scenario-designer-draft'

// Starting points for a new scenario, like Moral Machine's "Between whom is the car deciding?"
export const TEMPLATES = [
  {
    name: 'Pedestrians vs pedestrians',
    A: { action: 'stay', label: 'Stay in lane', victims: ['man'], signal: 'none' },
    B: { action: 'swerve', label: 'Swerve into the other lane', victims: ['woman'], signal: 'none' },
  },
  {
    name: 'Pedestrians ahead vs passengers',
    A: { action: 'stay', label: 'Stay in lane', victims: ['man'], signal: 'none' },
    B: { action: 'swerve', label: 'Swerve into the barrier', victims: ['passenger'], signal: 'none' },
  },
  {
    name: 'Passengers vs pedestrians in other lane',
    A: { action: 'stay', label: 'Stay in lane and hit the barrier', victims: ['passenger'], signal: 'none' },
    B: { action: 'swerve', label: 'Swerve into the other lane', victims: ['man'], signal: 'none' },
  },
]

// A crossing signal only makes sense if pedestrians are crossing (not just passengers).
export function hasPedestrians(option) {
  return option.victims.some((v) => v !== 'passenger')
}

// Make sure a scenario has every field in the format from CLAUDE.md.
export function normalize(s) {
  const option = (o = {}) => {
    const clean = {
      action: o.action === 'swerve' ? 'swerve' : 'stay',
      label: o.label || '',
      victims: Array.isArray(o.victims) ? o.victims.filter((v) => v in VICTIMS) : [],
      signal: ['green', 'red', 'none'].includes(o.signal) ? o.signal : 'none',
    }
    if (!hasPedestrians(clean)) clean.signal = 'none'
    return clean
  }
  return {
    id: String(s.id || ''),
    text: s.text || '',
    options: { A: option(s.options?.A), B: option(s.options?.B) },
  }
}

export function newFromTemplate(template, id) {
  return normalize({
    id,
    text: "The car's brakes have failed. What should it do?",
    options: structuredClone({ A: template.A, B: template.B }),
  })
}

// Next free id: s1, s2, … based on the highest number already used.
export function nextId(scenarios) {
  const numbers = scenarios.map((s) => parseInt(s.id.replace(/\D/g, ''), 10)).filter((n) => !isNaN(n))
  return `s${Math.max(0, ...numbers) + 1}`
}

// Everything that must be fixed before exporting.
export function findProblems(scenarios) {
  const problems = []
  const seen = new Set()
  scenarios.forEach((s, i) => {
    const name = s.id || `Scenario ${i + 1}`
    if (!s.id.trim()) problems.push(`${name}: needs an ID.`)
    else if (seen.has(s.id)) problems.push(`${name}: ID is used more than once.`)
    seen.add(s.id)
    if (!s.text.trim()) problems.push(`${name}: needs a question.`)
    for (const letter of ['A', 'B']) {
      const o = s.options[letter]
      if (!o.label.trim()) problems.push(`${name}, option ${letter}: needs a button label.`)
      if (o.victims.length === 0) problems.push(`${name}, option ${letter}: add at least one person or animal.`)
    }
  })
  if (scenarios.length === 0) problems.push('Add at least one scenario.')
  return problems
}

// The draft lives in this browser only. Storage can be blocked (private windows), so never let it crash.
export function saveDraft(scenarios) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(scenarios))
  } catch {
    // the designer still works; the draft just isn't kept
  }
}

export function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY))
    return Array.isArray(saved) && saved.length > 0 ? saved.map(normalize) : null
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // nothing to clear
  }
}

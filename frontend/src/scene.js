// scene.js — rules for the three dilemma types (see ADMIN_BUILDER.md).
// For each outcome, where its at-risk group is:
//   'ahead' = pedestrians on the crossing in the car's own lane
//   'other' = pedestrians on the crossing in the other lane
//   'car'   = passengers (the car hits a barrier)

export const DILEMMAS = {
  peds_vs_peds: {
    label: 'Pedestrians vs. pedestrians',
    stay: 'ahead',
    swerve: 'other',
  },
  peds_ahead_vs_car: {
    label: 'Pedestrians ahead vs. passengers',
    stay: 'ahead',
    swerve: 'car', // barrier in the other lane
  },
  car_vs_peds_other: {
    label: 'Passengers vs. pedestrians other lane',
    stay: 'car', // barrier ahead
    swerve: 'other',
  },
}

// Caption for where a group is.
export const PLACE_CAPTIONS = {
  ahead: 'Crossing ahead',
  other: 'Crossing in other lane',
  car: 'In the car',
}

// Which lane (if any) has the barrier: the lane the car drives into when passengers are the ones at risk.
export function barrierLane(dilemma) {
  const d = DILEMMAS[dilemma]
  if (d.stay === 'car') return 'ahead'
  if (d.swerve === 'car') return 'other'
  return null
}

// ---------- Scenario helpers (v2 format, see ADMIN_BUILDER.md) ----------

export const MAX_GROUP = 5

// Suggested button labels for each dilemma type. Used for new scenarios, and when the
// dilemma changes while a label still has its suggested text.
export const DEFAULT_LABELS = {
  peds_vs_peds: { stay: 'Stay in lane', swerve: 'Swerve into the other lane' },
  peds_ahead_vs_car: { stay: 'Stay in lane', swerve: 'Swerve into the barrier' },
  car_vs_peds_other: { stay: 'Stay and hit the barrier', swerve: 'Swerve into the other lane' },
}

export function blankScenario() {
  return {
    title: '',
    description: '',
    text: "The car's brakes have failed. What should it do?",
    dilemma: 'peds_vs_peds',
    signals: { ahead: 'none', other: 'none' },
    outcomes: {
      stay: { label: DEFAULT_LABELS.peds_vs_peds.stay, group: [] },
      swerve: { label: DEFAULT_LABELS.peds_vs_peds.swerve, group: [] },
    },
  }
}

// Lanes that actually have people crossing in this scenario. A lane can be left empty
// ("nobody there"), and then it can't have a road light either.
export function lanesWithPeople(scenario) {
  const d = DILEMMAS[scenario.dilemma]
  return ['stay', 'swerve']
    .filter((o) => d[o] !== 'car' && scenario.outcomes[o].group.length > 0)
    .map((o) => d[o])
}

// Turn off road lights on lanes that have nobody in them. Changes the scenario in place.
export function clearUnusedSignals(scenario) {
  const lanes = lanesWithPeople(scenario)
  for (const lane of ['ahead', 'other']) {
    if (!lanes.includes(lane)) scenario.signals[lane] = 'none'
  }
  return scenario
}

// Switch dilemma type: keep both groups (they just change meaning), reset signals that no
// longer apply to 'none', and update labels that still have the old suggested text.
export function withDilemma(scenario, dilemma) {
  const next = structuredClone(scenario)
  next.dilemma = dilemma
  clearUnusedSignals(next)
  for (const outcome of ['stay', 'swerve']) {
    if (next.outcomes[outcome].label === DEFAULT_LABELS[scenario.dilemma][outcome]) {
      next.outcomes[outcome].label = DEFAULT_LABELS[dilemma][outcome]
    }
  }
  return next
}

// What's missing before a scenario can be saved (empty list = ready).
// One side may be empty (nobody gets hurt that way), but not both: the road can't be empty.
export function missingForSave(scenario) {
  const missing = []
  if (!scenario.title.trim()) missing.push('a title')
  if (scenario.outcomes.stay.group.length === 0 && scenario.outcomes.swerve.group.length === 0) {
    missing.push('at least one character in Stay or Swerve (both can’t be empty)')
  }
  if (!scenario.outcomes.stay.label.trim() || !scenario.outcomes.swerve.label.trim()) missing.push('both button labels')
  return missing
}

// ["man", "man", "doctor_f"] -> "2 × Man, Doctor (woman)" — a text version of a group, for screen
// readers and the summary line under each option.
export function describeGroup(group, labelFor) {
  const counts = new Map()
  for (const p of group) counts.set(p.type, (counts.get(p.type) || 0) + 1)
  if (counts.size === 0) return 'nobody'
  return [...counts].map(([type, n]) => (n > 1 ? `${n} × ${labelFor(type)}` : labelFor(type))).join(', ')
}

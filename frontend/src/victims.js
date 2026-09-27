// Allowed victim types (see the scenario format in CLAUDE.md): an icon plus singular/plural names.
export const VICTIMS = {
  man:       { emoji: '👨', one: 'man', many: 'men' },
  woman:     { emoji: '👩', one: 'woman', many: 'women' },
  child:     { emoji: '🧒', one: 'child', many: 'children' },
  elderly:   { emoji: '🧓', one: 'elderly person', many: 'elderly people' },
  passenger: { emoji: '🧑', one: 'passenger', many: 'passengers' },
  dog:       { emoji: '🐕', one: 'dog', many: 'dogs' },
}

// Text for the crossing signal. "none" shows nothing.
export const SIGNALS = {
  green: '🟢 Pedestrians are crossing on a green light (legally)',
  red:   '🔴 Pedestrians are crossing on a red light (illegally)',
  none:  '',
}

// ["man", "child", "child"] -> "1 man and 2 children"
export function describeVictims(victims) {
  const counts = {}
  for (const v of victims) counts[v] = (counts[v] || 0) + 1
  const parts = Object.entries(counts).map(([type, n]) => {
    const names = VICTIMS[type] || { one: type, many: type }
    return `${n} ${n === 1 ? names.one : names.many}`
  })
  if (parts.length === 0) return 'nobody'
  if (parts.length === 1) return parts[0]
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
}

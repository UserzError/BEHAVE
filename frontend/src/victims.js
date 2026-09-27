// Names for each allowed victim type (see the scenario format in CLAUDE.md).
const NAMES = {
  man:       ['man', 'men'],
  woman:     ['woman', 'women'],
  child:     ['child', 'children'],
  elderly:   ['elderly person', 'elderly people'],
  passenger: ['passenger', 'passengers'],
  dog:       ['dog', 'dogs'],
}

// ["man", "child", "child"] -> "1 man and 2 children"
export function describeVictims(victims) {
  const counts = {}
  for (const v of victims) counts[v] = (counts[v] || 0) + 1
  const parts = Object.entries(counts).map(([type, n]) => {
    const [one, many] = NAMES[type] || [type, type]
    return `${n} ${n === 1 ? one : many}`
  })
  if (parts.length === 0) return 'nobody'
  if (parts.length === 1) return parts[0]
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
}

// PathSketch — draws a participant's mouse path over a simple map of the two options as they saw them.
// Coordinates are relative to the options area (0–1 across and down); the Indifferent button sat just below it.
// The solid line is the path up to the final click (what the path measures use); the faint line is after it.

export default function PathSketch({ path, finalSelectMs, stayOnLeft, choice }) {
  if (!path || path.length < 2) return null
  const left = stayOnLeft ? 'A' : 'B'
  const right = stayOnLeft ? 'B' : 'A'
  const until = finalSelectMs ?? Infinity
  const before = path.filter(([t]) => t <= until)
  const after = path.filter(([t]) => t >= (before.at(-1)?.[0] ?? 0))
  const points = (list) => list.map(([, x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ')
  const end = before.at(-1)
  const box = (x, letter) => (
    <g>
      <rect x={x} y="0" width="0.47" height="1" rx="0.04" className={`sketch-box sketch-${letter}${choice === letter ? ' is-chosen' : ''}`} />
      <text x={x + 0.235} y="0.56" textAnchor="middle" className="sketch-letter">{letter}</text>
    </g>
  )
  return (
    <svg viewBox="-0.05 -0.08 1.1 1.36" className="path-sketch" role="img"
      aria-label={`Your mouse path: you finished on ${choice === 'I' ? 'Indifferent' : `option ${choice}`}`}>
      {box(0, left)}
      {box(0.53, right)}
      <rect x="0" y="1.06" width="1" height="0.16" rx="0.04" className={`sketch-box sketch-I${choice === 'I' ? ' is-chosen' : ''}`} />
      <text x="0.5" y="1.17" textAnchor="middle" className="sketch-small">Indifferent</text>
      {after.length > 1 && <polyline points={points(after)} className="sketch-path-after" />}
      {before.length > 1 && <polyline points={points(before)} className="sketch-path" />}
      <circle cx={before[0][1]} cy={before[0][2]} r="0.025" className="sketch-start" />
      {end && <circle cx={end[1]} cy={end[2]} r="0.035" className="sketch-end" />}
    </svg>
  )
}

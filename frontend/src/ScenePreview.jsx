// ScenePreview — draws one outcome of a v2 scenario as a top-down SVG road scene.
// Shared by the designer and (later) the poll, so it has no admin-only logic.
//
// Layout (viewBox 300 x 380): the car drives UP the right lane ("ahead"); the left lane is the "other" lane.
// A pedestrian crossing runs across both lanes near the top. Every element has a data-label,
// so wrapping the scene in <HoverLabels> shows what it is after a 2-second hover.
import { Character, CHARACTER_BY_ID, FateBadge, headTop } from './characters.jsx'
import { DILEMMAS, barrierLane } from './scene.js'

const LANES = {
  other: { x: 30, width: 120 }, // left lane
  ahead: { x: 150, width: 120 }, // right lane: the car's own lane
}
const CROSSING = { top: 46, bottom: 166 }
const CAR = { x: 180, y: 262, width: 60, height: 92 } // front of the car is at the top
const WALKER_WIDTH = 32
const BADGE_R = 7 * (WALKER_WIDTH / 40) // skull size for everyone in the scene (pedestrians and passengers)

const fill = (name) => ({ fill: `var(--${name})` })

// Where each walker stands in a lane: two staggered rows so five people fit.
function placeWalkers(group, lane) {
  const n = group.length
  const usable = lane.width - 16 - WALKER_WIDTH
  const step = n > 1 ? usable / (n - 1) : 0
  const start = lane.x + 8 + (n > 1 ? 0 : usable / 2)
  return group
    .map((person, i) => {
      const animal = CHARACTER_BY_ID[person.type]?.kind === 'animal'
      const height = WALKER_WIDTH * (animal ? 32 / 40 : 64 / 40)
      const row = i % 2 // 0 = back row, 1 = front row
      const feet = row ? CROSSING.bottom - 6 : CROSSING.bottom - 30
      return { ...person, key: i, row, x: start + i * step, y: feet - height, width: WALKER_WIDTH, height }
    })
    .sort((a, b) => a.row - b.row) // draw the back row first
}

// Skull placement that never covers the person: people in the first row (the back row on the crossing,
// the front row in the car) get it above the head; people in the second row get it below the feet.
function skullPosition(p) {
  const cx = p.x + p.width / 2
  const cy = p.row === 0
    ? p.y + headTop(p.type) * (p.width / 40) - BADGE_R - 0.5
    : p.y + p.height + BADGE_R + 0.5
  return { cx, cy }
}

// Passengers sit in the cabin: up to 3 in the front row, the rest behind.
function placePassengers(group) {
  const width = 14
  const rows = [group.slice(0, 3), group.slice(3)]
  return rows.flatMap((row, r) =>
    row.map((person, i) => {
      const animal = CHARACTER_BY_ID[person.type]?.kind === 'animal'
      const height = width * (animal ? 32 / 40 : 64 / 40)
      const spacing = (CAR.width - 16) / row.length
      const cx = CAR.x + 8 + spacing * (i + 0.5)
      const feet = CAR.y + (r === 0 ? 58 : 80) // two rows under the glass roof
      return { ...person, key: `${r}-${i}`, row: r, x: cx - width / 2, y: feet - height, width, height }
    }),
  )
}

function RoadLight({ lane, color }) {
  // Sits on the sidewalk beside its lane: left sidewalk for the other lane, right sidewalk for ours.
  const x = lane === 'other' ? 5 : 275
  const label = color === 'green'
    ? 'Green road light: pedestrians may cross'
    : 'Red road light: pedestrians should not cross'
  return (
    <g data-label={label} role="img" aria-label={label}>
      <rect x={x + 7.5} y="104" width="5" height="40" rx="2" style={fill('signal-pole')} />
      <rect x={x} y="62" width="20" height="44" rx="6" style={fill('signal-box')} />
      <circle cx={x + 10} cy="74" r="6.5" style={fill(color === 'red' ? 'signal-red' : 'signal-off')} />
      <circle cx={x + 10} cy="94" r="6.5" style={fill(color === 'green' ? 'signal-green' : 'signal-off')} />
    </g>
  )
}

// Concrete barrier: three road-barrier blocks side by side across the lane.
// Each block: light top edge, flat face, shaded right end, darker sloped base, and two lifting slots.
function Barrier({ lane }) {
  const { x, width } = LANES[lane]
  const count = 3
  const gap = 3
  const blockWidth = (width - 20 - gap * (count - 1)) / count
  const top = 92
  const height = 30
  return (
    <g data-label="Concrete barrier" role="img" aria-label="Concrete barrier">
      <ellipse cx={x + width / 2} cy={top + height + 1} rx={width / 2 - 4} ry="5" style={fill('concrete-shadow')} />
      {Array.from({ length: count }, (_, i) => {
        const bx = x + 10 + i * (blockWidth + gap)
        return (
          <g key={i}>
            <rect x={bx} y={top} width={blockWidth} height={height} rx="2" style={fill('concrete')} />
            <rect x={bx} y={top} width={blockWidth} height="4" rx="2" style={fill('concrete-light')} />
            <rect x={bx + blockWidth - 3} y={top + 2} width="3" height={height - 2} style={fill('concrete-end')} />
            <rect x={bx} y={top + height - 10} width={blockWidth} height="10" style={fill('concrete-dark')} />
            <rect x={bx + blockWidth * 0.18} y={top + height - 4} width={blockWidth * 0.18} height="4" style={fill('concrete-slot')} />
            <rect x={bx + blockWidth * 0.64} y={top + height - 4} width={blockWidth * 0.18} height="4" style={fill('concrete-slot')} />
          </g>
        )
      })}
    </g>
  )
}

// One tire as a path: 3.5 wide, 18 tall, rounded only on the corners away from the car.
function tirePath(side, y) {
  const w = 3.5
  const h = 18
  const r = 1.5
  if (side === 'left') {
    const x = CAR.x - 1 - w // 1-unit gap to the body
    return `M${x + w} ${y} H${x + r} Q${x} ${y} ${x} ${y + r} V${y + h - r} Q${x} ${y + h} ${x + r} ${y + h} H${x + w} Z`
  }
  const x = CAR.x + CAR.width + 1
  return `M${x} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x} Z`
}

function Car({ passengers, atRisk }) {
  const placed = placePassengers(passengers)
  return (
    <g>
      <g data-label="Self-driving car (its brakes have failed)" role="img" aria-label="Self-driving car">
        <ellipse cx={CAR.x + CAR.width / 2} cy={CAR.y + CAR.height - 4} rx={CAR.width / 2 + 4} ry="9" style={fill('scene-shadow')} />
        {/* tires: thin strips just outside the body (a small gap, no overlap), front and back on each side.
            Only the outer corners are rounded; the side facing the car is straight. */}
        {['left', 'right'].flatMap((side) =>
          [CAR.y + 12, CAR.y + CAR.height - 30].map((y) => (
            <path key={`${side}-${y}`} d={tirePath(side, y)} style={fill('scene-tire')} />
          )),
        )}
        <rect {...CAR} rx="9" style={fill('scene-car')} />
        {/* headlights */}
        <rect x={CAR.x + 5} y={CAR.y + 3} width="13" height="5" rx="2" style={fill('scene-headlight')} />
        <rect x={CAR.x + CAR.width - 18} y={CAR.y + 3} width="13" height="5" rx="2" style={fill('scene-headlight')} />
        {/* windshield, then a glass roof so passengers show through */}
        <rect x={CAR.x + 8} y={CAR.y + 13} width={CAR.width - 16} height="14" rx="3" style={fill('scene-glass-dark')} />
        <rect x={CAR.x + 7} y={CAR.y + 31} width={CAR.width - 14} height={CAR.height - 45} rx="4" style={fill('scene-glass')} />
      </g>
      {placed.map((p) => (
        <Character
          key={p.key}
          type={p.type}
          note="passenger"
          fate={atRisk ? p.fate : null}
          showBadge={false}
          x={p.x} y={p.y} width={p.width} height={p.height}
        />
      ))}
      {/* Passengers are drawn small to fit the car, so their skulls are drawn here instead, at the
          same size as the pedestrians' badges, and placed so they don't cover the passenger:
          front row -> above the head, back row -> below the feet (see skullPosition). */}
      {atRisk && placed.map((p) => (
        <g key={`badge-${p.key}`} aria-hidden="true">
          <FateBadge fate={p.fate} {...skullPosition(p)} r={BADGE_R} />
        </g>
      ))}
    </g>
  )
}

function Path({ outcome }) {
  const startX = CAR.x + CAR.width / 2
  const endX = outcome === 'stay' ? startX : LANES.other.x + LANES.other.width / 2
  // The arrow stops a little short of the crossing, so it never runs into a front-row skull.
  const tipY = CROSSING.bottom + 18
  const d = outcome === 'stay'
    ? `M${startX} ${CAR.y - 6} L${endX} ${tipY + 2}`
    : `M${startX} ${CAR.y - 6} C${startX} ${CAR.y - 40} ${endX} ${tipY + 44} ${endX} ${tipY + 2}`
  const label = outcome === 'stay' ? "Car's path if it stays in its lane" : "Car's path if it swerves into the other lane"
  return (
    <g data-label={label} role="img" aria-label={label}>
      {/* wide invisible stroke so the thin dashed line is easy to hover */}
      <path d={d} style={{ fill: 'none', stroke: 'transparent', strokeWidth: 16 }} />
      <path d={d} style={{ fill: 'none', stroke: 'var(--scene-path)', strokeWidth: 4, strokeDasharray: '10 8', strokeLinecap: 'round' }} />
      <path
        d={`M${endX - 11} ${tipY + 12} L${endX} ${tipY} L${endX + 11} ${tipY + 12}`}
        style={{ fill: 'none', stroke: 'var(--scene-path)', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }}
      />
    </g>
  )
}

// scenario: a v2 scenario. outcome: 'stay' or 'swerve' — which outcome this picture shows.
export default function ScenePreview({ scenario, outcome }) {
  const dilemma = DILEMMAS[scenario.dilemma]
  const barrier = barrierLane(scenario.dilemma)

  // Put each outcome's group in its place. Only this outcome's group shows fate badges.
  const groups = { ahead: null, other: null, car: null }
  for (const o of ['stay', 'swerve']) {
    groups[dilemma[o]] = { people: scenario.outcomes[o].group, atRisk: o === outcome }
  }

  // Everyone on the crossing, with their lane and whether they're at risk in this outcome.
  const walkers = ['other', 'ahead'].flatMap((lane) =>
    groups[lane]
      ? placeWalkers(groups[lane].people, LANES[lane]).map((p) => ({ ...p, lane, atRisk: groups[lane].atRisk }))
      : [],
  )

  const title = outcome === 'stay' ? 'If the car stays in its lane' : 'If the car swerves'

  return (
    <svg viewBox="0 0 300 380" className="scene" role="group" aria-label={title}>
      {/* sidewalks and road */}
      <rect width="300" height="380" style={fill('scene-sidewalk')} />
      <rect x="30" width="240" height="380" data-label="Road" style={fill('road')} />
      <rect x="31" width="2.5" height="380" style={fill('road-line')} />
      <rect x="266.5" width="2.5" height="380" style={fill('road-line')} />
      {/* center line (broken at the crossing) */}
      <path d={`M150 0 V${CROSSING.top - 8} M150 ${CROSSING.bottom + 8} V380`} style={{ stroke: 'var(--road-line)', strokeWidth: 3, strokeDasharray: '16 14' }} />

      {/* pedestrian crossing: stripes run along the road, across both lanes */}
      <g data-label="Pedestrian crossing" role="img" aria-label="Pedestrian crossing">
        <rect x="33" y={CROSSING.top} width="234" height={CROSSING.bottom - CROSSING.top} style={{ fill: 'transparent' }} />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={38 + i * 19.5} y={CROSSING.top} width="11" height={CROSSING.bottom - CROSSING.top} rx="2" style={fill('crossing-stripe')} />
        ))}
      </g>

      {/* road lights beside lanes that have pedestrians */}
      {['other', 'ahead'].map((lane) => {
        const color = scenario.signals?.[lane]
        return groups[lane] && color && color !== 'none' ? <RoadLight key={lane} lane={lane} color={color} /> : null
      })}

      {barrier && <Barrier lane={barrier} />}

      <Path outcome={outcome} />

      {/* pedestrians, walking to the right across the crossing */}
      {walkers.map((p) => (
        <Character
          key={`${p.lane}-${p.key}`}
          type={p.type}
          pose="walk"
          note={p.lane === 'ahead' ? 'crossing ahead' : 'crossing in the other lane'}
          fate={p.atRisk ? p.fate : null}
          showBadge={false}
          x={p.x} y={p.y} width={p.width} height={p.height}
        />
      ))}
      {/* their skulls, drawn on top: back row above the head, front row below the feet */}
      {walkers.filter((p) => p.atRisk).map((p) => (
        <g key={`badge-${p.lane}-${p.key}`} aria-hidden="true">
          <FateBadge fate={p.fate} {...skullPosition(p)} r={BADGE_R} />
        </g>
      ))}

      <Car passengers={groups.car?.people ?? []} atRisk={groups.car?.atRisk ?? false} />
    </svg>
  )
}

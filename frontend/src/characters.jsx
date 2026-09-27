// characters.jsx — the 20 scenario characters, drawn from scratch as inline SVG.
// Single source of truth: the designer's palette, the scene preview and the poll all use this file.
//
// Art style (see ADMIN_BUILDER.md): full-body figures, capsule body + round head, no faces, no outlines.
// Identity comes from proportions plus one accessory. Humans use viewBox 0 0 40 64, animals 0 0 40 32.
// Colors are CSS variables (--char-*) defined in index.css.
//
// Every character has two poses:
//   'stand' — facing the viewer (used in the designer's palette)
//   'walk'  — side profile, mid-stride, moving to the right (used on the crossing in scenes)

// Fill helper: fill('teal') -> style using var(--char-teal)
const fill = (name) => ({ fill: `var(--char-${name})` })
const stroke = (name, width) => ({ fill: 'none', stroke: `var(--char-${name})`, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round' })

// ============================================================
// STANDING (front view). Head: center 20,11, radius 7.
// ============================================================

const hairCap = (color) => <path d="M13 11 A7 7 0 0 1 27 11 Q20 6.5 13 11 Z" style={fill(color)} />

// Each hair style: `back` is drawn behind the head, `front` on top of it.
const HAIR = {
  short: { back: null, front: hairCap },
  long: {
    back: (c) => <path d="M12.3 11 A7.7 7.7 0 0 1 27.7 11 L28.3 23 Q20 25.5 11.7 23 Z" style={fill(c)} />,
    front: hairCap,
  },
  bun: { back: null, front: (c) => <>{hairCap(c)}<circle cx="20" cy="3.6" r="3" style={fill(c)} /></> },
  pigtails: {
    back: (c) => <><circle cx="11.6" cy="13" r="3.2" style={fill(c)} /><circle cx="28.4" cy="13" r="3.2" style={fill(c)} /></>,
    front: hairCap,
  },
}

// Body shapes, front view.
function FrontBody({ tone, build }) {
  if (build === 'large') {
    // Several shapes so "large" reads clearly: wide round torso, rounded shoulders, a belly fold.
    return (
      <g>
        <ellipse cx="20" cy="35" rx="14" ry="14.5" style={fill(tone)} />
        <ellipse cx="20" cy="24.5" rx="10" ry="6" style={fill(tone)} />
        <path d="M10.5 41 Q20 47.5 29.5 41" style={stroke(`${tone}-dark`, 1.4)} />
      </g>
    )
  }
  return <rect x="12" y="20" width="16" height="28" rx="8" style={fill(tone)} />
}

function FrontLegs({ tone, build }) {
  const c = fill(`${tone}-dark`)
  return build === 'large'
    ? <><rect x="11" y="46" width="7.5" height="17" rx="3.75" style={c} /><rect x="21.5" y="46" width="7.5" height="17" rx="3.75" style={c} /></>
    : <><rect x="14" y="44" width="5" height="19" rx="2.5" style={c} /><rect x="21" y="44" width="5" height="19" rx="2.5" style={c} /></>
}

// A generic standing human, customised per character.
// tone: color family ('teal', 'ochre', 'slate', 'plum', 'sage'): body = tone, head = tone-light, legs/hair = tone-dark
// build: 'normal' | 'large' | 'pregnant'; scale: 1 = adult, 0.65 = child; lean: elderly stoop
// behind / over / front: extra shapes behind the body, on the body (under the head), or on top of everything
function Standing({ tone, hair = 'short', hairColor = `${tone}-dark`, build = 'normal', scale = 1, lean = false, behind, over, front }) {
  return (
    <g transform={scale === 1 ? undefined : `translate(20 64) scale(${scale}) translate(-20 -64)`}>
      <FrontLegs tone={tone} build={build} />
      <g transform={lean ? 'rotate(8 20 46)' : undefined}>
        {HAIR[hair].back?.(hairColor)}
        {behind}
        <FrontBody tone={tone} build={build} />
        {build === 'pregnant' && <ellipse cx="25.5" cy="36" rx="6" ry="6.6" style={fill(tone)} />}
        {over}
        {build === 'large'
          ? <ellipse cx="20" cy="11.5" rx="7.8" ry="7.2" style={fill(`${tone}-light`)} />
          : <circle cx="20" cy="11" r="7" style={fill(`${tone}-light`)} />}
        {HAIR[hair].front(hairColor)}
      </g>
      {front}
    </g>
  )
}

// ============================================================
// WALKING (side profile, facing right). Head: center 21,11, radius 7.
// Hair is a slightly larger circle behind the head, shifted back and up,
// so it shows on the back and top of the head: that's what makes the figure face right.
// ============================================================

const sideHairCap = (c) => <circle cx="19" cy="9.6" r="7.6" style={fill(c)} />

const SIDE_HAIR = {
  short: sideHairCap,
  long: (c) => <><rect x="12.2" y="9" width="7.6" height="16.5" rx="3.8" style={fill(c)} />{sideHairCap(c)}</>,
  bun: (c) => <>{sideHairCap(c)}<circle cx="12.6" cy="7" r="3.1" style={fill(c)} /></>,
  pigtails: (c) => <>{sideHairCap(c)}<circle cx="12.4" cy="13.5" r="3.3" style={fill(c)} /></>,
}

// A limb that swings from a pivot. angle > 0 swings the end backward (left), angle < 0 forward (right).
function Limb({ x, y, width, length, angle, color }) {
  return (
    <rect
      x={x - width / 2} y={y - width / 2} width={width} height={length} rx={width / 2}
      transform={`rotate(${angle} ${x} ${y})`}
      style={fill(color)}
    />
  )
}

function SideBody({ tone, build }) {
  if (build === 'large') {
    return (
      <g>
        <ellipse cx="21" cy="34" rx="10.5" ry="14.5" style={fill(tone)} />
        <ellipse cx="27" cy="38" rx="7.5" ry="8.5" style={fill(tone)} />
        <ellipse cx="14.5" cy="40" rx="5" ry="6" style={fill(tone)} />
        <path d="M26 45 Q30.5 44.5 33.5 40" style={stroke(`${tone}-dark`, 1.4)} />
      </g>
    )
  }
  return (
    <g>
      <rect x="15" y="20" width="12" height="27" rx="6" style={fill(tone)} />
      {build === 'pregnant' && <ellipse cx="26.5" cy="35.5" rx="5.8" ry="6.8" style={fill(tone)} />}
    </g>
  )
}

// A generic walking human. Same options as Standing, plus arm swing angles.
function Walking({
  tone, hair = 'short', hairColor = `${tone}-dark`, build = 'normal', scale = 1, lean = 0,
  armFront = -30, armBack = 30, behind, over, front,
}) {
  const large = build === 'large'
  const legWidth = large ? 7.5 : 5
  const hipY = large ? 46 : 45
  return (
    <g transform={scale === 1 ? undefined : `translate(20 64) scale(${scale}) translate(-20 -64)`}>
      {/* legs mid-stride: back leg first, then the front one */}
      <Limb x={21} y={hipY} width={legWidth} length={large ? 18 : 19} angle={24} color={`${tone}-dark`} />
      <Limb x={21} y={hipY} width={legWidth} length={large ? 18 : 19} angle={-24} color={`${tone}-dark`} />
      <g transform={lean ? `rotate(${lean} 21 46)` : undefined}>
        <Limb x={21} y={24} width={4.4} length={17} angle={armBack} color={`${tone}-dark`} />
        {behind}
        {SIDE_HAIR[hair](hairColor)}
        <SideBody tone={tone} build={build} />
        {over}
        <circle cx="21" cy="11" r={large ? 7.4 : 7} style={fill(`${tone}-light`)} />
        <Limb x={21} y={24} width={4.4} length={17} angle={armFront} color={`${tone}-dark`} />
      </g>
      {front}
    </g>
  )
}

// ============================================================
// Accessories (stand / walk versions where they differ)
// ============================================================

// Doctors: a white lab coat, open at the neck, with a small cross.
const labCoatStand = (tone) => (
  <g>
    <path d="M12 25 Q12 20 20 20 Q28 20 28 25 L29.6 53 L10.4 53 Z" style={fill('coat')} />
    <path d="M17.4 20.4 L20 30 L22.6 20.4 Z" style={fill(tone)} />
    <path d="M20 30 L20 53" style={stroke('coat-shadow', 1)} />
    <rect x="23.4" y="31.5" width="1.3" height="4.2" style={fill(`${tone}-dark`)} />
    <rect x="21.95" y="32.95" width="4.2" height="1.3" style={fill(`${tone}-dark`)} />
  </g>
)
const labCoatWalk = (tone) => (
  <g>
    {/* the coat tail trails behind as they walk */}
    <path d="M14.5 24 Q14.5 19.6 21 19.6 Q27.4 19.6 27.4 24 L28.6 51 Q20 53.5 10.5 52.5 Z" style={fill('coat')} />
    <path d="M25.5 20.5 L27.2 29" style={stroke(tone, 2.2)} />
    <rect x="23.3" y="30" width="1.3" height="4.2" style={fill(`${tone}-dark`)} />
    <rect x="21.85" y="31.45" width="4.2" height="1.3" style={fill(`${tone}-dark`)} />
  </g>
)

const briefcaseAt = (x, y) => (
  <g>
    <path d={`M${x + 2.1} ${y} v-1.8 h4.8 v1.8`} style={stroke('ink', 1.3)} />
    <rect x={x} y={y} width="9" height="7" rx="1.5" style={fill('ink')} />
  </g>
)
const tie = (tone) => <path d="M20 21 l-1.6 2.2 l1.6 7.5 l1.6 -7.5 z" style={fill(`${tone}-dark`)} />

const sweatbandStand = <rect x="13" y="8.3" width="14" height="2.6" rx="1.2" style={fill('accent')} />
const sweatbandWalk = <rect x="13.2" y="7.8" width="15" height="2.6" rx="1.2" style={fill('accent')} />
const stripeStand = <rect x="18.8" y="21" width="2.4" height="26" rx="1.2" style={fill('accent')} />
const stripeWalk = <rect x="19.8" y="21" width="2.4" height="25" rx="1.2" style={fill('accent')} />

const prisonStripes = (x, width) => (
  <g style={fill('accent')}>
    <rect x={x} y="29" width={width} height="2.4" />
    <rect x={x} y="34" width={width} height="2.4" />
    <rect x={x} y="39" width={width} height="2.4" />
  </g>
)
const swagBagAt = (cx, cy) => (
  <g>
    <circle cx={cx} cy={cy} r="5" style={fill('ink')} />
    <circle cx={cx} cy={cy - 5.4} r="1.6" style={fill('ink')} />
  </g>
)

const bedrollStand = <rect x="6.5" y="16.5" width="27" height="7.5" rx="3.75" style={fill('sage-dark')} />
const bedrollWalk = <rect x="8.5" y="17.5" width="8" height="22" rx="4" style={fill('sage-dark')} />
const strap = (tone, d) => <path d={d} style={stroke(`${tone}-dark`, 1.6)} />

const caneStand = <path d="M30 34 Q30 30.5 32.6 30.5 Q35.2 30.5 35.2 33.5 L35.2 63" style={stroke('ink', 2)} />
const caneWalk = <path d="M32 40 Q32 37 34.5 37 Q37 37 37 40 L37.4 63" style={stroke('ink', 2)} />

// ============================================================
// Non-standard characters
// ============================================================

// rolling = false: parked (standing version). rolling = true: pushed from behind, moving right.
function BabyInStroller({ rolling = false }) {
  return (
    <g>
      <rect x="18" y="31" width="8" height="10" rx="4" style={fill('teal')} />
      <circle cx={rolling ? 23 : 24} cy="29.5" r="4.4" style={fill('teal-light')} />
      <path d="M6.5 40 Q6.5 26.5 19 26.5 L19 40 Z" style={fill('slate')} />
      <path d="M6.5 39 H33.5 Q33.5 53 20 53 Q6.5 53 6.5 39 Z" style={fill('slate')} />
      {rolling
        ? <path d="M7.5 39.5 L2.5 29" style={stroke('slate-dark', 2)} />
        : <path d="M33 39.5 L38 29" style={stroke('slate-dark', 2)} />}
      <circle cx="12.5" cy="58" r="4.2" style={fill('slate-dark')} />
      <circle cx="27.5" cy="58" r="4.2" style={fill('slate-dark')} />
      {rolling && <path d="M0.5 49 h3.5 M1.5 54 h3" style={stroke('ink', 1)} />}
    </g>
  )
}

// Four legs; `trot` splays them as if mid-step.
function animalLegs({ xs, width, top, length, color, trot }) {
  const angles = trot ? [18, -14, 14, -18] : [0, 0, 0, 0]
  return xs.map((x, i) => (
    <Limb key={i} x={x + width / 2} y={top + width / 2} width={width} length={length} angle={angles[i]} color={color} />
  ))
}

function Dog({ trot = false }) {
  return (
    <g>
      <path d={trot ? 'M9 13.5 Q4 8 6 2.5' : 'M9 14 Q4 10 5 4.5'} style={stroke('ochre', 2.6)} />
      {animalLegs({ xs: [9, 14, 22.5, 27.5], width: 3.4, top: 18, length: 12, color: 'ochre-dark', trot })}
      <rect x="7" y="11" width="24" height="10" rx="5" style={fill('ochre')} />
      <circle cx="31" cy="9.5" r="6" style={fill('ochre')} />
      <ellipse cx="36" cy="11.8" rx="3.4" ry="2.6" style={fill('ochre')} />
      <ellipse cx="28.4" cy="10.5" rx="2.4" ry="4.8" transform={`rotate(${trot ? -30 : -15} 28.4 10.5)`} style={fill('ochre-dark')} />
    </g>
  )
}

function Cat({ trot = false }) {
  return (
    <g>
      <path d={trot ? 'M8.5 16 Q3.5 10 6 3 Q7.5 0.8 9.4 2.6' : 'M8.5 17 Q2 13 3.5 5.5 Q4.5 3 6.8 4.6'} style={stroke('slate', 2.2)} />
      {animalLegs({ xs: [10, 14, 22.5, 26.3], width: 2.7, top: 18, length: 12, color: 'slate-dark', trot })}
      <rect x="8" y="13" width="21" height="8" rx="4" style={fill('slate')} />
      <circle cx="30" cy="11" r="5.2" style={fill('slate')} />
      <path d="M25.6 8.6 L26.6 2.2 L29.8 6.4 Z" style={fill('slate')} />
      <path d="M30.4 6.2 L33.8 2.2 L34.4 8.6 Z" style={fill('slate')} />
    </g>
  )
}

// ============================================================
// The list. draw(pose) returns the SVG shapes for 'stand' or 'walk'.
// kind: 'animal' uses the 40x32 viewBox. scale / headTop place the fate badge.
// badgeLeft: badge goes top-left (the elderly lean right, into the usual top-right spot).
// ============================================================

// Helper: same options for both poses, plus pose-specific accessories.
const human = (opts, standExtras = {}, walkExtras = {}) => (pose) =>
  pose === 'walk' ? <Walking {...opts} {...walkExtras} /> : <Standing {...opts} {...standExtras} />

export const CHARACTERS = [
  { id: 'man', label: 'Man', draw: human({ tone: 'teal' }) },
  { id: 'woman', label: 'Woman', draw: human({ tone: 'plum', hair: 'long' }) },
  { id: 'boy', label: 'Boy', scale: 0.65, draw: human({ tone: 'ochre', scale: 0.65 }) },
  { id: 'girl', label: 'Girl', scale: 0.65, draw: human({ tone: 'teal', hair: 'pigtails', scale: 0.65 }) },
  {
    id: 'elderly_man', label: 'Elderly man', badgeLeft: true,
    draw: human({ tone: 'slate', hairColor: 'hair-gray' }, { lean: true, front: caneStand }, { lean: 12, armFront: -42, armBack: 10, front: caneWalk }),
  },
  {
    id: 'elderly_woman', label: 'Elderly woman', badgeLeft: true,
    draw: human({ tone: 'plum', hair: 'bun', hairColor: 'hair-gray' }, { lean: true, front: caneStand }, { lean: 12, armFront: -42, armBack: 10, front: caneWalk }),
  },
  { id: 'large_man', label: 'Large man', draw: human({ tone: 'ochre', build: 'large' }) },
  { id: 'large_woman', label: 'Large woman', draw: human({ tone: 'sage', hair: 'long', build: 'large' }) },
  {
    id: 'executive_m', label: 'Executive (man)',
    draw: human({ tone: 'slate' }, { over: tie('slate'), front: briefcaseAt(28.5, 40) }, { armFront: -6, front: briefcaseAt(18.8, 40.5) }),
  },
  {
    id: 'executive_f', label: 'Executive (woman)',
    draw: human({ tone: 'teal', hair: 'long' }, { front: briefcaseAt(28.5, 40) }, { armFront: -6, front: briefcaseAt(18.8, 40.5) }),
  },
  { id: 'doctor_m', label: 'Doctor (man)', draw: human({ tone: 'sage' }, { over: labCoatStand('sage') }, { over: labCoatWalk('sage') }) },
  { id: 'doctor_f', label: 'Doctor (woman)', draw: human({ tone: 'teal', hair: 'long' }, { over: labCoatStand('teal') }, { over: labCoatWalk('teal') }) },
  {
    id: 'athlete_m', label: 'Athlete (man)',
    draw: human({ tone: 'ochre' }, { over: stripeStand, front: sweatbandStand }, { armFront: -45, armBack: 45, over: stripeWalk, front: sweatbandWalk }),
  },
  {
    id: 'athlete_f', label: 'Athlete (woman)',
    draw: human({ tone: 'plum', hair: 'long' }, { over: stripeStand, front: sweatbandStand }, { armFront: -45, armBack: 45, over: stripeWalk, front: sweatbandWalk }),
  },
  { id: 'pregnant', label: 'Pregnant woman', draw: human({ tone: 'sage', hair: 'long', build: 'pregnant' }, {}, { armFront: -15 }) },
  {
    id: 'criminal', label: 'Criminal',
    draw: human({ tone: 'slate' }, { over: prisonStripes(12, 16), front: swagBagAt(31.5, 43) }, { over: prisonStripes(15, 12), behind: swagBagAt(11.5, 31) }),
  },
  {
    id: 'homeless', label: 'Homeless person',
    draw: human(
      { tone: 'ochre' },
      { behind: bedrollStand, over: strap('ochre', 'M14 22 L26 41') },
      { behind: bedrollWalk, over: strap('ochre', 'M16 22 L26.5 38') },
    ),
  },
  { id: 'baby', label: 'Baby in stroller', headTop: 25, draw: (pose) => <BabyInStroller rolling={pose === 'walk'} /> },
  { id: 'dog', label: 'Dog', kind: 'animal', draw: (pose) => <Dog trot={pose === 'walk'} /> },
  { id: 'cat', label: 'Cat', kind: 'animal', draw: (pose) => <Cat trot={pose === 'walk'} /> },
]

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]))

// Fates: in this project a person either dies (killed) or is fine (no fate, no badge).
export const FATES = ['killed']

// ============================================================
// Fate badge: a skull in a dark circle beside the head, with a thin light ring
// so it stands out on dark figures and the road.
// ============================================================

export function FateBadge({ fate, cx, cy, r }) {
  if (fate !== 'killed') return null
  return (
    <g transform={`translate(${cx} ${cy}) scale(${r / 6})`} data-fate="killed">
      <circle r="6" style={{ fill: 'var(--char-badge)', stroke: 'var(--char-accent)', strokeWidth: 0.9 }} />
      {/* skull: round cranium, jaw, big eye sockets, nose, teeth */}
      <circle cy="-0.9" r="3.9" style={fill('accent')} />
      <rect x="-2.5" y="1" width="5" height="3.2" rx="1" style={fill('accent')} />
      <ellipse cx="-1.5" cy="-0.9" rx="1.2" ry="1.35" style={fill('badge')} />
      <ellipse cx="1.5" cy="-0.9" rx="1.2" ry="1.35" style={fill('badge')} />
      <path d="M0 0.9 L-0.6 1.9 H0.6 Z" style={fill('badge')} />
      <rect x="-0.95" y="2.7" width="0.5" height="1.5" style={fill('badge')} />
      <rect x="0.45" y="2.7" width="0.5" height="1.5" style={fill('badge')} />
    </g>
  )
}

// ============================================================
// The component everything else uses
// ============================================================

// y of the top of a character's head, in its own viewBox units (children are shorter).
export function headTop(type) {
  const c = CHARACTER_BY_ID[type]
  if (c.kind === 'animal') return 2
  return c.headTop ?? 64 - 60 * (c.scale ?? 1)
}

// Where a character's fate badge goes, in its own viewBox units (40 wide): beside the top of the head.
export function badgePosition(type) {
  const c = CHARACTER_BY_ID[type]
  if (c.kind === 'animal') return { cx: 20, cy: 5, r: 6 }
  return { cx: c.badgeLeft ? 5 : 35, cy: Math.max(7, headTop(type) + 2), r: 7 }
}

// note: extra words for the label, e.g. 'passenger'.
// showBadge = false keeps the fate in the label but lets the caller draw the badge (the scene does this
// for passengers, so their badges match the pedestrians' size).
// Other props (x, y, width, height) go on the <svg>, so a character can be placed inside a scene.
export function Character({ type, fate = null, pose = 'stand', note = null, showBadge = true, className, ...svgProps }) {
  const c = CHARACTER_BY_ID[type]
  if (!c) return null
  const animal = c.kind === 'animal'
  const badge = badgePosition(type)

  const label = [c.label, note, fate].filter(Boolean).join(', ') // e.g. "Man, passenger, killed"

  return (
    <svg
      viewBox={animal ? '0 0 40 32' : '0 0 40 64'}
      role="img"
      aria-label={label}
      data-label={label} // shown by HoverLabels after a 2-second hover
      className={['character', animal ? 'character-animal' : 'character-human', className].filter(Boolean).join(' ')}
      {...svgProps}
    >
      {c.draw(pose)}
      {fate && showBadge && <FateBadge fate={fate} {...badge} />}
    </svg>
  )
}
